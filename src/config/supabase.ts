import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Service-role client: full access, used by repositories for server-side data
 * access. NEVER expose the service role key to the mobile client.
 */
export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Anon client factory: used to verify a user's JWT in the auth middleware.
 */
export function supabaseForToken(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
