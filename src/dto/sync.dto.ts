import { z } from 'zod';

/**
 * Sync contract: the iOS app pushes a batch of locally-created lab records,
 * each with its step completions, observations, and attachment metadata.
 * All ids are client-generated UUIDs so upserts are idempotent.
 */

export const stepCompletionSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
  completedAt: z.string().datetime(),
  note: z.string().max(2000).optional(),
});

export const observationSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(5000),
});

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid().nullable().optional(),
  storagePath: z.string().min(1), // path inside the Storage bucket after upload
});

export const syncRecordSchema = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  status: z.enum(['draft', 'submitted']),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  createdAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable().optional(),
  stepCompletions: z.array(stepCompletionSchema).default([]),
  observations: z.array(observationSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
});

export const syncRequestSchema = z.object({
  records: z.array(syncRecordSchema).min(1).max(100),
});

export type SyncRecord = z.infer<typeof syncRecordSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
