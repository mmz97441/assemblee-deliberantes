import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  RecapPDFDocument,
  type RecapPDFData,
} from '@/lib/pdf/templates/recap-template'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seanceId: string }> }
) {
  try {
    const { seanceId } = await params
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Load séance
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        id,
        titre,
        date_seance,
        lieu,
        mode,
        statut,
        heure_ouverture,
        heure_cloture,
        instance_id,
        instance_config (
          id,
          nom,
          type_legal,
          composition_max,
          quorum_fraction_numerateur,
          quorum_fraction_denominateur
        ),
        odj_points (
          id,
          position,
          titre,
          type_traitement,
          votes_interdits
        ),
        presences (
          id,
          member_id,
          statut
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
    }

    // Access check — any authenticated member who was convocataire, or manager
    const role = (userData.user.user_metadata?.role as string) || ''
    const isManager = ['super_admin', 'gestionnaire'].includes(role)

    if (!isManager) {
      const { data: memberRecord } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (memberRecord) {
        const { data: conv } = await supabase
          .from('convocataires')
          .select('id')
          .eq('seance_id', seanceId)
          .eq('member_id', memberRecord.id)
          .maybeSingle()

        if (!conv) {
          return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
      }
    }

    // Load institution config
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution')
      .limit(1)
      .single()

    // Load votes for this séance
    const { data: votes } = await supabase
      .from('votes')
      .select('id, odj_point_id, resultat, pour, contre, abstention, nul, formule_pv')
      .eq('seance_id', seanceId)

    // Build vote lookup by odj_point_id
    const voteByPoint: Record<string, {
      resultat: string | null
      detail: string | null
    }> = {}
    for (const v of (votes || [])) {
      if (v.odj_point_id) {
        let detail: string | null = null
        if (v.resultat === 'ADOPTE' || v.resultat === 'REJETE' || v.resultat === 'ADOPTE_VOIX_PREPONDERANTE') {
          const parts: string[] = []
          if (v.pour != null) parts.push(`${v.pour} pour`)
          if (v.contre != null) parts.push(`${v.contre} contre`)
          if (v.abstention != null) parts.push(`${v.abstention} abstention${(v.abstention || 0) > 1 ? 's' : ''}`)
          detail = parts.length > 0 ? `${v.resultat === 'REJETE' ? 'Rejeté' : 'Adopté'} (${parts.join(', ')})` : null
        }
        voteByPoint[v.odj_point_id] = {
          resultat: v.resultat,
          detail,
        }
      }
    }

    // Format dates
    const dateSeance = new Date(seance.date_seance)
    const dateFormatted = dateSeance.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Format horaires
    let heureOuverture: string | null = null
    let heureCloture: string | null = null

    if (seance.heure_ouverture) {
      heureOuverture = new Date(seance.heure_ouverture).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    if (seance.heure_cloture) {
      heureCloture = new Date(seance.heure_cloture).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    // Presences
    type PresenceEntry = { statut: string | null }
    const presenceEntries = (seance.presences || []) as unknown as PresenceEntry[]
    const presents = presenceEntries.filter(p => p.statut === 'PRESENT').length
    const excuses = presenceEntries.filter(p => p.statut === 'EXCUSE').length
    const absents = presenceEntries.filter(p => p.statut === 'ABSENT').length

    // Quorum
    const instanceConfig = seance.instance_config as {
      nom?: string
      type_legal?: string
      composition_max?: number | null
      quorum_fraction_numerateur?: number | null
      quorum_fraction_denominateur?: number | null
    } | null

    let quorumRequis: number | null = null
    if (instanceConfig?.composition_max) {
      const num = instanceConfig.quorum_fraction_numerateur || 1
      const den = instanceConfig.quorum_fraction_denominateur || 2
      quorumRequis = Math.ceil((instanceConfig.composition_max * num) / den)
    }

    const quorumAtteint = quorumRequis !== null ? presents >= quorumRequis : true

    // Sort ODJ by position
    type OdjEntry = { id: string; position: number; titre: string; type_traitement: string | null; votes_interdits: boolean | null }
    const odjSorted = ([...(seance.odj_points || [])] as unknown as OdjEntry[])
      .sort((a, b) => a.position - b.position)

    // Build points with results
    const pointsData = odjSorted.map(p => {
      const vote = voteByPoint[p.id]
      return {
        position: p.position,
        titre: p.titre,
        type: p.type_traitement || 'INFORMATION',
        resultat: vote?.resultat || null,
        voteDetail: vote?.detail || null,
      }
    })

    // Determine prochaine étape
    let prochainEtape = ''
    if (seance.statut === 'CLOTUREE') {
      prochainEtape = 'Procès-verbal à rédiger et délibérations à publier'
    } else if (seance.statut === 'ARCHIVEE') {
      prochainEtape = 'Séance archivée — Tous les documents ont été finalisés'
    } else {
      prochainEtape = 'Séance en cours de traitement'
    }

    // Check if PV exists
    const { data: pvData } = await supabase
      .from('pv')
      .select('id, statut')
      .eq('seance_id', seanceId)
      .maybeSingle()

    if (pvData) {
      const pvStatut = pvData.statut as string | null
      if (pvStatut === 'SIGNE') {
        prochainEtape = 'Procès-verbal signé — Délibérations à publier si nécessaire'
      } else if (pvStatut === 'APPROUVE' || pvStatut === 'APPROUVE_EN_SEANCE') {
        prochainEtape = 'Procès-verbal approuvé — En attente de signature'
      } else if (pvStatut === 'PUBLIE') {
        prochainEtape = 'Procès-verbal publié'
      } else if (pvStatut === 'BROUILLON' || pvStatut === 'EN_RELECTURE' || pvStatut === 'EN_REDACTION') {
        prochainEtape = 'Procès-verbal en cours de rédaction'
      }
    }

    // Build PDF data
    const pdfData: RecapPDFData = {
      institution: {
        nom: instConfig?.nom_officiel || 'Institution',
        type: instConfig?.type_institution || '',
      },
      instance: {
        nom: instanceConfig?.nom || '',
        typeLegal: instanceConfig?.type_legal || '',
      },
      seance: {
        titre: seance.titre,
        date: dateFormatted,
        heureOuverture,
        heureCloture,
        lieu: seance.lieu,
        mode: seance.mode || 'PRESENTIEL',
      },
      presences: {
        presents,
        excuses,
        absents,
        quorumAtteint,
        quorumRequis,
      },
      points: pointsData,
      prochainEtape,
    }

    // Render PDF
    const buffer = await renderToBuffer(
      <RecapPDFDocument data={pdfData} />
    )

    const filename = `Recapitulatif-${seance.titre.replace(/\s+/g, '_')}.pdf`
    const uint8 = new Uint8Array(buffer)

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Recap PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du récapitulatif' },
      { status: 500 }
    )
  }
}
