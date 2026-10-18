/**
 * Test accounts and clean-up for testing against the HOSTED backend (ADR-030),
 * so no local Docker stack is needed. Reads `.env.hosted` (git-ignored).
 *
 *   npm run hosted:users     create or reset the three test-only accounts
 *   npm run hosted:cleanup   delete everything those accounts created
 *
 * Only the test accounts' data is touched: their records (with completions,
 * observations, photo rows and the photo files) and the labs the test
 * lecturer created. The demo accounts and the course labs are never changed.
 */
import { createClient } from '@supabase/supabase-js';
import { ensureUsers, hostedTestUsers } from './demo-users.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'evidence';
const users = hostedTestUsers();
if (!url || !serviceKey || !users) {
  console.error('Missing hosted settings: run with `node --env-file=.env.hosted` (see .env.hosted).');
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.error(`Refusing to run against ${url}: this script is for the hosted project.`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function testUserIds(): Promise<string[]> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const emails = new Set(users!.map((u) => u.email));
  return data.users.filter((u) => u.email && emails.has(u.email)).map((u) => u.id);
}

async function cleanup() {
  const ids = await testUserIds();
  if (!ids.length) return console.log('No test accounts yet; nothing to clean.');

  const { data: records, error } = await admin.from('lab_records').select('id').in('student_id', ids);
  if (error) throw error;
  let files = 0;
  for (const { id } of records ?? []) {
    const folder = `records/${id}`;
    const { data: objects } = await admin.storage.from(bucket).list(folder);
    const paths = (objects ?? []).map((o) => `${folder}/${o.name}`);
    if (paths.length) {
      await admin.storage.from(bucket).remove(paths);
      files += paths.length;
    }
  }
  if (records?.length) {
    const { error: deleteError } = await admin.from('lab_records').delete().in('student_id', ids);
    if (deleteError) throw deleteError;
  }
  const { data: labs, error: labError } = await admin.from('labs').delete().in('created_by', ids).select('id');
  if (labError) throw labError;
  console.log(`Removed ${records?.length ?? 0} test records, ${files} photo files and ${labs?.length ?? 0} test labs.`);
}

const command = process.argv[2];
if (command === 'users') {
  await ensureUsers(url, serviceKey, users);
  console.log(`Test accounts ready: ${users.map((u) => `${u.email} (${u.role})`).join(', ')}`);
} else if (command === 'cleanup') {
  await cleanup();
} else {
  console.error('Usage: hosted-tests.ts users | cleanup');
  process.exit(1);
}
