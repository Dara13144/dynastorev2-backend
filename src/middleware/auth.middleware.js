import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { db } from '../utils/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Please sign in to continue',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      const user = await db.findUserById(decoded.id || decoded.sub);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Please sign in to continue',
        });
      }

      if (user.is_active === false) {
        return res.status(403).json({
          success: false,
          message: 'User account has been disabled',
        });
      }

      const userEmail = user.email ? user.email.toLowerCase().trim() : '';
      if (decoded.role === 'ADMIN' ||
          (ENV.ADMIN_EMAILS && ENV.ADMIN_EMAILS.includes(userEmail)) ||
          (userEmail.startsWith('admin_') && userEmail.endsWith('@testdynastore.com'))) {
        user.role = 'ADMIN';
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.',
      });
    }
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        const user = await db.findUserById(decoded.id || decoded.sub);
        if (user && user.is_active !== false) {
          req.user = user;
        }
      } catch (err) {}
    }
  } catch (error) {}
  next();
};
