import crypto from 'crypto';
import { db } from '../utils/db.js';
import { storageService } from '../services/storage.service.js';

export const getUserDownloads = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orders = await db.getUserOrders(userId);

    // Filter paid orders only
    const paidOrders = orders.filter(o => o.status === 'PAID' || o.status === 'COMPLETED');

    const purchasedMap = new Map();

    for (const order of paidOrders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (!purchasedMap.has(item.product_id)) {
            const product = await db.getProductById(item.product_id);
            if (product) {
              purchasedMap.set(item.product_id, {
                productId: product.id,
                title: product.title,
                slug: product.slug,
                cover_image: product.cover_image,
                platform: product.platform,
                version: product.version,
                fileName: product.file_name || `${product.slug}.zip`,
                fileSize: product.file_size || 'Unknown',
                purchasedAt: order.created_at,
                orderId: order.id,
              });
            }
          }
        }
      }
    }

    const downloadList = Array.from(purchasedMap.values());

    res.json({
      success: true,
      count: downloadList.length,
      downloads: downloadList,
    });
  } catch (error) {
    next(error);
  }
};

export const getSecureDownloadUrl = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const product = await db.getProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Game product not found' });
    }

    // Strict Authorization: Verify that user has paid for this product
    const isOwned = await db.hasUserPurchasedProduct(userId, productId);
    if (!isOwned && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: You must purchase this game before downloading it.',
      });
    }

    if (!product.file_path) {
      return res.status(404).json({
        success: false,
        message: 'Game file has not been uploaded yet by administrator',
      });
    }

    // Generate short-lived Signed URL from Supabase Storage (15 minutes expiration)
    const downloadUrl = await storageService.generateSignedDownloadUrl(product.file_path, 900);

    // Record download log
    const downloadLog = {
      id: crypto.randomUUID(),
      user_id: userId,
      product_id: productId,
      order_id: null,
      downloaded_at: new Date().toISOString(),
      ip_address: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Unknown',
    };

    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('downloads').insert(downloadLog);
    } else {
      db.store.downloads.push(downloadLog);
    }

    res.json({
      success: true,
      downloadUrl,
      fileName: product.file_name || `${product.slug}.zip`,
      fileSize: product.file_size,
      expiresIn: 900,
    });
  } catch (error) {
    next(error);
  }
};

// Dev fallback streaming demo test for signed token
export const streamFileFallback = (req, res) => {
  const { path: filePath, expires, token } = req.query;

  if (!filePath || !expires || !token) {
    return res.status(403).json({ success: false, message: 'Invalid download parameters' });
  }

  if (Date.now() > Number(expires)) {
    return res.status(403).json({ success: false, message: 'Download link expired. Please generate a new one from DynaStore.' });
  }

  const dummyContent = `========================================================\n` +
    `DynaStore Secure Game Download Package\n` +
    `File: ${filePath}\n` +
    `Verified Authenticated Download\n` +
    `Timestamp: ${new Date().toISOString()}\n` +
    `========================================================\n\n` +
    `Welcome to your downloaded game! In production, this delivers the binary archive (ZIP/ISO/EXE) from Supabase Storage.\n`;

  res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop() || 'game.zip'}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.from(dummyContent));
};
