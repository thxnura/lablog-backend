import { createClient } from '@supabase/supabase-js';

export type TestUser = { email: string; password: string; role: 'student' | 'lecturer' };

/**
 * Demo accounts for the LOCAL Supabase stack only (never a hosted project).
 * The role lives in app_metadata, which only the service role can write.
 */
export const DEMO_USERS: readonly TestUser[] = [
  { email: 'student@lablog.test', password: 'LabLog-Student-1', role: 'student' },
  { email: 'student2@lablog.test', password: 'LabLog-Student-2', role: 'student' },
  { email: 'lecturer@lablog.test', password: 'LabLog-Lecturer-1', role: 'lecturer' },
];

/**
 * Test-only accounts on a HOSTED project, read from `.env.hosted` (git-ignored):
 * separate from the demo accounts, so a test run never touches demo data
 * (ADR-030). Undefined when those variables aren't set.
 */
export function hostedTestUsers(env = process.env): TestUser[] | undefined {
  const entry = (key: string, role: TestUser['role']) => {
    const email = env[key];
    const password = env[`${key}_PASSWORD`];
    return email && password ? { email, password, role } : undefined;
  };
  const users = [
    entry('LABLOG_TEST_STUDENT', 'student'),
    entry('LABLOG_TEST_STUDENT2', 'student'),
    entry('LABLOG_TEST_LECTURER', 'lecturer'),
  ];
  return users.every(Boolean) ? (users as TestUser[]) : undefined;
}

/** Creates (or resets) the given users. Safe to run repeatedly. */
export async function ensureUsers(supabaseUrl: string, serviceRoleKey: string, users: readonly TestUser[]) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  for (const user of users) {
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

/** Creates (or resets) the demo users on the local stack. */
export async function ensureDemoUsers(supabaseUrl: string, serviceRoleKey: string) {
  await ensureUsers(supabaseUrl, serviceRoleKey, DEMO_USERS);
}
