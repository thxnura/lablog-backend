import { catalogRepository } from '../repositories/catalog.repository.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';

type User = NonNullable<AuthedRequest['user']>;

/**
 * Catalog rows come out of Postgres in snake_case; the API contract (and the
 * iOS decoders) are camelCase, so every catalog response is mapped here.
 */

interface LabRow { id: string; name: string; code: string; created_by?: string | null }
interface ExperimentRow { id: string; lab_id: string; title: string; description: string | null }
interface StepRow {
  id: string;
  experiment_id: string;
  order: number;
  title: string;
  instruction: string | null;
  requires_photo: boolean;
  min_duration_seconds: number | null;
  prerequisite_step_ids: string[] | null;
  guide_steps: string[] | null;
  safety_note: string | null;
  expected_result: string | null;
}

const toLab = (r: LabRow) => ({ id: r.id, name: r.name, code: r.code });

const toExperiment = (r: ExperimentRow) => ({
  id: r.id,
  labId: r.lab_id,
  title: r.title,
  description: r.description,
});

const toStep = (r: StepRow) => ({
  id: r.id,
  experimentId: r.experiment_id,
  order: r.order,
  title: r.title,
  instruction: r.instruction,
  requiresPhoto: r.requires_photo,
  minDurationSeconds: r.min_duration_seconds,
  prerequisiteStepIds: r.prerequisite_step_ids ?? [],
  guide: toGuide(r),
});

/** The step guide, or null when the step has no guide content. */
const toGuide = (r: StepRow) => {
  const steps = r.guide_steps ?? [];
  if (!steps.length && !r.safety_note && !r.expected_result) return null;
  return { steps, safety: r.safety_note, expected: r.expected_result };
};

/**
 * Who sees which lab (ADR-029): lecturers see every lab; a student sees the
 * open course labs (created_by null) and the labs they're enrolled in.
 */
async function visibleLabs(user: User): Promise<LabRow[]> {
  const rows = (await catalogRepository.listLabs()) as LabRow[];
  if (user.role === 'lecturer') return rows;
  const enrolled = await catalogRepository.enrolledLabIds(user.id);
  return rows.filter((r) => r.created_by == null || enrolled.has(r.id));
}

async function assertLabAccess(user: User, labId: string) {
  if (!(await visibleLabs(user)).some((l) => l.id === labId)) {
    throw new HttpError(403, "You're not enrolled in this lab");
  }
}

export const catalogService = {
  async listLabs(user: User) {
    return (await visibleLabs(user)).map(toLab);
  },

  async listExperiments(user: User, labId: string) {
    await assertLabAccess(user, labId);
    const rows = (await catalogRepository.listExperiments(labId)) as ExperimentRow[];
    return rows.map(toExperiment);
  },

  /** Experiment + its steps, sorted by display order. */
  async getExperiment(user: User, experimentId: string) {
    const row = (await catalogRepository.getExperimentWithSteps(experimentId)) as
      ExperimentRow & { steps: StepRow[] | null };
    await assertLabAccess(user, row.lab_id);
    const steps = (row.steps ?? []).map(toStep).sort((a, b) => a.order - b.order);
    return { ...toExperiment(row), steps };
  },
};
