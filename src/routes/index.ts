import { Router } from 'express';
import { catalogRoutes } from './catalog.routes.js';
import { syncRoutes } from './sync.routes.js';
import { attachmentRoutes } from './attachment.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
apiRouter.use(catalogRoutes);
apiRouter.use(syncRoutes);
apiRouter.use(attachmentRoutes);
