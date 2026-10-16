import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { attachmentService } from '../services/attachment.service.js';

export const attachmentController = {
  async signUpload(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      res.json(await attachmentService.signUpload(req.body, req.hostname));
    } catch (err) {
      next(err);
    }
  },
};
