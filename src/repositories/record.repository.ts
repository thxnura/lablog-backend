import { supabaseAdmin } from '../config/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { SyncRecord } from '../dto/sync.dto.js';
import { attachmentRepository } from './attachment.repository.js';

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

    // The payload carries the record's full set of photos, so any photo that
    // isn't in it was retaken or removed on the device: drop its row and file.
    await this.pruneAttachments(r.id, r.attachments.map((a) => a.id));
  },

  async pruneAttachments(recordId: string, keepIds: string[]) {
    const { data, error } = await supabaseAdmin
      .from('attachments')
      .select('id, storage_path')
      .eq('record_id', recordId);
    if (error) throw new HttpError(500, error.message);
    const stale = (data ?? []).filter((a) => !keepIds.includes(a.id));
    if (!stale.length) return;
    await attachmentRepository.removeObjects(stale.map((a) => a.storage_path));
    const { error: deleteError } = await supabaseAdmin
      .from('attachments')
      .delete()
      .in('id', stale.map((a) => a.id));
    if (deleteError) throw new HttpError(500, deleteError.message);
  },

  /**
   * A discarded draft: delete it with its children (FK cascade) and its photos.
   * Already gone is fine (a retried tombstone); a submitted record is evidence
   * and is never deleted.
   */
  async deleteDraft(recordId: string) {
    const { data: existing, error } = await supabaseAdmin
      .from('lab_records')
      .select('status')
      .eq('id', recordId)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!existing) return;
    if (existing.status !== 'draft') throw new HttpError(409, 'Submitted records cannot be deleted');
    await this.pruneAttachments(recordId, []);
    const { error: deleteError } = await supabaseAdmin.from('lab_records').delete().eq('id', recordId);
    if (deleteError) throw new HttpError(500, deleteError.message);
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

  /**
   * A student's own records, drafts and submitted, newest first: the app
   * restores them after signing in on a new or cleared phone.
   */
  async listByStudent(studentId: string): Promise<RecordRow[]> {
    const { data, error } = await supabaseAdmin
      .from('lab_records')
      .select(
        'id, student_id, experiment_id, status, latitude, longitude, created_at, submitted_at, step_completions(id, step_id, completed_at, note), observations(id, text), attachments(id, step_id, storage_path)',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
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
