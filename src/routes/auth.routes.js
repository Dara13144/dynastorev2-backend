import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  logout,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  sendOtp,
  resendOtp,
  verifyOtp,
  loginWithOtp,
  telegramLogin,
  createTelegramQrSession,
  getTelegramQrStatus,
  confirmTelegramQrSession,
  createDeviceQrSession,
  getDeviceQrStatus,
  authorizeDeviceQrSession,
  confirmDeviceQrSession,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/telegram', telegramLogin);
router.post('/telegram/qr/create', createTelegramQrSession);
router.get('/telegram/qr/status/:sessionId', getTelegramQrStatus);
router.post('/telegram/qr/confirm', confirmTelegramQrSession);
router.post('/device-qr/create', createDeviceQrSession);
router.get('/device-qr/status/:sessionId', getDeviceQrStatus);
router.post('/device-qr/confirm', confirmDeviceQrSession);
router.post('/device-qr/authorize', requireAuth, authorizeDeviceQrSession);
router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/otp-login', loginWithOtp);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.get('/profile', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
