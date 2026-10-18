import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { catalogService } from '../services/catalog.service.js';

export const catalogController = {
  async listLabs(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.listLabs(req.user!));
    } catch (err) {
      next(err);
    }
  },

  async listExperiments(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.listExperiments(req.user!, req.params.labId));
    } catch (err) {
      next(err);
    }
  },

  async getExperiment(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.getExperiment(req.user!, req.params.id));
    } catch (err) {
      next(err);
    }
  },
};
