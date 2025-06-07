import { Router, type IRouter } from 'express';
import wikiRoutes from './wiki.routes';

const router: IRouter = Router();

/**
 * GET /api/health-check - Check service health
 */
router.get('/health-check', (req, res) => res.send('OK'));

// Mount wiki routes at /wiki
router.use('/wiki', wikiRoutes);

export default router;
