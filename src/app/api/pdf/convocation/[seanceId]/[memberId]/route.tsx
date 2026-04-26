import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'
import { getVerifiedRole } from '@/lib/auth/get-user-role'
import {
  ConvocationPDFDocument,
  type ConvocationPDFData,
} from '@/lib/pdf/templates/convocation-template'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seanceId: string; memberId: string }> }
) {
  try {
    const { seanceId, memberId } = await params
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Rate limiting PDF — max 10 par minute par utilisateur
    if (!checkApiRateLimit(`pdf_convocation_${userData.user.id}`, API_RATE_LIMITS.PDF.maxRequests, API_RATE_LIMITS.PDF.windowMs)) {
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
        mode,
        instance_id,
        president_effectif_seance_id,
        instance_config (id, nom, type_legal)
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
    }

    // Load member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, prenom, nom, qualite_officielle, email')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    // Verify member is convocataire
    const { data: conv } = await supabase
      .from('convocataires')
      .select('id, token_emargement')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json(
        { error: 'Ce membre n\'est pas convocataire de cette séance' },
        { status: 404 }
      )
    }

    // Load president name
    let presidentNom = 'Le Président'
    const presidentCivilite = ''
    if (seance.president_effectif_seance_id) {
      const { data: pres } = await supabase
        .from('members')
        .select('prenom, nom')
        .eq('id', seance.president_effectif_seance_id)
        .single()
      if (pres) {
        presidentNom = `${pres.prenom} ${pres.nom}`
      }
    }

    // Load institution config
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution, adresse_siege')
      .limit(1)
      .single()

    // Load ODJ points
    const { data: odjPoints } = await supabase
      .from('odj_points')
      .select('position, titre, type_traitement')
      .eq('seance_id', seanceId)
      .order('position', { ascending: true })

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

    const now = new Date()
    const dateFait = now.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // QR code URL (using the token_emargement from convocataires if available)
    const qrData = conv.token_emargement || `${seanceId}_${memberId}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const qrCodeUrl = appUrl ? `${appUrl}/api/qr?data=${encodeURIComponent(qrData)}` : null

    // Determine civilité based on member name (simplified)
    const membreCivilite = 'M.'

    // Build PDF data
    const pdfData: ConvocationPDFData = {
      institution: {
        nom: instConfig?.nom_officiel || 'Institution',
        type: instConfig?.type_institution || '',
        adresse: instConfig?.adresse_siege,
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
      president: {
        civilite: presidentCivilite,
        nom: presidentNom,
      },
      membre: {
        civilite: membreCivilite,
        prenom: member.prenom,
        nom: member.nom,
        qualite: member.qualite_officielle,
      },
      odjPoints: (odjPoints || []).map(p => ({
        position: p.position,
        titre: p.titre,
        type: p.type_traitement || 'INFORMATION',
      })),
      qrCodeUrl,
      dateFait,
      lieuFait: seance.lieu || '',
    }

    // Render PDF
    const buffer = await renderToBuffer(
      <ConvocationPDFDocument data={pdfData} />
    )

    const filename = `Convocation-${member.nom}-${member.prenom}.pdf`
      .replace(/\s+/g, '_')
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
    console.error('Convocation PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF de convocation' },
      { status: 500 }
    )
  }
}
