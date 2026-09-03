import { Router } from 'express';
import { getSpinConfig, doSpin } from '../controllers/spin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public: get wheel segment config
router.get('/config', getSpinConfig);

// Auth required: perform a spin
router.post('/', requireAuth, doSpin);

export default router;
