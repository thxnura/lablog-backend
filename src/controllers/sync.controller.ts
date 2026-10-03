import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { syncService } from '../services/sync.service.js';
import { HttpError } from '../middleware/errorHandler.js';

export const syncController = {
  async sync(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated');
      const results = await syncService.apply(req.user.id, req.body);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },

  async listRecords(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const experimentId = req.query.experimentId as string | undefined;
      if (!experimentId) throw new HttpError(400, 'experimentId is required');
      res.json(await syncService.listByExperiment(experimentId));
    } catch (err) {
      next(err);
    }
  },
};
