import { Router } from 'express';
import { attachmentController } from '../controllers/attachment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { signUploadSchema } from '../dto/attachment.dto.js';

export const attachmentRoutes = Router();

attachmentRoutes.use(requireAuth);
attachmentRoutes.post(
  '/attachments/sign',
  validateBody(signUploadSchema),
  attachmentController.signUpload,
);
