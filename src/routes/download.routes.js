import { Router } from 'express';
import { getUserDownloads, getSecureDownloadUrl, streamFileFallback } from '../controllers/download.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Stream fallback for local test
router.get('/file-stream', streamFileFallback);

// Protected routes
router.get('/', requireAuth, getUserDownloads);
router.get('/:productId', requireAuth, getSecureDownloadUrl);

export default router;
