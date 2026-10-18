import { Router } from 'express';
import { manageController } from '../controllers/manage.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createExperimentSchema, createLabSchema, enrolmentSchema } from '../dto/manage.dto.js';

/** Lecturer-only: create labs and experiments, and choose who can do them (ADR-029). */
export const manageRoutes = Router();

manageRoutes.use('/manage', requireAuth, requireRole('lecturer'));
manageRoutes.get('/manage/labs', manageController.listLabs);
manageRoutes.post('/manage/labs', validateBody(createLabSchema), manageController.createLab);
manageRoutes.post('/manage/labs/:labId/experiments', validateBody(createExperimentSchema), manageController.createExperiment);
manageRoutes.put('/manage/labs/:labId/students', validateBody(enrolmentSchema), manageController.setEnrolment);
manageRoutes.get('/manage/students', manageController.listStudents);
