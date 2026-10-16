import { recordRepository } from '../repositories/record.repository.js';
import { attachmentService } from './attachment.service.js';
import type { SyncRequest } from '../dto/sync.dto.js';

export interface SyncItemResult {
  id: string;
  status: 'synced' | 'failed';
  error?: string;
}

/** Postgres returns e.g. "2026-10-14 15:43:52.123456+00"; the API contract is ISO 8601 UTC. */
const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);

export const syncService = {
  /**
   * Upserts each record (idempotent by client UUID) and reports per-item
   * status so the app can mark each local record synced/failed. Server is
   * authoritative; a failure on one record does not abort the others.
   */
  async apply(studentId: string, body: SyncRequest): Promise<SyncItemResult[]> {
    const results: SyncItemResult[] = [];
    for (const record of body.records) {
      try {
        await recordRepository.assertOwnership(studentId, record);
        if (record.deleted) {
          // Tombstone from a discarded draft: idempotent, drafts only.
          await recordRepository.deleteDraft(record.id);
        } else {
          await recordRepository.upsertRecord(studentId, record);
          await recordRepository.upsertChildren(record);
        }
        results.push({ id: record.id, status: 'synced' });
      } catch (err) {
        results.push({
          id: record.id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }
    return results;
  },

  /**
   * Lecturer view: camelCase records with the student's email and a
   * time-limited (1 h) signed URL for each photo in the private bucket.
   */
  async listByExperiment(experimentId: string, requestHost?: string) {
    const rows = await recordRepository.listByExperiment(experimentId);
    const emails = await recordRepository.studentEmails(rows.map((r) => r.student_id));
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        studentId: r.student_id,
        studentEmail: emails.get(r.student_id) ?? null,
        experimentId: r.experiment_id,
        status: r.status,
        latitude: r.latitude,
        longitude: r.longitude,
        createdAt: iso(r.created_at),
        submittedAt: iso(r.submitted_at),
        stepCompletions: r.step_completions.map((c) => ({
          id: c.id,
          stepId: c.step_id,
          completedAt: iso(c.completed_at),
          note: c.note,
        })),
        observations: r.observations.map((o) => ({ id: o.id, text: o.text })),
        attachments: await Promise.all(
          r.attachments.map(async (a) => ({
            id: a.id,
            stepId: a.step_id,
            storagePath: a.storage_path,
            url: await attachmentService.getDownloadUrl(a.storage_path, requestHost),
          })),
        ),
      })),
    );
  },
};
