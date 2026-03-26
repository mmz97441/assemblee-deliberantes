import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  RegisterPDFDocument,
  type RegisterPDFData,
  type RegisterDeliberationEntry,
} from '@/lib/pdf/templates/register-template'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const { year: yearStr } = await params
    const year = parseInt(yearStr, 10)

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Année invalide. Format attendu : /api/pdf/registre/2026' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // ─── Auth check ───────────────────────────────────────────────────────
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = (userData.user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
    }

    // ─── Load institution config ──────────────────────────────────────────
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution, adresse_siege, prefecture_rattachement')
      .limit(1)
      .single()

    // ─── Load published deliberations for the year ────────────────────────
    const yearStart = `${year}-01-01T00:00:00.000Z`
    const yearEnd = `${year + 1}-01-01T00:00:00.000Z`

    const { data: deliberations, error: delibError } = await supabase
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
      .not('publie_at', 'is', null)
      .gte('publie_at', yearStart)
      .lt('publie_at', yearEnd)
      .order('publie_at', { ascending: true })

    if (delibError) {
      return NextResponse.json(
        { error: `Erreur chargement délibérations : ${delibError.message}` },
        { status: 500 }
      )
    }

    if (!deliberations || deliberations.length === 0) {
      return NextResponse.json(
        { error: `Aucune délibération publiée pour l'année ${year}` },
        { status: 404 }
      )
    }

    // ─── Collect unique seance IDs, vote IDs, point IDs ───────────────────
    const seanceIds = Array.from(new Set(deliberations.map(d => d.seance_id).filter(Boolean)))
    const voteIds = Array.from(new Set(deliberations.map(d => d.vote_id).filter(Boolean))) as string[]
    const pointIds = Array.from(new Set(deliberations.map(d => d.odj_point_id).filter(Boolean))) as string[]

    // ─── Load seances ─────────────────────────────────────────────────────
    const seanceMap = new Map<string, {
      date_seance: string
      lieu: string | null
      instance_id: string
      president_effectif_seance_id: string | null
      secretaire_seance_id: string | null
    }>()

    if (seanceIds.length > 0) {
      const { data: seances } = await supabase
        .from('seances')
        .select('id, date_seance, lieu, instance_id, president_effectif_seance_id, secretaire_seance_id')
        .in('id', seanceIds)

      if (seances) {
        for (const s of seances) {
          seanceMap.set(s.id, s)
        }
      }
    }

    // ─── Load instances ───────────────────────────────────────────────────
    const instanceIds = Array.from(new Set(Array.from(seanceMap.values()).map(s => s.instance_id).filter(Boolean)))
    const instanceMap = new Map<string, { nom: string; type_legal: string }>()

    if (instanceIds.length > 0) {
      const { data: instances } = await supabase
        .from('instance_config')
        .select('id, nom, type_legal')
        .in('id', instanceIds)

      if (instances) {
        for (const inst of instances) {
          instanceMap.set(inst.id, { nom: inst.nom, type_legal: inst.type_legal })
        }
      }
    }

    // ─── Load votes ───────────────────────────────────────────────────────
    const voteMap = new Map<string, { formule_pv: string | null; resultat: string | null }>()

    if (voteIds.length > 0) {
      const { data: votes } = await supabase
        .from('votes')
        .select('id, formule_pv, resultat')
        .in('id', voteIds)

      if (votes) {
        for (const v of votes) {
          voteMap.set(v.id, { formule_pv: v.formule_pv, resultat: v.resultat })
        }
      }
    }

    // ─── Load ODJ points (vu / considérant) ───────────────────────────────
    const pointMap = new Map<string, { vu: string | null; considerant: string | null }>()

    if (pointIds.length > 0) {
      const { data: points } = await supabase
        .from('odj_points')
        .select('*')
        .in('id', pointIds)

      if (points) {
        for (const p of points) {
          const raw = p as Record<string, unknown>
          pointMap.set(p.id, {
            vu: (raw.vu as string) ?? null,
            considerant: (raw.considerant as string) ?? null,
          })
        }
      }
    }

    // ─── Load member names (presidents + secretaires) ─────────────────────
    const memberIds = new Set<string>()
    Array.from(seanceMap.values()).forEach(s => {
      if (s.president_effectif_seance_id) memberIds.add(s.president_effectif_seance_id)
      if (s.secretaire_seance_id) memberIds.add(s.secretaire_seance_id)
    })

    const memberMap = new Map<string, string>()
    if (memberIds.size > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('id, prenom, nom')
        .in('id', Array.from(memberIds))

      if (members) {
        for (const m of members) {
          memberMap.set(m.id, `${m.prenom} ${m.nom}`)
        }
      }
    }

    // ─── Build deliberation entries ───────────────────────────────────────
    const entries: RegisterDeliberationEntry[] = deliberations.map(delib => {
      const seance = seanceMap.get(delib.seance_id)
      const instance = seance ? instanceMap.get(seance.instance_id) : null
      const vote = delib.vote_id ? voteMap.get(delib.vote_id) : null
      const point = delib.odj_point_id ? pointMap.get(delib.odj_point_id) : null

      // Format date
      const dateFormatted = seance
        ? new Date(seance.date_seance).toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '...'

      let publieDateFormatted: string | undefined
      if (delib.publie_at) {
        publieDateFormatted = new Date(delib.publie_at).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }

      // Parse articles
      let articles: string[] = []
      if (delib.contenu_articles) {
        if (Array.isArray(delib.contenu_articles)) {
          articles = delib.contenu_articles.map((a: unknown) =>
            typeof a === 'string' ? a : String(a)
          )
        } else if (typeof delib.contenu_articles === 'object') {
          // contenu_articles might be a DeliberationContenu object
          const contenu = delib.contenu_articles as Record<string, unknown>
          if (Array.isArray(contenu.articles)) {
            articles = contenu.articles.map((a: unknown) =>
              typeof a === 'string' ? a : String(a)
            )
          }
        }
      }

      // President & secretary names
      const presidentNom = seance?.president_effectif_seance_id
        ? memberMap.get(seance.president_effectif_seance_id) ?? null
        : null
      const secretaireNom = seance?.secretaire_seance_id
        ? memberMap.get(seance.secretaire_seance_id) ?? null
        : null

      // Vu / Considérant from point or from contenu_articles
      let vu = point?.vu ?? null
      let considerant = point?.considerant ?? null

      // Fallback: check contenu_articles object for vu/considerant
      if ((!vu || !considerant) && delib.contenu_articles && typeof delib.contenu_articles === 'object' && !Array.isArray(delib.contenu_articles)) {
        const contenu = delib.contenu_articles as Record<string, unknown>
        if (!vu && contenu.vu) vu = String(contenu.vu)
        if (!considerant && contenu.considerant) considerant = String(contenu.considerant)
      }

      return {
        numero: delib.numero || '...',
        titre: delib.titre,
        dateSeance: dateFormatted,
        instanceNom: instance?.nom || '',
        instanceTypeLegal: instance?.type_legal || '',
        annulee: delib.annulee ?? false,
        motifAnnulation: delib.motif_annulation,
        publieeAt: publieDateFormatted,
        vu,
        considerant,
        formulePV: vote?.formule_pv ?? null,
        resultatVote: vote?.resultat ?? null,
        articles,
        presidentNom,
        secretaireNom,
        lieu: seance?.lieu ?? null,
      }
    })

    // ─── Determine instance name (use first one if all same) ──────────────
    const uniqueInstances = Array.from(new Set(entries.map(e => e.instanceNom).filter(Boolean)))
    const instanceNom = uniqueInstances.length === 1 ? uniqueInstances[0] : null

    // ─── Get president name (use the latest seance's president) ───────────
    let registerPresidentNom: string | null = null
    if (deliberations.length > 0) {
      const lastDelib = deliberations[deliberations.length - 1]
      const lastSeance = seanceMap.get(lastDelib.seance_id)
      if (lastSeance?.president_effectif_seance_id) {
        registerPresidentNom = memberMap.get(lastSeance.president_effectif_seance_id) ?? null
      }
    }

    // ─── Build PDF data ───────────────────────────────────────────────────
    const pdfData: RegisterPDFData = {
      institution: {
        nom: instConfig?.nom_officiel || 'Institution',
        type: instConfig?.type_institution || '',
        adresse: instConfig?.adresse_siege,
        prefecture: instConfig?.prefecture_rattachement,
      },
      year,
      instanceNom,
      deliberations: entries,
      presidentNom: registerPresidentNom,
      closedAt: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }

    // ─── Render PDF ───────────────────────────────────────────────────────
    const buffer = await renderToBuffer(
      <RegisterPDFDocument data={pdfData} />
    )

    const filename = `Registre-Deliberations-${year}.pdf`
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
    console.error('Register PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du registre PDF' },
      { status: 500 }
    )
  }
}
