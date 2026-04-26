import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'
import { getVerifiedRole } from '@/lib/auth/get-user-role'
import {
  DossierSeancePDFDocument,
  type DossierSeancePDFData,
} from '@/lib/pdf/templates/dossier-seance-template'

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

    // Rate limiting PDF — max 10 par minute par utilisateur
    if (!checkApiRateLimit(`pdf_dossier_${userData.user.id}`, API_RATE_LIMITS.PDF.maxRequests, API_RATE_LIMITS.PDF.windowMs)) {
      return NextResponse.json({ error: 'Trop de demandes de PDF. Veuillez patienter quelques instants.' }, { status: 429 })
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
        instance_id,
        instance_config (id, nom, type_legal)
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
    }

    // SÉCURITÉ : vérification du rôle via la table members
    const metadataRole = (userData.user.user_metadata?.role as string) || ''
    const role = await getVerifiedRole(supabase, userData.user.id, metadataRole)
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

    // Load ODJ points with rapporteurs
    const { data: odjPoints } = await supabase
      .from('odj_points')
      .select('position, titre, type_traitement, description, projet_deliberation, rapporteur_id')
      .eq('seance_id', seanceId)
      .order('position', { ascending: true })

    // Load rapporteur names
    const rapporteurIds = (odjPoints || [])
      .filter(p => p.rapporteur_id)
      .map(p => p.rapporteur_id!)
    const uniqueIds = Array.from(new Set(rapporteurIds))

    let rapporteurNames: Record<string, string> = {}
    if (uniqueIds.length > 0) {
      const { data: rapporteurs } = await supabase
        .from('members')
        .select('id, prenom, nom')
        .in('id', uniqueIds)

      if (rapporteurs) {
        rapporteurNames = Object.fromEntries(
          rapporteurs.map(m => [m.id, `${m.prenom} ${m.nom}`])
        )
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
    const heureFormatted = dateSeance.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Try to load vu/considérant from ODJ points (may not be in generated types)
    const pointsData = (odjPoints || []).map(p => {
      const raw = p as Record<string, unknown>
      return {
        position: p.position,
        titre: p.titre,
        type: p.type_traitement || 'INFORMATION',
        rapporteur: p.rapporteur_id ? rapporteurNames[p.rapporteur_id] || null : null,
        description: p.description,
        projetDeliberation: p.projet_deliberation,
        vu: (raw.vu as string) ?? null,
        considerant: (raw.considerant as string) ?? null,
      }
    })

    // Build PDF data
    const pdfData: DossierSeancePDFData = {
      institution: {
        nom: instConfig?.nom_officiel || 'Institution',
        type: instConfig?.type_institution || '',
      },
      instance: {
        nom: (seance.instance_config as { nom?: string })?.nom || '',
        typeLegal: (seance.instance_config as { type_legal?: string })?.type_legal || '',
      },
      seance: {
        titre: seance.titre,
        date: dateFormatted,
        heure: heureFormatted,
        lieu: seance.lieu,
        mode: seance.mode || 'PRESENTIEL',
      },
      points: pointsData,
    }

    // Render PDF
    const buffer = await renderToBuffer(
      <DossierSeancePDFDocument data={pdfData} />
    )

    const dateSafe = dateFormatted.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '')
    const filename = `Dossier-seance-${dateSafe}.pdf`
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
    console.error('Dossier séance PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du dossier de séance' },
      { status: 500 }
    )
  }
}
