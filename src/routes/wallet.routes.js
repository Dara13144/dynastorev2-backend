import { Router } from 'express';
import { getWallet, getTransactions, deposit } from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getWallet);
router.get('/transactions', getTransactions);
router.post('/deposit', deposit);

export default router;
