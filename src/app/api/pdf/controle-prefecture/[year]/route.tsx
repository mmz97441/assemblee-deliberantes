import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { checkApiRateLimit, API_RATE_LIMITS } from '@/lib/security/api-rate-limiter'
import { getControlePrefectureData } from '@/lib/actions/controle-prefecture'
import { ControlePrefecturePDF } from '@/lib/pdf/templates/controle-prefecture-template'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Génération potentiellement longue (chargement de toute l'année + render
// d'un PDF de 50-200 pages). On augmente la timeout serverless.
export const maxDuration = 300

export async function GET(
  _request: NextRequest,
  { params }: { params: { year: string } }
) {
  try {
    const yearStr = params.year
    const year = parseInt(yearStr, 10)
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Année invalide. Format attendu : /api/pdf/controle-prefecture/2026' },
        { status: 400 }
      )
    }

    // Auth check (rate limit utilisateur). Le rôle est revérifié dans
    // l'action getControlePrefectureData via requireVerifiedRole.
    const supabase = await createServerSupabaseClient()
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Rate limit dédié — max 5 par heure (export lourd)
    if (
      !checkApiRateLimit(
        `pdf_controle_prefecture_${userData.user.id}`,
        5,
        60 * 60 * 1000
      )
    ) {
      return NextResponse.json(
        { error: 'Trop d\'exports demandés. Veuillez réessayer dans une heure.' },
        { status: 429 }
      )
    }

    // ─── Récupération de toutes les données ───────────────────────────
    const result = await getControlePrefectureData(year)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 403 })
    }

    // ─── Génération du PDF ────────────────────────────────────────────
    const buffer = await renderToBuffer(<ControlePrefecturePDF data={result.data} />)

    const safeName = (result.data.meta.institutionNom || 'institution')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
    const filename = `Controle-prefecture-${year}-${safeName}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
        // Hash global du dossier pour vérification d'intégrité côté client
        'X-Document-Hash': result.data.hashIntegrite,
      },
    })
  } catch (err) {
    console.error('Controle prefecture PDF error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du dossier de contrôle' },
      { status: 500 }
    )
  }
}

// Inclure react/jsx pour le typage du composant
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Marker = typeof ControlePrefecturePDF
