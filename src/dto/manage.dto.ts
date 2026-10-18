import { z } from 'zod';
import { uuid } from './sync.dto.js';

/** Lecturer-only contracts for creating labs and experiments (ADR-029). */

export const createLabSchema = z.object({
  code: z.string().trim().min(2).max(16).transform((code) => code.toUpperCase()),
  name: z.string().trim().min(2).max(80),
});

/**
 * One step of an experiment. Steps are numbered by their position (1…n);
 * `prerequisites` lists the numbers of the steps that must be done first.
 * When editing, an existing step keeps its `id`, so students' work on it stays.
 */
export const newStepSchema = z.object({
  id: uuid().optional(),
  title: z.string().trim().min(1).max(120),
  instruction: z.string().trim().max(1000).optional(),
  requiresPhoto: z.boolean().default(false),
  minDurationSeconds: z.number().int().min(1).max(86_400).nullable().optional(),
  prerequisites: z.array(z.number().int().min(1)).max(30).default([]),
});

export const createExperimentSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  steps: z.array(newStepSchema).min(1).max(30),
});

export const enrolmentSchema = z.object({
  studentIds: z.array(uuid()).max(500),
});

export type CreateLab = z.infer<typeof createLabSchema>;
export type NewStep = z.infer<typeof newStepSchema>;
export type CreateExperiment = z.infer<typeof createExperimentSchema>;
export type Enrolment = z.infer<typeof enrolmentSchema>;
