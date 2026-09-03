import { Router } from 'express';
import { getSpinConfig, doSpin } from '../controllers/spin.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public: get wheel segment config
router.get('/config', getSpinConfig);

// Spin route: supports authenticated user or verified paid orderId
router.post('/', optionalAuth, doSpin);

export default router;
