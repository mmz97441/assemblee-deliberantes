import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors in Server Components (read-only)
          }
        },
      },
    }
  )
}

export async function createServiceRoleClient() {
  const { createClient } = await import('@supabase/supabase-js')

  // L'integration Supabase-Vercel stocke la cle dans SUPABASE_SECRET_KEY,
  // notre .env.local utilise SUPABASE_SERVICE_ROLE_KEY. On accepte les deux.
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Supabase service role key or URL not configured')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
