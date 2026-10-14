import { Router } from 'express';
import { syncController } from '../controllers/sync.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { recordsQuerySchema, syncRequestSchema } from '../dto/sync.dto.js';

export const syncRoutes = Router();

syncRoutes.use(requireAuth);
syncRoutes.post('/sync', validateBody(syncRequestSchema), syncController.sync);
// Lecturer view: submitted records for one experiment, with signed photo URLs.
syncRoutes.get(
  '/records',
  requireRole('lecturer'),
  validateQuery(recordsQuerySchema),
  syncController.listRecords,
);
