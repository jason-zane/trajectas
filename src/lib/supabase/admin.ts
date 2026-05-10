import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service-role key.
 *
 * This client bypasses Row Level Security and should ONLY be used in
 * server-side code that requires elevated privileges (e.g. background jobs,
 * admin API routes, webhooks). Never expose it to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
