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
import adminRoutes from './routes/admin.routes.js';
import { cutluyWebhook } from './controllers/payment.controller.js';

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});

app.use('/api', apiLimiter);

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

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
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/admin', adminRoutes);

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

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`🚀 DynaStore API Server is running on http://127.0.0.1:${PORT}`);
  console.log(`💳 ABA PayWay configured for: [${ENV.ABA_PAYWAY.ENVIRONMENT.toUpperCase()}]`);
  console.log(`🌐 Frontend Allowed: ${ENV.FRONTEND_URL}`);
  await db.seedDemoAccounts();
});

server.on('error', (err) => {
  if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
    const fallbackPort = 5001;
    console.warn(`⚠️ Port ${PORT} unavailable (${err.code}). Falling back to port ${fallbackPort}...`);
    app.listen(fallbackPort, '127.0.0.1', async () => {
      console.log(`🚀 DynaStore API Server is running on http://127.0.0.1:${fallbackPort}`);
      await db.seedDemoAccounts();
    });
  } else {
    console.error('Server error:', err);
  }
});

export default app;
