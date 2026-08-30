import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 10000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://dynastorev2-frontend.vercel.app',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://zuhbtivatfaxxbuilltj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1aGJ0aXZhdGZheHhidWlsbHRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzk3OTA0OSwiZXhwIjoyMTAzNTU1MDQ5fQ.JK3FeSbQQH95D8BgdGO_vSCk4MJF0FdlsCWevUVv-IE',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1aGJ0aXZhdGZheHhidWlsbHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NzkwNDksImV4cCI6MjEwMzU1NTA0OX0.WcnHZLuWMpZYj5PReyiMgvwSx46DRAlvl99o0SmQtAk',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dynastore_dev_secret_jwt_key_2026_secure_tokens',

  // Google OAuth
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  },

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
  },

  // SMTP / Gmail Email Configuration
  SMTP: {
    HOST: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
    PORT: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
    SECURE: process.env.SMTP_SECURE === 'true',
    USER: process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '',
    PASS: process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '',
    FROM: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'DynaStore Security <no-reply@dynastore.com>',
  },
};
