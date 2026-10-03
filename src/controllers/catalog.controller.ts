import type { NextFunction, Request, Response } from 'express';
import { catalogService } from '../services/catalog.service.js';

export const catalogController = {
  async listLabs(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.listLabs());
    } catch (err) {
      next(err);
    }
  },

  async listExperiments(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.listExperiments(req.params.labId));
    } catch (err) {
      next(err);
    }
  },

  async getExperiment(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await catalogService.getExperiment(req.params.id));
    } catch (err) {
      next(err);
    }
  },
};
