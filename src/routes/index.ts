import { Router } from 'express';
import { catalogRoutes } from './catalog.routes.js';
import { syncRoutes } from './sync.routes.js';
import { attachmentRoutes } from './attachment.routes.js';
import { manageRoutes } from './manage.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
// Before the catalog router, whose auth middleware runs for every path it sees.
apiRouter.use(manageRoutes);
apiRouter.use(catalogRoutes);
apiRouter.use(syncRoutes);
apiRouter.use(attachmentRoutes);
