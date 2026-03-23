import { SupabaseClient } from '@supabase/supabase-js'

interface RateLimitConfig {
  actionKey: string
  maxAttempts: number
  windowMinutes: number
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000).toISOString()

  // Count recent attempts
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('action_key', config.actionKey)
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  const attempts = count || 0

  if (attempts >= config.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      error: `Trop de tentatives. Veuillez réessayer dans ${config.windowMinutes} minutes.`,
    }
  }

  // Record this attempt
  await supabase
    .from('rate_limits')
    .insert({
      action_key: config.actionKey,
      user_id: userId,
    })

  return { allowed: true, remaining: config.maxAttempts - attempts - 1 }
}
