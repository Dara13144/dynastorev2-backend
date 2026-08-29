import { Router } from 'express';
import multer from 'multer';
import {
  getDashboardMetrics,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminUsers,
  updateAdminUser,
  getAdminOrders,
  updateAdminOrderStatus,
  adjustUserWallet,
  getAdminLogs,
  uploadStorageFile,
} from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

const router = Router();

// Protect all admin routes with auth and admin role
router.use(requireAuth, requireAdmin);

router.get('/dashboard', getDashboardMetrics);

// Products
router.get('/products', getAdminProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Users
router.get('/users', getAdminUsers);
router.put('/users/:id', updateAdminUser);

// Orders
router.get('/orders', getAdminOrders);
router.put('/orders/:id', updateAdminOrderStatus);

// Wallet Audited Adjustments
router.post('/wallet/adjust', adjustUserWallet);

// Logs
router.get('/logs', getAdminLogs);

// Storage Upload
router.post('/upload', upload.single('file'), uploadStorageFile);

export default router;
