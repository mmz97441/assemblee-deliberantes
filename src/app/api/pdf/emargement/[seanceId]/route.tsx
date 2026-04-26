import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'
import { getVerifiedRole } from '@/lib/auth/get-user-role'
import {
  EmargementPDFDocument,
  type EmargementPDFData,
} from '@/lib/pdf/templates/emargement-template'

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
    if (!checkApiRateLimit(`pdf_emargement_${userData.user.id}`, API_RATE_LIMITS.PDF.maxRequests, API_RATE_LIMITS.PDF.windowMs)) {
      return NextResponse.json({ error: 'Trop de demandes de PDF. Veuillez patienter quelques instants.' }, { status: 429 })
    }

    // SÉCURITÉ : vérification du rôle via la table members
    const metadataRole = (userData.user.user_metadata?.role as string) || ''
    const role = await getVerifiedRole(supabase, userData.user.id, metadataRole)
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
    }

    // Load séance
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        id,
        titre,
        date_seance,
        lieu,
        instance_id,
        instance_config (
          id,
          nom,
          type_legal,
          quorum_type,
          quorum_fraction_numerateur,
          quorum_fraction_denominateur,
          composition_max
        ),
        convocataires (
          id,
          member_id,
          member:members (id, prenom, nom, qualite_officielle)
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
    }

    // Load institution config
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution')
      .limit(1)
      .single()

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

    // Extract convocataires
    type ConvRow = {
      member: { prenom: string; nom: string; qualite_officielle: string | null } | null
    }
    const convocataires = ((seance.convocataires || []) as unknown as ConvRow[])
      .filter(c => c.member)
      .map(c => ({
        prenom: c.member!.prenom,
        nom: c.member!.nom,
        qualite: c.member!.qualite_officielle,
      }))

    // Calculate quorum
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

    // Build PDF data
    const pdfData: EmargementPDFData = {
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
        heure: heureFormatted,
        lieu: seance.lieu,
      },
      convocataires,
      quorumRequis,
      totalMembres: convocataires.length,
    }

    // Render PDF
    const buffer = await renderToBuffer(
      <EmargementPDFDocument data={pdfData} />
    )

    const filename = `Emargement-${seance.titre.replace(/\s+/g, '_')}.pdf`
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
    console.error('Emargement PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la feuille d\'émargement' },
      { status: 500 }
    )
  }
}
