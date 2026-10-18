import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { syncService } from '../services/sync.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { RecordsQuery } from '../dto/sync.dto.js';

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

  async listMine(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Unauthenticated');
      res.json(await syncService.listMine(req.user.id, req.hostname));
    } catch (err) {
      next(err);
    }
  },

  async listRecords(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const { experimentId } = res.locals.query as RecordsQuery;
      res.json(await syncService.listByExperiment(experimentId, req.hostname));
    } catch (err) {
      next(err);
    }
  },
};
