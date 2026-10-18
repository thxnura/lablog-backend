import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { manageService } from '../services/manage.service.js';
import type { CreateExperiment, CreateLab, Enrolment } from '../dto/manage.dto.js';

export const manageController = {
  async listLabs(_req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await manageService.listLabs());
    } catch (err) {
      next(err);
    }
  },

  async createLab(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await manageService.createLab(req.user!.id, req.body as CreateLab));
    } catch (err) {
      next(err);
    }
  },

  async createExperiment(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await manageService.createExperiment(req.user!, req.params.labId, req.body as CreateExperiment));
    } catch (err) {
      next(err);
    }
  },

  async updateExperiment(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await manageService.updateExperiment(req.user!, req.params.experimentId, req.body as CreateExperiment));
    } catch (err) {
      next(err);
    }
  },

  async setEnrolment(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      await manageService.setEnrolment(req.params.labId, (req.body as Enrolment).studentIds);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

  async listStudents(_req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await manageService.listStudents());
    } catch (err) {
      next(err);
    }
  },
};
