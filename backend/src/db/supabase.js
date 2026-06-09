import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env / Vercel dashboard.'
  )
}

// Service role key bypasses RLS — safe for server-side use only
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

/** Throw a descriptive error if a Supabase call returned an error. */
export function assertOk({ error }, label) {
  if (error) throw new Error(`[Supabase/${label}] ${error.message}`)
}
