import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dynastore_default_jwt_secret_please_set_in_env',

  // ABA PayWay
  ABA_PAYWAY: {
    MERCHANT_ID: process.env.ABA_PAYWAY_MERCHANT_ID || 'ec438782',
    API_KEY: process.env.ABA_PAYWAY_API_KEY || '',
    SECRET: process.env.ABA_PAYWAY_SECRET || '',
    ENVIRONMENT: process.env.ABA_PAYWAY_ENVIRONMENT || 'sandbox',
    API_URL: process.env.ABA_PAYWAY_API_URL || (
      (process.env.ABA_PAYWAY_ENVIRONMENT || 'sandbox') === 'production'
        ? 'https://checkout.payway.com.kh'
        : 'https://checkout-sandbox.payway.com.kh'
    ),
    RETURN_URL: process.env.ABA_PAYWAY_RETURN_URL || 'http://localhost:5173/payment/status',
    CANCEL_URL: process.env.ABA_PAYWAY_CANCEL_URL || 'http://localhost:5173/payment/status?status=cancelled',
    CALLBACK_URL: process.env.ABA_PAYWAY_CALLBACK_URL || 'http://localhost:5000/api/payments/aba/callback',
  },

  // CutLuy KHQR Payment Gateway
  CUTLUY: {
    API_KEY: process.env.CUTLUY_API_KEY || 'ck_live_3822DVV70cZHSfMgpifKLtdCEAZAVgPl',
    API_URL: process.env.CUTLUY_API_URL || 'https://cutluy.com/v1',
    WEBHOOK_SECRET: process.env.CUTLUY_WEBHOOK_SECRET || '',
  },

  // Telegram Notifications
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  }
};
