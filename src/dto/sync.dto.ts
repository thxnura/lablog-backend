import { z } from 'zod';

/**
 * Sync contract: the iOS app pushes a batch of locally-created lab records,
 * each with its step completions, observations, and attachment metadata.
 * All ids are client-generated UUIDs so upserts are idempotent.
 */

/**
 * A UUID in lower case. Swift's JSONEncoder sends upper case and Postgres
 * returns lower case, so ids are normalised here, before any code compares them.
 */
export const uuid = () => z.string().uuid().transform((id) => id.toLowerCase());

export const stepCompletionSchema = z.object({
  id: uuid(),
  stepId: uuid(),
  completedAt: z.string().datetime(),
  note: z.string().max(2000).optional(),
});

export const observationSchema = z.object({
  id: uuid(),
  text: z.string().max(5000),
});

export const attachmentSchema = z.object({
  id: uuid(),
  stepId: uuid().nullable().optional(),
  storagePath: z.string().min(1), // path inside the Storage bucket after upload
});

export const syncRecordSchema = z.object({
  id: uuid(),
  experimentId: uuid(),
  status: z.enum(['draft', 'submitted']),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  createdAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable().optional(),
  stepCompletions: z.array(stepCompletionSchema).default([]),
  observations: z.array(observationSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
  /** Tombstone: the student discarded this draft on the device. */
  deleted: z.boolean().optional(),
});

export const syncRequestSchema = z.object({
  records: z.array(syncRecordSchema).min(1).max(100),
});

export type SyncRecord = z.infer<typeof syncRecordSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/** `GET /api/records?experimentId=` (lecturer view). */
export const recordsQuerySchema = z.object({
  experimentId: uuid(),
});

export type RecordsQuery = z.infer<typeof recordsQuerySchema>;
