import { supabaseAdmin } from '../config/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { SyncRecord } from '../dto/sync.dto.js';

/** Rows as they come back from the lecturer query. */
export interface RecordRow {
  id: string;
  student_id: string;
  experiment_id: string;
  status: 'draft' | 'submitted';
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  submitted_at: string | null;
  step_completions: { id: string; step_id: string; completed_at: string; note: string | null }[];
  observations: { id: string; text: string }[];
  attachments: { id: string; step_id: string | null; storage_path: string }[];
}

/** Idempotent upserts for synced lab records and their children. */
export const recordRepository = {
  /**
   * Client UUIDs make retries idempotent, but they also mean a client could
   * send someone else's id. Before any upsert, refuse ids that already belong
   * to another student's record (or, for children, to another record).
   */
  async assertOwnership(studentId: string, r: SyncRecord) {
    const { data: existing, error } = await supabaseAdmin
      .from('lab_records')
      .select('student_id')
      .eq('id', r.id)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (existing && existing.student_id !== studentId) {
      throw new HttpError(403, 'Record belongs to another student');
    }

    const children: [string, string[]][] = [
      ['step_completions', r.stepCompletions.map((c) => c.id)],
      ['observations', r.observations.map((o) => o.id)],
      ['attachments', r.attachments.map((a) => a.id)],
    ];
    for (const [table, ids] of children) {
      if (!ids.length) continue;
      const { data, error: childError } = await supabaseAdmin
        .from(table)
        .select('id')
        .in('id', ids)
        .neq('record_id', r.id);
      if (childError) throw new HttpError(500, childError.message);
      if (data?.length) throw new HttpError(409, `${table} id already used by another record`);
    }
  },

  async upsertRecord(studentId: string, r: SyncRecord) {
    const { error } = await supabaseAdmin.from('lab_records').upsert(
      {
        id: r.id,
        student_id: studentId,
        experiment_id: r.experimentId,
        status: r.status,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        created_at: r.createdAt,
        submitted_at: r.submittedAt ?? null,
      },
      { onConflict: 'id' },
    );
    if (error) throw new HttpError(500, error.message);
  },

  async upsertChildren(r: SyncRecord) {
    if (r.stepCompletions.length) {
      const { error } = await supabaseAdmin.from('step_completions').upsert(
        r.stepCompletions.map((c) => ({
          id: c.id,
          record_id: r.id,
          step_id: c.stepId,
          completed_at: c.completedAt,
          note: c.note ?? null,
        })),
        { onConflict: 'id' },
      );
      if (error) throw new HttpError(500, error.message);
    }

    if (r.observations.length) {
      const { error } = await supabaseAdmin.from('observations').upsert(
        r.observations.map((o) => ({ id: o.id, record_id: r.id, text: o.text })),
        { onConflict: 'id' },
      );
      if (error) throw new HttpError(500, error.message);
    }

    if (r.attachments.length) {
      const { error } = await supabaseAdmin.from('attachments').upsert(
        r.attachments.map((a) => ({
          id: a.id,
          record_id: r.id,
          step_id: a.stepId ?? null,
          storage_path: a.storagePath,
        })),
        { onConflict: 'id' },
      );
      if (error) throw new HttpError(500, error.message);
    }
  },

  /** Lecturer view: submitted records for an experiment, newest first. */
  async listByExperiment(experimentId: string): Promise<RecordRow[]> {
    const { data, error } = await supabaseAdmin
      .from('lab_records')
      .select(
        'id, student_id, experiment_id, status, latitude, longitude, created_at, submitted_at, step_completions(id, step_id, completed_at, note), observations(id, text), attachments(id, step_id, storage_path)',
      )
      .eq('experiment_id', experimentId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return (data ?? []) as RecordRow[];
  },

  /** Student emails for the lecturer view (auth.users is not in the public schema). */
  async studentEmails(studentIds: string[]): Promise<Map<string, string>> {
    const emails = new Map<string, string>();
    for (const id of new Set(studentIds)) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      if (data.user?.email) emails.set(id, data.user.email);
    }
    return emails;
  },
};
