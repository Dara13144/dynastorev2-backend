import { Router } from 'express';
import { createOrder, getUserOrders, getOrderById, validateCoupon } from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Allow public/guest or authenticated discount code preview
router.post('/validate-coupon', validateCoupon);

router.use(requireAuth);

router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);

export default router;
