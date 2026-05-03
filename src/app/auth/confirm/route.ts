import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Route handler `/auth/confirm` — point d'atterrissage des liens email
 * envoyés par Supabase Auth (reset password, magic link, signup, invitation).
 *
 * Supabase envoie l'utilisateur ici avec un `token_hash` + `type` (nouveau
 * format PKCE-compatible) ou avec un `code` (ancien flow OAuth). On valide
 * le token, on établit la session, puis on redirige vers `next` (par défaut
 * la racine).
 *
 * Sans ce handler, le lien email aboutit à `/reset-password` SANS session
 * établie — le middleware redirige alors l'utilisateur vers `/login` car
 * il n'a pas de session valide.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Empêcher l'open redirect : le `next` doit être un chemin relatif
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  const supabase = await createServerSupabaseClient()

  // Cas 1 : nouveau format Supabase (token_hash + type)
  // Concerne reset password, magic link, signup confirmation, invitation
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    console.warn('[AUTH] verifyOtp échec :', error.message)
  }

  // Cas 2 : ancien format OAuth (code à échanger contre une session)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    console.warn('[AUTH] exchangeCodeForSession échec :', error.message)
  }

  // Échec — rediriger vers /login avec un flag pour afficher l'erreur
  return NextResponse.redirect(
    `${origin}/login?error=auth_link_invalid_or_expired`
  )
}
