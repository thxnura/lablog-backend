import { recordRepository } from '../repositories/record.repository.js';
import type { SyncRequest } from '../dto/sync.dto.js';

export interface SyncItemResult {
  id: string;
  status: 'synced' | 'failed';
  error?: string;
}

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
        await recordRepository.upsertRecord(studentId, record);
        await recordRepository.upsertChildren(record);
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

  listByExperiment: (experimentId: string) =>
    recordRepository.listByExperiment(experimentId),
};
