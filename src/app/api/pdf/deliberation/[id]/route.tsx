import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'
import { getVerifiedRole } from '@/lib/auth/get-user-role'
import {
  DeliberationPDFDocument,
  type DeliberationPDFData,
} from '@/lib/pdf/templates/deliberation-template'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // ─── Auth check ───────────────────────────────────────────────────────
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Rate limiting PDF — max 10 par minute par utilisateur
    if (!checkApiRateLimit(`pdf_deliberation_${userData.user.id}`, API_RATE_LIMITS.PDF.maxRequests, API_RATE_LIMITS.PDF.windowMs)) {
      return NextResponse.json({ error: 'Trop de demandes de PDF. Veuillez patienter quelques instants.' }, { status: 429 })
    }

    // ─── SÉCURITÉ : vérification du rôle via la table members ────────────
    const metadataRole = (userData.user.user_metadata?.role as string) || ''
    const role = await getVerifiedRole(supabase, userData.user.id, metadataRole)
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
    }

    // ─── Load deliberation with joins ────────────────────────────────────
    const { data: delib, error: delibError } = await supabase
      .from('deliberations')
      .select(`
        id,
        numero,
        titre,
        contenu_articles,
        annulee,
        motif_annulation,
        publie_at,
        seance_id,
        vote_id,
        odj_point_id
      `)
      .eq('id', id)
      .single()

    if (delibError || !delib) {
      return NextResponse.json(
        { error: 'Délibération introuvable' },
        { status: 404 }
      )
    }

    // ─── Load seance ─────────────────────────────────────────────────────
    const { data: seance } = await supabase
      .from('seances')
      .select(`
        id,
        date_seance,
        lieu,
        instance_id,
        secretaire_seance_id,
        president_effectif_seance_id
      `)
      .eq('id', delib.seance_id)
      .single()

    if (!seance) {
      return NextResponse.json(
        { error: 'Séance introuvable pour cette délibération' },
        { status: 404 }
      )
    }

    // ─── Load instance ───────────────────────────────────────────────────
    const { data: instance } = await supabase
      .from('instance_config')
      .select('id, nom, type_legal')
      .eq('id', seance.instance_id)
      .single()

    // ─── Load institution config ─────────────────────────────────────────
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution, adresse_siege, prefecture_rattachement')
      .limit(1)
      .single()

    // ─── Load vote (if linked) ───────────────────────────────────────────
    let voteData: { formulePV: string | null; resultat: string | null } | null = null
    if (delib.vote_id) {
      const { data: vote } = await supabase
        .from('votes')
        .select('formule_pv, resultat')
        .eq('id', delib.vote_id)
        .single()

      if (vote) {
        voteData = {
          formulePV: vote.formule_pv,
          resultat: vote.resultat,
        }
      }
    }

    // ─── Load ODJ point (vu / considérant) ───────────────────────────────
    // Note: vu & considerant columns added in migration 00011 — not in generated types
    let pointData: { vu: string | null; considerant: string | null } | null = null
    if (delib.odj_point_id) {
      const { data: point } = await supabase
        .from('odj_points')
        .select('*')
        .eq('id', delib.odj_point_id)
        .single()

      if (point) {
        // Cast to access columns added after type generation
        const p = point as Record<string, unknown>
        pointData = {
          vu: (p.vu as string) ?? null,
          considerant: (p.considerant as string) ?? null,
        }
      }
    }

    // ─── Load president & secretary names ────────────────────────────────
    let presidentName: string | null = null
    let secretaireName: string | null = null

    if (seance.president_effectif_seance_id) {
      const { data: pres } = await supabase
        .from('members')
        .select('prenom, nom')
        .eq('id', seance.president_effectif_seance_id)
        .single()
      if (pres) presidentName = `${pres.prenom} ${pres.nom}`
    }

    if (seance.secretaire_seance_id) {
      const { data: sec } = await supabase
        .from('members')
        .select('prenom, nom')
        .eq('id', seance.secretaire_seance_id)
        .single()
      if (sec) secretaireName = `${sec.prenom} ${sec.nom}`
    }

    // ─── Format date ─────────────────────────────────────────────────────
    const dateSeance = new Date(seance.date_seance)
    const dateFormatted = dateSeance.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    let publieDateFormatted: string | undefined
    if (delib.publie_at) {
      publieDateFormatted = new Date(delib.publie_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    // ─── Parse articles ──────────────────────────────────────────────────
    let articles: string[] = []
    if (Array.isArray(delib.contenu_articles)) {
      articles = delib.contenu_articles.map((a: unknown) =>
        typeof a === 'string' ? a : String(a)
      )
    }

    // ─── Build PDF data ──────────────────────────────────────────────────
    const pdfData: DeliberationPDFData = {
      institution: {
        nom: instConfig?.nom_officiel || 'Institution',
        type: instConfig?.type_institution || '',
        adresse: instConfig?.adresse_siege,
        prefecture: instConfig?.prefecture_rattachement,
      },
      instance: {
        nom: instance?.nom || '',
        typeLegal: instance?.type_legal || '',
      },
      deliberation: {
        numero: delib.numero || '',
        titre: delib.titre,
        articles,
        annulee: delib.annulee ?? false,
        motifAnnulation: delib.motif_annulation,
        publieeAt: publieDateFormatted,
      },
      seance: {
        date: dateFormatted,
        lieu: seance.lieu,
      },
      vote: voteData,
      point: pointData,
      signatures: {
        president: presidentName,
        secretaire: secretaireName,
      },
    }

    // ─── Render PDF ──────────────────────────────────────────────────────
    const buffer = await renderToBuffer(
      <DeliberationPDFDocument data={pdfData} />
    )

    // ─── Build filename ──────────────────────────────────────────────────
    const numero = delib.numero
      ? delib.numero.replace(/[^a-zA-Z0-9\-]/g, '_')
      : id.slice(0, 8)
    const filename = `Deliberation-${numero}.pdf`

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
    console.error('Deliberation PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF de la délibération' },
      { status: 500 }
    )
  }
}
