import { catalogRepository } from '../repositories/catalog.repository.js';

/**
 * Catalog rows come out of Postgres in snake_case; the API contract (and the
 * iOS decoders) are camelCase, so every catalog response is mapped here.
 */

interface LabRow { id: string; name: string; code: string }
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
});

export const catalogService = {
  async listLabs() {
    const rows = (await catalogRepository.listLabs()) as LabRow[];
    return rows.map(toLab);
  },

  async listExperiments(labId: string) {
    const rows = (await catalogRepository.listExperiments(labId)) as ExperimentRow[];
    return rows.map(toExperiment);
  },

  /** Experiment + its steps, sorted by display order. */
  async getExperiment(experimentId: string) {
    const row = (await catalogRepository.getExperimentWithSteps(experimentId)) as
      ExperimentRow & { steps: StepRow[] | null };
    const steps = (row.steps ?? []).map(toStep).sort((a, b) => a.order - b.order);
    return { ...toExperiment(row), steps };
  },
};
