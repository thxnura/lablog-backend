import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const catalogRoutes = Router();

catalogRoutes.use(requireAuth);
catalogRoutes.get('/labs', catalogController.listLabs);
catalogRoutes.get('/labs/:labId/experiments', catalogController.listExperiments);
catalogRoutes.get('/experiments/:id', catalogController.getExperiment);
