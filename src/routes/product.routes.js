import { Router } from 'express';
import {
  getAllProducts,
  getProductBySlug,
  getFeaturedAndSpotlight,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/featured', getFeaturedAndSpotlight);
router.get('/:slug', getProductBySlug);
router.post('/', requireAuth, requireAdmin, createProductHandler);
router.put('/:id', requireAuth, requireAdmin, updateProductHandler);
router.delete('/:id', requireAuth, requireAdmin, deleteProductHandler);

export default router;
