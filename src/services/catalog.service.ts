import { catalogRepository } from '../repositories/catalog.repository.js';

export const catalogService = {
  listLabs: () => catalogRepository.listLabs(),
  listExperiments: (labId: string) => catalogRepository.listExperiments(labId),
  getExperiment: (experimentId: string) =>
    catalogRepository.getExperimentWithSteps(experimentId),
};
