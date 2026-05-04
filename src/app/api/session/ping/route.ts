import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LAST_ACTIVITY_COOKIE } from '@/lib/constants'

/**
 * POST /api/session/ping
 *
 * Appelée par le composant client SessionTimeoutWarning quand l'utilisateur
 * confirme qu'il est toujours actif (clic « Rester connecté », ou activité
 * détectée après > 5 min depuis le dernier ping).
 *
 * Met à jour le cookie last_activity_at pour repousser le timeout d'1 heure.
 *
 * IMPORTANT : cette route est exclue du mécanisme de mise à jour
 * automatique du cookie dans le middleware (cf. isPingRoute) — elle
 * écrit elle-même le cookie en réponse pour avoir un contrôle exact.
 *
 * Refuse les utilisateurs non authentifiés (401).
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, at: Date.now() })
  response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  return response
}
