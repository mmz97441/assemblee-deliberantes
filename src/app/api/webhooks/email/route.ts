import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Resend webhook events: https://resend.com/docs/dashboard/webhooks/introduction
// Events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained

// Status priority — higher number = more advanced in the lifecycle
// Errors always override (treated specially)
const STATUS_PRIORITY: Record<string, number> = {
  'NON_ENVOYE': 0,
  'ENVOYE': 1,
  'ENVOYE_COURRIER': 1,
  'LU': 2,
  'CONFIRME_PRESENT': 10,
  'ABSENT_PROCURATION': 10,
  'ERREUR_EMAIL': -1,
}

export async function POST(request: NextRequest) {
  try {
    // H4: Verify Resend webhook signature headers
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[WEBHOOK] Missing Resend signature headers — request rejected')
      return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 })
    }

    // Reject stale timestamps (> 5 minutes)
    const timestampSeconds = parseInt(svixTimestamp, 10)
    if (isNaN(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      console.warn('[WEBHOOK] Stale webhook timestamp — request rejected')
      return NextResponse.json({ error: 'Webhook timestamp too old' }, { status: 401 })
    }

    // TODO: Full cryptographic signature verification with svix library
    // For now, header presence + timestamp freshness provides basic protection

    const body = await request.json()
    const { type, data } = body

    // Extract the email recipient
    const toEmail = data?.to?.[0] || data?.email
    if (!toEmail) return NextResponse.json({ received: true })

    const supabase = await createServiceRoleClient()

    // Map Resend events to our statuts
    let newStatut: string | null = null
    switch (type) {
      case 'email.delivered':
        newStatut = 'ENVOYE' // Confirmed delivered
        break
      case 'email.opened':
        newStatut = 'LU' // Opened
        break
      case 'email.clicked':
        // Don't change status on click — the confirmation page handles CONFIRME_PRESENT
        break
      case 'email.bounced':
      case 'email.complained':
        newStatut = 'ERREUR_EMAIL'
        break
    }

    if (!newStatut) return NextResponse.json({ received: true })

    // Find the member(s) by email
    const { data: members } = await supabase
      .from('members')
      .select('id')
      .eq('email', toEmail)

    if (!members || members.length === 0) {
      return NextResponse.json({ received: true })
    }

    const memberIds = members.map(m => m.id)

    // Get the most recent convocataires for these members
    const { data: convocataires } = await supabase
      .from('convocataires')
      .select('id, member_id, statut_convocation')
      .in('member_id', memberIds)
      .order('created_at', { ascending: false })

    if (!convocataires) return NextResponse.json({ received: true })

    for (const conv of convocataires) {
      const currentPriority = STATUS_PRIORITY[conv.statut_convocation || 'NON_ENVOYE'] ?? 0
      const newPriority = STATUS_PRIORITY[newStatut] ?? 0

      // Only upgrade status (except errors which always apply)
      if (newPriority > currentPriority || newStatut === 'ERREUR_EMAIL') {
        const updateData: Record<string, string> = { statut_convocation: newStatut }

        // Track when the email was read
        if (newStatut === 'LU') {
          updateData.lu_at = new Date().toISOString()
        }
        // Track error details
        if (newStatut === 'ERREUR_EMAIL') {
          updateData.erreur_detail = `Resend: ${type} - ${data?.bounce?.type || data?.complaint?.type || 'unknown'}`
        }

        await supabase
          .from('convocataires')
          .update(updateData)
          .eq('id', conv.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook email error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
