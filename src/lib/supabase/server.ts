import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Resout les variables d'environnement Supabase.
 * L'integration Supabase-Vercel peut utiliser des noms differents
 * (SUPABASE_URL vs NEXT_PUBLIC_SUPABASE_URL, etc.).
 */
function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase URL ou Anon Key manquante. ' +
      'Verifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return { url, anonKey }
}

export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    url,
    anonKey,
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
    throw new Error(
      'Supabase service role key ou URL non configuree. ' +
      'Verifiez SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL.'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Types generes pas encore complets pour service role
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
