import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for server-only code paths that need to
 * bypass RLS — payment webhooks, cron jobs, account deletion, etc.
 *
 * NEVER import this from a client component or API route that is
 * callable by an unauthenticated visitor without its own guard. The
 * service role key is a root key — treat it like a DB password.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env.local (NOT prefixed
 * with NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
