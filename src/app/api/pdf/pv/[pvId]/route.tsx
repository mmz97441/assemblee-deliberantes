import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PVPDFDocument } from '@/lib/pdf/templates/pv-template'
import type { PVContenu } from '@/lib/actions/pv'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pvId: string }> }
) {
  try {
    const { pvId } = await params
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Role check — only gestionnaire/super_admin can generate PDF
    const role = (userData.user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
    }

    // Load PV
    const { data: pv, error: pvError } = await supabase
      .from('pv')
      .select('id, seance_id, contenu_json, statut')
      .eq('id', pvId)
      .single()

    if (pvError || !pv) {
      return NextResponse.json({ error: 'Procès-verbal introuvable' }, { status: 404 })
    }

    const contenu = pv.contenu_json as unknown as PVContenu | null
    if (!contenu) {
      return NextResponse.json({ error: 'Le contenu du PV est vide' }, { status: 400 })
    }

    // Render PDF to buffer
    const buffer = await renderToBuffer(
      <PVPDFDocument contenu={contenu} />
    )

    // Build filename
    const dateStr = contenu.entete.dateSeance
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ\-]/g, '')
    const filename = `PV-${dateStr}.pdf`

    // Convert Buffer to Uint8Array for NextResponse compatibility
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
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    )
  }
}
