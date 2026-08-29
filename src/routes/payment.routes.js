import { Router } from 'express';
import {
  createPayment,
  getPaymentStatus,
  abaCallback,
  createCutLuyPayment,
  checkCutLuyPayment,
  cutluyWebhook,
} from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// ABA PayWay endpoints
router.post('/aba/callback', abaCallback);
router.get('/status/:transactionId', getPaymentStatus);
router.post('/create', requireAuth, createPayment);

// CutLuy KHQR endpoints
router.post('/cutluy/create', requireAuth, createCutLuyPayment);
router.get('/cutluy/status/:id', checkCutLuyPayment);
router.post('/cutluy/webhook', cutluyWebhook);

export default router;
