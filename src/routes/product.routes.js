import { Router } from 'express';
import { getAllProducts, getProductBySlug, getFeaturedAndSpotlight } from '../controllers/product.controller.js';

const router = Router();

router.get('/', getAllProducts);
router.get('/featured', getFeaturedAndSpotlight);
router.get('/:slug', getProductBySlug);

export default router;
