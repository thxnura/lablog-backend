import { Router } from 'express';
import { syncController } from '../controllers/sync.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { syncRequestSchema } from '../dto/sync.dto.js';

export const syncRoutes = Router();

syncRoutes.use(requireAuth);
syncRoutes.post('/sync', validateBody(syncRequestSchema), syncController.sync);
syncRoutes.get('/records', syncController.listRecords);
