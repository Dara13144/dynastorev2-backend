import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { ENV } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { db } from './utils/db.js';

// Route Imports
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import downloadRoutes from './routes/download.routes.js';
import path from 'path';
import fs from 'fs';
import adminRoutes from './routes/admin.routes.js';
import spinRoutes from './routes/spin.routes.js';
import { cutluyWebhook } from './controllers/payment.controller.js';

const app = express();

// Ensure local uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}
app.use('/uploads', express.static(uploadsDir));

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

app.set('trust proxy', true);

// Body Parsers (Rate Limiting completely disabled for unrestricted real-time polling)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Root Welcome & System Status Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    name: '🚀 DynaStore API Server',
    version: '2.0.0',
    description: 'Cambodian Digital Game Store API Backend with Bakong KHQR, Supabase, and Google OAuth',
    documentation: {
      health: '/api/health',
      products: '/api/products',
      categories: '/api/categories',
    },
    database: 'Supabase PostgreSQL Connected',
    payment_gateway: 'CutLuy Bakong KHQR Active',
    timestamp: new Date().toISOString(),
  });
});

// API Root Welcome & Endpoints Directory
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    name: '🚀 DynaStore REST API',
    version: '2.0.0',
    description: 'Cambodian Digital Game Store API Backend',
    endpoints: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        google: 'POST /api/auth/google',
        me: 'GET /api/auth/me',
      },
      products: 'GET /api/products',
      categories: 'GET /api/categories',
      cart: 'GET /api/cart',
      wallet: 'GET /api/wallet',
      cutluy_khqr: 'POST /api/payments/cutluy/create',
      admin: '/api/admin/dashboard',
    },
    database: 'Supabase PostgreSQL Connected',
    payment_gateway: 'CutLuy Bakong KHQR Active',
    timestamp: new Date().toISOString(),
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    store: 'DynaStore Cambodian Digital Game Store API',
    timestamp: new Date().toISOString(),
    abaEnvironment: ENV.ABA_PAYWAY.ENVIRONMENT,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Route alias (/api/verify-otp, /api/forgot-password, /api/reset-password)
app.use('/api/products', productRoutes);
app.use('/api/games', productRoutes); // Route alias for games
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/spin', spinRoutes);

// CutLuy Webhook Root Endpoint
app.post('/webhooks/cutluy', cutluyWebhook);

// 404 Handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`,
  });
});

// Central Error Handler
app.use(errorHandler);

const port = Number(process.env.PORT) || 5001;
const host = '0.0.0.0';

import { telegramService } from './services/telegram.service.js';
import { autoConfirmTelegramSession } from './controllers/auth.controller.js';

const server = app.listen(port, host, () => {
  console.log(`🚀 DynaStore API Server listening on http://${host}:${port}`);
  db.seedDemoAccounts().catch(() => {});
  // Start Telegram bot background polling for instant QR auto-login
  try {
    telegramService.startPolling(autoConfirmTelegramSession);
  } catch (e) {
    console.warn('Telegram bot polling notice:', e.message);
  }
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
});

// Process keep-alive anchor
setInterval(() => {}, 1000 * 60 * 60);

export default app;
