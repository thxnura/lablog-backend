import { createClient } from '@supabase/supabase-js';

/**
 * Demo accounts for the LOCAL Supabase stack only (never a hosted project).
 * The role lives in app_metadata, which only the service role can write.
 */
export const DEMO_USERS = [
  { email: 'student@lablog.test', password: 'LabLog-Student-1', role: 'student' },
  { email: 'student2@lablog.test', password: 'LabLog-Student-2', role: 'student' },
  { email: 'lecturer@lablog.test', password: 'LabLog-Lecturer-1', role: 'lecturer' },
] as const;

/** Creates (or resets) the demo users. Safe to run repeatedly. */
export async function ensureDemoUsers(supabaseUrl: string, serviceRoleKey: string) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  for (const user of DEMO_USERS) {
    const existing = list.users.find((u) => u.email === user.email);
    const attrs = {
      password: user.password,
      email_confirm: true,
      app_metadata: { role: user.role },
    };
    const { error } = existing
      ? await admin.auth.admin.updateUserById(existing.id, attrs)
      : await admin.auth.admin.createUser({ email: user.email, ...attrs });
    if (error) throw error;
  }
}
