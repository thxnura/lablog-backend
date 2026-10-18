import { manageRepository } from '../repositories/manage.repository.js';
import { HttpError } from '../middleware/errorHandler.js';
import { validateStepGraph } from './step-graph.js';
import { catalogService } from './catalog.service.js';
import type { AuthedRequest } from '../middleware/auth.js';
import type { CreateExperiment, CreateLab } from '../dto/manage.dto.js';

/** Lecturers create labs and experiments and choose who can do them (ADR-029). */
export const manageService = {
  async listLabs() {
    const rows = await manageRepository.listLabs();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      /** A seeded course lab: open to every student, no enrolment. */
      isOpenToAll: r.created_by === null,
      experimentCount: r.experiments.length,
      studentIds: r.lab_enrolments.map((e) => e.student_id),
    }));
  },

  createLab(lecturerId: string, lab: CreateLab) {
    return manageRepository.createLab(lecturerId, lab);
  },

  /**
   * Returns the new experiment in the catalog's shape (with the server's step
   * ids), so the app can add it straight away instead of refetching the catalog.
   */
  async createExperiment(lecturer: NonNullable<AuthedRequest['user']>, labId: string, experiment: CreateExperiment) {
    if (!(await manageRepository.labExists(labId))) throw new HttpError(404, 'Lab not found');
    validateStepGraph(experiment.steps);
    const id = await manageRepository.createExperiment(labId, experiment);
    return catalogService.getExperiment(lecturer, id);
  },

  async setEnrolment(labId: string, studentIds: string[]) {
    if (!(await manageRepository.labExists(labId))) throw new HttpError(404, 'Lab not found');
    await manageRepository.setEnrolment(labId, [...new Set(studentIds)]);
  },

  listStudents() {
    return manageRepository.listStudents();
  },
};
