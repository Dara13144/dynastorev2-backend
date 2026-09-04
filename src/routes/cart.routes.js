import { Router } from 'express';
import { getCart, addToCart, removeFromCart, clearCart } from '../controllers/cart.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(optionalAuth);

router.get('/', getCart);
router.post('/', addToCart);
router.delete('/:productId', removeFromCart);
router.delete('/', clearCart);

export default router;
