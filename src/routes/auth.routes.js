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
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/otp-login', loginWithOtp);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
