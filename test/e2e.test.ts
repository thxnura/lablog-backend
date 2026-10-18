/**
 * End-to-end tests against a REAL local Supabase stack (Postgres + Auth +
 * Storage), driving the Express app over HTTP exactly as the iOS app does.
 *
 *   supabase start && npm run local:setup && npm run test:e2e
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { supabaseAdmin } from '../src/config/supabase.js';
import { DEMO_USERS, ensureDemoUsers } from '../scripts/demo-users.js';

const PENDULUM = '22222222-2222-2222-2222-222222222224';
const STEP_1 = '33333333-0000-0000-0002-000000000001';
const STEP_2 = '33333333-0000-0000-0002-000000000002';
const STUDENT = DEMO_USERS[0].email;
const STUDENT_2 = DEMO_USERS[1].email;
const LECTURER = DEMO_USERS[2].email;

let server: Server;
let base = '';
const tokens: Record<string, string> = {};
const createdRecords: string[] = [];
const createdObjects: string[] = [];
const createdLabs: string[] = [];

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `sign-in failed for ${email}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function api(path: string, opts: { token?: string; method?: string; body?: unknown } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
}

const now = () => new Date().toISOString();

function makeRecord(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? randomUUID();
  createdRecords.push(id);
  return {
    id,
    experimentId: PENDULUM,
    status: 'submitted',
    latitude: 6.9271,
    longitude: 79.8612,
    createdAt: now(),
    submittedAt: now(),
    stepCompletions: [{ id: randomUUID(), stepId: STEP_1, completedAt: now() }],
    observations: [{ id: randomUUID(), text: 'Period 1.42 s at L = 0.50 m' }],
    attachments: [] as unknown[],
    ...overrides,
  };
}

before(async () => {
  await ensureDemoUsers(env.supabaseUrl, env.supabaseServiceRoleKey);
  for (const user of DEMO_USERS) tokens[user.email] = await signIn(user.email, user.password);
  server = createApp().listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (createdRecords.length) await supabaseAdmin.from('lab_records').delete().in('id', createdRecords);
  if (createdObjects.length) await supabaseAdmin.storage.from(env.storageBucket).remove(createdObjects);
  if (createdLabs.length) await supabaseAdmin.from('labs').delete().in('id', createdLabs);
  server?.close();
});

describe('auth', () => {
  test('health is public', async () => {
    const res = await api('/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  test('protected routes reject a missing or invalid token', async () => {
    assert.equal((await api('/labs')).status, 401);
    assert.equal((await api('/labs', { token: 'not-a-jwt' })).status, 401);
  });

  test('a valid student token is accepted', async () => {
    assert.equal((await api('/labs', { token: tokens[STUDENT] })).status, 200);
  });
});

describe('catalog', () => {
  test('labs, experiments and step graph come back in camelCase with guides', async () => {
    const labs = await api('/labs', { token: tokens[STUDENT] });
    assert.deepEqual(labs.body.map((l: { code: string }) => l.code).sort(), ['CHEM201', 'PHYS101']);

    const physics = labs.body.find((l: { code: string }) => l.code === 'PHYS101');
    const experiments = await api(`/labs/${physics.id}/experiments`, { token: tokens[STUDENT] });
    assert.equal(experiments.body[0].labId, physics.id);

    const detail = await api(`/experiments/${PENDULUM}`, { token: tokens[STUDENT] });
    assert.deepEqual(detail.body.steps.map((s: { order: number }) => s.order), [1, 2, 3, 4]);
    const timed = detail.body.steps[2];
    assert.equal(timed.minDurationSeconds, 30);
    assert.deepEqual(timed.prerequisiteStepIds, [STEP_2]);
    assert.ok(timed.guide.steps.length > 0, 'step guide is served');
  });
});

describe('sync', () => {
  test('a new record syncs, and re-sending it is idempotent', async () => {
    const record = makeRecord();
    const first = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });
    assert.deepEqual(first.body, { results: [{ id: record.id, status: 'synced' }] });

    const again = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });
    assert.equal(again.body.results[0].status, 'synced');

    const rows = await supabaseAdmin.from('lab_records').select('id').eq('id', record.id);
    const completions = await supabaseAdmin.from('step_completions').select('id').eq('record_id', record.id);
    assert.equal(rows.data?.length, 1);
    assert.equal(completions.data?.length, 1);
  });

  test('malformed payloads are rejected with 422', async () => {
    const res = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [] } });
    assert.equal(res.status, 422);
  });

  test('a student cannot overwrite another student’s record', async () => {
    const record = makeRecord();
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });

    const hijack = await api('/sync', { method: 'POST', token: tokens[STUDENT_2], body: { records: [record] } });
    assert.equal(hijack.body.results[0].status, 'failed');
    assert.match(hijack.body.results[0].error, /another student/);

    const owner = await supabaseAdmin.from('lab_records').select('student_id').eq('id', record.id).single();
    const { data: me } = await supabaseAdmin.auth.getUser(tokens[STUDENT]);
    assert.equal(owner.data?.student_id, me.user?.id);
  });

  test('child ids from another record are refused', async () => {
    const original = makeRecord();
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [original] } });
    const thief = makeRecord({ stepCompletions: original.stepCompletions });
    const res = await api('/sync', { method: 'POST', token: tokens[STUDENT_2], body: { records: [thief] } });
    assert.equal(res.body.results[0].status, 'failed');
    assert.match(res.body.results[0].error, /another record/);
  });
});

describe('photo evidence', () => {
  test('signed upload, idempotent retry, then sync with the storage path', async () => {
    const record = makeRecord();
    const attachmentId = randomUUID();
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

    for (let attempt = 0; attempt < 2; attempt++) {
      const signed = await api('/attachments/sign', {
        method: 'POST',
        token: tokens[STUDENT],
        body: { recordId: record.id, attachmentId },
      });
      assert.equal(signed.status, 200);
      assert.equal(signed.body.storagePath, `records/${record.id}/${attachmentId}.jpg`);
      const put = await fetch(signed.body.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: photo,
      });
      assert.ok(put.ok, `upload attempt ${attempt + 1} returned ${put.status}`);
      createdObjects.push(signed.body.storagePath);
    }

    record.attachments = [{ id: attachmentId, stepId: STEP_2, storagePath: `records/${record.id}/${attachmentId}.jpg` }];
    const res = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });
    assert.equal(res.body.results[0].status, 'synced');
  });
});

describe('changing networks', () => {
  test('signed URLs point at the host the app called, not the .env address', async () => {
    const recordId = randomUUID();
    createdRecords.push(recordId);
    // Same API, reached as "localhost" instead of 127.0.0.1 (like a phone using a new address).
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://localhost:${port}/api/attachments/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[STUDENT]}` },
      body: JSON.stringify({ recordId, attachmentId: randomUUID() }),
    });
    const signed = (await res.json()) as { signedUrl: string };
    assert.equal(new URL(signed.signedUrl).hostname, 'localhost');
    assert.equal(new URL(signed.signedUrl).port, new URL(env.supabaseUrl).port);
  });
});

async function uploadPhoto(recordId: string) {
  const attachmentId = randomUUID();
  const signed = await api('/attachments/sign', {
    method: 'POST', token: tokens[STUDENT], body: { recordId, attachmentId },
  });
  const put = await fetch(signed.body.signedUrl, {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array([0xff, 0xd8, 7, 0xff, 0xd9]),
  });
  assert.ok(put.ok);
  createdObjects.push(signed.body.storagePath);
  return { id: attachmentId, stepId: STEP_2, storagePath: signed.body.storagePath as string };
}

async function objectExists(path: string) {
  const folder = path.split('/').slice(0, -1).join('/');
  const { data } = await supabaseAdmin.storage.from(env.storageBucket).list(folder);
  return (data ?? []).some((o) => `${folder}/${o.name}` === path);
}

describe('editing drafts', () => {
  test('a retaken photo replaces the old one on the server', async () => {
    const record = makeRecord({ status: 'draft', submittedAt: null });
    const first = await uploadPhoto(record.id);
    record.attachments = [first];
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });

    const retake = await uploadPhoto(record.id);
    record.attachments = [retake];
    const res = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });
    assert.equal(res.body.results[0].status, 'synced');

    const rows = await supabaseAdmin.from('attachments').select('id').eq('record_id', record.id);
    assert.deepEqual(rows.data?.map((r) => r.id), [retake.id]);
    assert.equal(await objectExists(first.storagePath), false, 'old photo file removed');
    assert.equal(await objectExists(retake.storagePath), true);
  });

  test('upper-case ids, as the iOS app sends them, keep their photo', async () => {
    // Swift's JSONEncoder writes UUIDs in upper case; Postgres returns them in lower case.
    const record = makeRecord({ status: 'draft', submittedAt: null });
    const photo = await uploadPhoto(record.id);
    const fromApp = { ...record, id: record.id.toUpperCase(), attachments: [{ ...photo, id: photo.id.toUpperCase() }] };
    const res = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [fromApp] } });
    assert.equal(res.body.results[0].status, 'synced');

    const rows = await supabaseAdmin.from('attachments').select('id').eq('record_id', record.id);
    assert.deepEqual(rows.data?.map((r) => r.id), [photo.id]);
    assert.equal(await objectExists(photo.storagePath), true, 'the photo is still in Storage');
  });

  test('a discarded draft is deleted with its photos; retrying the tombstone is fine', async () => {
    const record = makeRecord({ status: 'draft', submittedAt: null });
    const photo = await uploadPhoto(record.id);
    record.attachments = [photo];
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });

    const tombstone = { ...record, deleted: true, stepCompletions: [], observations: [], attachments: [] };
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [tombstone] } });
      assert.equal(res.body.results[0].status, 'synced', `tombstone attempt ${attempt + 1}`);
    }
    const rows = await supabaseAdmin.from('lab_records').select('id').eq('id', record.id);
    assert.equal(rows.data?.length, 0);
    assert.equal(await objectExists(photo.storagePath), false);
  });

  test('submitted records cannot be deleted, and nobody can delete another student’s draft', async () => {
    const submitted = makeRecord();
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [submitted] } });
    const res = await api('/sync', {
      method: 'POST', token: tokens[STUDENT], body: { records: [{ ...submitted, deleted: true }] },
    });
    assert.equal(res.body.results[0].status, 'failed');
    assert.match(res.body.results[0].error, /cannot be deleted/);

    const draft = makeRecord({ status: 'draft', submittedAt: null });
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [draft] } });
    const other = await api('/sync', {
      method: 'POST', token: tokens[STUDENT_2], body: { records: [{ ...draft, deleted: true }] },
    });
    assert.equal(other.body.results[0].status, 'failed');
    const still = await supabaseAdmin.from('lab_records').select('id').eq('id', draft.id);
    assert.equal(still.data?.length, 1);
  });
});

describe('restoring a phone', () => {
  test('a student gets their own records back, with photo links; nobody else does', async () => {
    const record = makeRecord({ status: 'draft', submittedAt: null });
    const photo = await uploadPhoto(record.id);
    record.attachments = [photo];
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });

    const mine = await api('/records/mine', { token: tokens[STUDENT] });
    assert.equal(mine.status, 200);
    const restored = mine.body.find((r: { id: string }) => r.id === record.id);
    assert.ok(restored, 'the record comes back');
    assert.equal(restored.status, 'draft');
    assert.equal(restored.stepCompletions.length, 1);
    assert.equal(restored.observations[0].text, record.observations[0].text);
    assert.equal(restored.attachments[0].id, photo.id);
    const download = await fetch(restored.attachments[0].url);
    assert.equal(download.status, 200, 'its photo link works');

    const theirs = await api('/records/mine', { token: tokens[STUDENT_2] });
    assert.equal(theirs.status, 200);
    assert.equal(theirs.body.some((r: { id: string }) => r.id === record.id), false, 'not visible to another student');
    assert.equal((await api('/records/mine')).status, 401);
  });
});

describe('lecturers create labs (ADR-029)', () => {
  const steps = [
    { title: 'Weigh the sample', requiresPhoto: false },
    { title: 'Heat for two minutes', minDurationSeconds: 120, prerequisites: [1] },
    { title: 'Photograph the result', requiresPhoto: true, prerequisites: [1, 2] },
  ];

  test('students can\'t manage labs', async () => {
    assert.equal((await api('/manage/labs', { token: tokens[STUDENT] })).status, 403);
    const res = await api('/manage/labs', { method: 'POST', token: tokens[STUDENT], body: { code: 'X1', name: 'Nope' } });
    assert.equal(res.status, 403);
  });

  test('a new lab is visible only to the students enrolled in it', async () => {
    const code = `T${Date.now().toString().slice(-6)}`;
    const lab = await api('/manage/labs', { method: 'POST', token: tokens[LECTURER], body: { code, name: 'Test Lab' } });
    assert.equal(lab.status, 201);
    createdLabs.push(lab.body.id);
    const duplicate = await api('/manage/labs', { method: 'POST', token: tokens[LECTURER], body: { code, name: 'Again' } });
    assert.equal(duplicate.status, 409);

    const experiment = await api(`/manage/labs/${lab.body.id}/experiments`, {
      method: 'POST', token: tokens[LECTURER], body: { title: 'Heating test', steps },
    });
    assert.equal(experiment.status, 201);
    assert.equal(experiment.body.steps.length, 3, 'the new experiment comes back whole, so the app needs no refetch');

    const before = await api('/labs', { token: tokens[STUDENT] });
    assert.equal(before.body.some((l: { id: string }) => l.id === lab.body.id), false, 'not enrolled yet');
    assert.equal((await api(`/experiments/${experiment.body.id}`, { token: tokens[STUDENT] })).status, 403);

    const students = await api('/manage/students', { token: tokens[LECTURER] });
    const student = students.body.find((s: { email: string }) => s.email === STUDENT);
    assert.ok(student, 'the student is listed');
    assert.equal(students.body.some((s: { email: string }) => s.email === LECTURER), false, 'lecturers are not');
    const enrol = await api(`/manage/labs/${lab.body.id}/students`, {
      method: 'PUT', token: tokens[LECTURER], body: { studentIds: [student.id] },
    });
    assert.equal(enrol.status, 204);

    const after = await api('/labs', { token: tokens[STUDENT] });
    assert.ok(after.body.some((l: { id: string }) => l.id === lab.body.id), 'enrolled: the lab appears');
    assert.equal((await api('/labs', { token: tokens[STUDENT_2] })).body.some((l: { id: string }) => l.id === lab.body.id), false);

    const detail = await api(`/experiments/${experiment.body.id}`, { token: tokens[STUDENT] });
    assert.deepEqual(detail.body.steps.map((s: { order: number }) => s.order), [1, 2, 3]);
    const [first, second, third] = detail.body.steps;
    assert.equal(second.minDurationSeconds, 120);
    assert.deepEqual(second.prerequisiteStepIds, [first.id]);
    assert.deepEqual(third.prerequisiteStepIds, [first.id, second.id]);
    assert.equal(third.requiresPhoto, true);

    const managed = await api('/manage/labs', { token: tokens[LECTURER] });
    const row = managed.body.find((l: { id: string }) => l.id === lab.body.id);
    assert.deepEqual([row.isOpenToAll, row.experimentCount, row.studentIds], [false, 1, [student.id]]);
  });

  test('editing an experiment keeps step ids, and a step with student work can\'t be removed', async () => {
    const lab = await api('/manage/labs', {
      method: 'POST', token: tokens[LECTURER], body: { code: `E${Date.now().toString().slice(-6)}`, name: 'Edits' },
    });
    createdLabs.push(lab.body.id);
    await api(`/manage/labs/${lab.body.id}/students`, {
      method: 'PUT', token: tokens[LECTURER],
      body: { studentIds: [(await api('/manage/students', { token: tokens[LECTURER] })).body.find((s: { email: string }) => s.email === STUDENT).id] },
    });
    const created = await api(`/manage/labs/${lab.body.id}/experiments`, { method: 'POST', token: tokens[LECTURER], body: { title: 'Before', steps } });
    const [one, two, three] = created.body.steps;

    const edited = await api(`/manage/experiments/${created.body.id}`, {
      method: 'PUT', token: tokens[LECTURER],
      body: {
        title: 'After',
        steps: [
          { id: one.id, title: 'Weigh the sample carefully' },
          { id: two.id, title: two.title, minDurationSeconds: 60, prerequisites: [1] },
          { id: three.id, title: three.title, requiresPhoto: true, prerequisites: [2] },
          { title: 'Clean up', prerequisites: [3] },
        ],
      },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.title, 'After');
    assert.deepEqual(edited.body.steps.slice(0, 3).map((s: { id: string }) => s.id), [one.id, two.id, three.id], 'ids kept');
    assert.equal(edited.body.steps[0].title, 'Weigh the sample carefully');
    assert.equal(edited.body.steps[1].minDurationSeconds, 60);
    assert.deepEqual(edited.body.steps[3].prerequisiteStepIds, [three.id]);

    // A student completes step 2; removing it now would delete their work.
    const record = makeRecord({ experimentId: created.body.id, status: 'draft', submittedAt: null,
      stepCompletions: [{ id: randomUUID(), stepId: two.id, completedAt: now() }] });
    assert.equal((await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } })).body.results[0].status, 'synced');
    const removing = await api(`/manage/experiments/${created.body.id}`, {
      method: 'PUT', token: tokens[LECTURER], body: { title: 'After', steps: [{ id: one.id, title: 'Only one' }] },
    });
    assert.equal(removing.status, 409);
    assert.match(removing.body.error, /Step 2 has students' work/);
  });

  test('a step graph with a loop or a missing step is refused', async () => {
    const lab = await api('/manage/labs', {
      method: 'POST', token: tokens[LECTURER], body: { code: `L${Date.now().toString().slice(-6)}`, name: 'Loops' },
    });
    createdLabs.push(lab.body.id);
    const loop = await api(`/manage/labs/${lab.body.id}/experiments`, {
      method: 'POST', token: tokens[LECTURER],
      body: { title: 'Loop', steps: [{ title: 'A', prerequisites: [2] }, { title: 'B', prerequisites: [1] }] },
    });
    assert.equal(loop.status, 422);
    assert.match(loop.body.error, /loop/);
    const missing = await api(`/manage/labs/${lab.body.id}/experiments`, {
      method: 'POST', token: tokens[LECTURER], body: { title: 'Missing', steps: [{ title: 'A', prerequisites: [5] }] },
    });
    assert.equal(missing.status, 422);
  });
});

describe('lecturer view', () => {
  test('students get 403; lecturers get records with emails and working photo URLs', async () => {
    const record = makeRecord();
    const attachmentId = randomUUID();
    const signed = await api('/attachments/sign', {
      method: 'POST', token: tokens[STUDENT], body: { recordId: record.id, attachmentId },
    });
    const bytes = new Uint8Array([0xff, 0xd8, 9, 9, 9, 0xff, 0xd9]);
    await fetch(signed.body.signedUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes });
    createdObjects.push(signed.body.storagePath);
    record.attachments = [{ id: attachmentId, stepId: STEP_2, storagePath: signed.body.storagePath }];
    await api('/sync', { method: 'POST', token: tokens[STUDENT], body: { records: [record] } });

    assert.equal((await api(`/records?experimentId=${PENDULUM}`, { token: tokens[STUDENT] })).status, 403);
    assert.equal((await api('/records?experimentId=not-a-uuid', { token: tokens[LECTURER] })).status, 422);

    const list = await api(`/records?experimentId=${PENDULUM}`, { token: tokens[LECTURER] });
    assert.equal(list.status, 200);
    const mine = list.body.find((r: { id: string }) => r.id === record.id);
    assert.ok(mine, 'submitted record is visible to the lecturer');
    assert.equal(mine.studentEmail, STUDENT);
    assert.equal(mine.observations[0].text, 'Period 1.42 s at L = 0.50 m');

    const photo = await fetch(mine.attachments[0].url);
    assert.equal(photo.status, 200);
    assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), bytes);
  });
});
