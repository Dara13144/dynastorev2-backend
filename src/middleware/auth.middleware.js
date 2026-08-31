import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { db } from '../utils/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      const user = await db.findUserById(decoded.id || decoded.sub);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists',
        });
      }

      if (user.is_active === false) {
        return res.status(403).json({
          success: false,
          message: 'User account has been disabled',
        });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token',
      });
    }
  } catch (error) {
    next(error);
  }
};
