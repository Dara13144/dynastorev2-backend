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
  getBackups,
  createSystemBackup,
  downloadBackup,
  exportLiveBackup,
  restoreSystemBackup,
  deleteSystemBackup,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/admin.controller.js';
import {
  adminGetSegments,
  adminCreateSegment,
  adminUpdateSegment,
  adminDeleteSegment,
} from '../controllers/spin.controller.js';
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

// ==========================================
// System Backup & Recovery Routes
// ==========================================
router.get('/backups', getBackups);
router.post('/backups', createSystemBackup);
router.get('/backups/export', exportLiveBackup);
router.get('/backups/:id/download', downloadBackup);
router.post('/backups/restore', upload.single('backupFile'), restoreSystemBackup);
router.delete('/backups/:id', deleteSystemBackup);

// ==========================================
// Discount / Promo Code Routes
// ==========================================
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// ==========================================
// Spin Wheel Segment Admin Routes
// ==========================================
router.get('/spin', adminGetSegments);
router.post('/spin', adminCreateSegment);
router.put('/spin/:id', adminUpdateSegment);
router.delete('/spin/:id', adminDeleteSegment);

export default router;
