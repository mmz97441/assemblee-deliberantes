import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  // Cote client, seules les variables NEXT_PUBLIC_* sont accessibles
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase URL ou Anon Key manquante cote client. ' +
      'Verifiez que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont definies.'
    )
  }

  return createBrowserClient<Database>(url, anonKey)
}
