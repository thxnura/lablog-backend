import { supabaseAdmin } from '../config/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { SyncRecord } from '../dto/sync.dto.js';

/** Idempotent upserts for synced lab records and their children. */
export const recordRepository = {
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

  /** Lecturer view: submitted records for an experiment. */
  async listByExperiment(experimentId: string) {
    const { data, error } = await supabaseAdmin
      .from('lab_records')
      .select(
        'id, student_id, experiment_id, status, latitude, longitude, created_at, submitted_at, step_completions(*), observations(*), attachments(*)',
      )
      .eq('experiment_id', experimentId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },
};
