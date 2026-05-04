import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Accepter les deux noms possibles (integration Supabase-Vercel vs .env.local)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse('Service temporarily unavailable', { status: 503 })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Routes publiques
    // Note: ces routes sont dupliquees de lib/constants.ts car le middleware
    // Edge Runtime a des restrictions d'import. Garder synchronise avec PUBLIC_ROUTES.
    const publicPaths = ['/login', '/register', '/mot-de-passe-oublie', '/reset-password', '/invite', '/convocation', '/api/qr', '/api/webhooks', '/vote', '/auth/confirm']
    const isPublicPath = publicPaths.some((path) =>
      pathname.startsWith(path)
    ) || /^\/seances\/[^/]+\/public$/.test(pathname)

    // ─── Inactivité 1h : déconnexion auto ─────────────────────────────────
    //
    // Politique : pas de timeout absolu, mais déconnexion après 1h
    // d'inactivité (= aucune requête HTTP). Le cookie last_activity_at
    // est mis à jour à chaque requête authentifiée.
    //
    // Constantes dupliquées ici car middleware Edge Runtime ne peut pas
    // importer depuis lib/constants. Garder en sync :
    //   INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000 (1h)
    //   LAST_ACTIVITY_COOKIE = 'last_activity_at'
    const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000
    const LAST_ACTIVITY_COOKIE = 'last_activity_at'
    // Routes "ping" qui ne doivent PAS être considérées comme une activité
    // (sinon le ping silencieux du composant client réinitialiserait le timer
    // alors que l'utilisateur n'a rien fait). Voir /api/session/ping.
    const isPingRoute = pathname === '/api/session/ping'

    if (user && !isPublicPath) {
      const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE)
      const lastActivityAt = lastActivityCookie ? parseInt(lastActivityCookie.value, 10) : null
      const now = Date.now()

      if (lastActivityAt && now - lastActivityAt > INACTIVITY_TIMEOUT_MS) {
        // Session expirée pour inactivité → signOut + redirect /login
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('error', 'session_inactivity')
        const response = NextResponse.redirect(url)
        response.cookies.delete(LAST_ACTIVITY_COOKIE)
        return response
      }

      // Mise à jour du timestamp d'activité (sauf ping silencieux qui
      // ne doit pas étendre la session)
      if (!isPingRoute) {
        supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          // Pas de maxAge — on veut que le cookie disparaisse à la fermeture
          // du navigateur (session cookie). La date stockée à l'intérieur
          // sert de référence absolue.
        })
      }
    }

    // Si pas connecte et route protegee -> login
    if (!user && !isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // Si connecté et sur login/register/mot-de-passe-oublié -> dashboard
    if (user && (pathname === '/login' || pathname === '/register' || pathname === '/mot-de-passe-oublie')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Protection routes admin (configuration)
    // SÉCURITÉ : on lit le rôle depuis la table members (user_metadata est
    // modifiable côté client, donc inutilisable comme garde sécurité).
    if (pathname.startsWith('/configuration')) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
      const { data: member } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      // Configuration accessible aux 3 rôles « direction » : super_admin
      // + DGS + Directeur de cabinet. Cohérent avec la page /configuration
      // (page.tsx) et le lien dans la sidebar (app-sidebar.tsx).
      // Le toggle « QR strict » reste verrouillé au super_admin via
      // disabled={!isSuperAdmin} dans institution-wizard.tsx.
      if (!member || !['super_admin', 'dgs', 'directeur_cabinet'].includes(member.role || '')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

  } catch {
    return NextResponse.next()
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
