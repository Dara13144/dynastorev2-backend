import crypto from 'crypto';
import fs from 'fs';
import { db } from '../utils/db.js';
import { storageService } from '../services/storage.service.js';
import { backupService } from '../services/backup.service.js';

export const getDashboardMetrics = async (req, res, next) => {
  try {
    let users = [];
    let products = [];
    let orders = [];
    let payments = [];
    let downloads = [];

    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const [uRes, pRes, oRes, payRes, dRes] = await Promise.all([
        supabase.from('profiles').select('id, balance, created_at'),
        supabase.from('products').select('id, is_published, price'),
        supabase.from('orders').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('downloads').select('*'),
      ]);
      users = (uRes.data && uRes.data.length > 0) ? uRes.data : db.store.profiles;
      products = (pRes.data && pRes.data.length > 0) ? pRes.data : db.store.products;
      orders = (oRes.data && oRes.data.length > 0) ? oRes.data : db.store.orders;
      payments = (payRes.data && payRes.data.length > 0) ? payRes.data : db.store.payments;
      downloads = (dRes.data && dRes.data.length > 0) ? dRes.data : db.store.downloads;
    } else {
      users = db.store.profiles;
      products = db.store.products;
      orders = db.store.orders;
      payments = db.store.payments;
      downloads = db.store.downloads;
    }

    const paidOrders = orders.filter(o => o.status === 'PAID' || o.status === 'COMPLETED');
    const pendingOrders = orders.filter(o => o.status === 'PENDING');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRevenue = paidOrders
      .filter(o => o.created_at && o.created_at.startsWith(todayStr))
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const walletDeposits = payments
      .filter(p => p.payment_type === 'WALLET_DEPOSIT' && p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    res.json({
      success: true,
      metrics: {
        totalUsers: users.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        todayRevenue: Number(todayRevenue.toFixed(2)),
        walletDeposits: Number(walletDeposits.toFixed(2)),
        totalDownloads: downloads.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Products Management
export const getAdminProducts = async (req, res, next) => {
  try {
    const products = await db.getProducts({ isPublished: undefined });
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const {
      title,
      description,
      short_description,
      price,
      discount_price,
      category_id,
      platform,
      version,
      developer,
      publisher,
      cover_image,
      screenshots,
      file_path,
      file_name,
      file_size,
      system_requirements,
      is_published = true,
    } = req.body;

    if (!title || price === undefined) {
      return res.status(400).json({ success: false, message: 'Title and price are required' });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const newProduct = {
      id: crypto.randomUUID(),
      title,
      slug: `${slug}-${crypto.randomBytes(2).toString('hex')}`,
      description: description || '',
      short_description: short_description || '',
      price: (price === '' || price === null || price === undefined) ? 0 : Number(price) || 0,
      discount_price: (discount_price !== '' && discount_price !== null && discount_price !== undefined) ? Number(discount_price) : null,
      category_id: category_id ? String(category_id) : null,
      platform: platform || 'PC',
      version: version || '1.0.0',
      developer: developer || '',
      publisher: publisher || '',
      release_date: new Date().toISOString().split('T')[0],
      cover_image: cover_image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
      screenshots: screenshots || [],
      file_path: file_path || '',
      file_name: file_name || `${slug}.zip`,
      file_size: file_size || '1.0 GB',
      system_requirements: system_requirements || {},
      is_published: Boolean(is_published),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        const { data, error } = await supabase.from('products').insert(newProduct).select().single();
        if (!error && data) {
          await db.createAuditLog({
            adminId: req.user.id,
            action: 'CREATE_PRODUCT',
            targetType: 'PRODUCT',
            targetId: data.id,
            metadata: { title },
          });
          return res.status(201).json({ success: true, product: data });
        }
      } catch (e) {
        console.warn('Supabase createProduct notice:', e.message);
      }
    }

    db.store.products.push(newProduct);
    await db.createAuditLog({
      adminId: req.user.id,
      action: 'CREATE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: newProduct.id,
      metadata: { title },
    });

    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // Sanitize incoming fields to prevent database numeric/UUID errors
    const updates = {};
    const allowedFields = [
      'title',
      'slug',
      'description',
      'short_description',
      'price',
      'discount_price',
      'category_id',
      'platform',
      'version',
      'developer',
      'publisher',
      'release_date',
      'cover_image',
      'screenshots',
      'file_path',
      'file_name',
      'file_size',
      'system_requirements',
      'is_published',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (updates.price !== undefined) {
      updates.price = (updates.price === '' || updates.price === null) ? 0 : Number(updates.price) || 0;
    }

    if (updates.discount_price !== undefined) {
      updates.discount_price = (updates.discount_price === '' || updates.discount_price === null)
        ? null
        : Number(updates.discount_price);
    }

    if (updates.category_id !== undefined) {
      updates.category_id = updates.category_id ? String(updates.category_id) : null;
    }

    if (updates.is_published !== undefined) {
      updates.is_published = Boolean(updates.is_published);
    }

    if (updates.screenshots !== undefined && !Array.isArray(updates.screenshots)) {
      updates.screenshots = [];
    }

    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data, error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await db.createAuditLog({
        adminId: req.user.id,
        action: 'UPDATE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: id,
        metadata: { title: data.title, price: data.price },
      });
      return res.json({ success: true, product: data });
    }

    const idx = db.store.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Product not found' });

    db.store.products[idx] = {
      ...db.store.products[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'UPDATE_PRODUCT',
      targetType: 'PRODUCT',
      targetId: id,
      metadata: { title: db.store.products[idx].title, price: db.store.products[idx].price },
    });

    res.json({ success: true, product: db.store.products[idx] });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    // Call resilient deleteProduct from db adapter
    await db.deleteProduct(id);

    try {
      await db.createAuditLog({
        adminId: req.user?.id,
        action: 'DELETE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: id,
      });
    } catch (e) {}

    res.json({ success: true, message: 'Product deleted successfully from store' });
  } catch (error) {
    next(error);
  }
};

// Users Management
export const getAdminUsers = async (req, res, next) => {
  try {
    let users = [];
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      users = data || [];
    } else {
      users = db.store.profiles;
    }

    const safeUsers = users.map(({ password_hash, ...u }) => u);
    res.json({ success: true, count: safeUsers.length, users: safeUsers });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;

    const updated = await db.updateUser(id, updates);
    if (!updated) return res.status(404).json({ success: false, message: 'User not found' });

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'UPDATE_USER_PERMISSIONS',
      targetType: 'USER',
      targetId: id,
      metadata: updates,
    });

    const { password_hash, ...safe } = updated;
    res.json({ success: true, user: safe });
  } catch (error) {
    next(error);
  }
};

// Orders Management
export const getAdminOrders = async (req, res, next) => {
  try {
    let orders = [];
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data } = await supabase.from('orders').select('*, items:order_items(*), user:profiles(id, email, username)').order('created_at', { ascending: false });
      orders = data || [];
    } else {
      orders = db.store.orders.map(o => ({
        ...o,
        items: db.store.order_items.filter(i => i.order_id === o.id),
        user: db.store.profiles.find(u => u.id === o.user_id),
      }));
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, payment_status } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;

    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('orders').update(updates).eq('id', id);
    } else {
      const ord = db.store.orders.find(o => o.id === id);
      if (ord) Object.assign(ord, updates);
    }

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'UPDATE_ORDER_STATUS',
      targetType: 'ORDER',
      targetId: id,
      metadata: updates,
    });

    res.json({ success: true, message: 'Order updated' });
  } catch (error) {
    next(error);
  }
};

// Wallet Management & Audited Adjustments
export const adjustUserWallet = async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'userId, amount, and an audited reason are strictly required for manual balance adjustments',
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return res.status(400).json({ success: false, message: 'Adjustment amount must be a non-zero number' });
    }

    const adjustmentResult = await db.adjustWallet({
      userId,
      type: 'ADMIN_ADJUSTMENT',
      amount: numAmount,
      referenceId: `AUDIT-ADJ-${Date.now()}`,
      description: `Admin adjustment: ${reason}`,
    });

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'MANUAL_WALLET_ADJUSTMENT',
      targetType: 'WALLET',
      targetId: userId,
      metadata: {
        amount: numAmount,
        reason,
        balance_before: adjustmentResult.balance_before,
        balance_after: adjustmentResult.balance_after,
      },
    });

    await db.createNotification({
      userId,
      title: 'Wallet Balance Adjusted by Support',
      message: `Your balance was adjusted by ${numAmount >= 0 ? '+' : ''}$${numAmount.toFixed(2)}. Reason: ${reason}`,
      type: numAmount >= 0 ? 'SUCCESS' : 'WARNING',
    });

    res.json({
      success: true,
      message: 'Wallet balance adjusted successfully with audit log created',
      adjustment: adjustmentResult,
    });
  } catch (error) {
    next(error);
  }
};

// Admin Logs
export const getAdminLogs = async (req, res, next) => {
  try {
    let logs = [];
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      logs = data || [];
    } else {
      logs = [...db.store.audit_logs].reverse().slice(0, 100);
    }

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    next(error);
  }
};

// File Upload Handler for Game Files & Images
export const uploadStorageFile = async (req, res, next) => {
  try {
    const { bucket = 'game-files', filename } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Validation: Supported extensions
    const supportedExts = ['.zip', '.rar', '.7z', '.iso', '.exe', '.apk', '.png', '.jpg', '.jpeg', '.webp'];
    const originalName = file.originalname.toLowerCase();
    const isSupported = supportedExts.some(ext => originalName.endsWith(ext));

    if (!isSupported) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Supported: ZIP, RAR, 7Z, ISO, EXE, APK, PNG, JPG, WEBP',
      });
    }

    const cleanName = filename || `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${bucket === 'game-files' ? 'games' : 'images'}/${cleanName}`;

    const uploadedPath = await storageService.uploadFile(
      bucket,
      storagePath,
      file.buffer,
      file.mimetype
    );

    let publicUrl = null;
    if (bucket === 'product-images' || file.mimetype.startsWith('image/')) {
      publicUrl = storageService.getPublicImageUrl(uploadedPath);
      if (!publicUrl || (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://'))) {
        // Provide base64 data URL fallback in dev mode so uploaded images render instantly
        publicUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      bucket,
      filePath: uploadedPath,
      fileName: file.originalname,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      publicUrl,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// System Backup & Recovery Controllers
// ==========================================

export const getBackups = async (req, res, next) => {
  try {
    const [backups, stats] = await Promise.all([
      backupService.listBackups(),
      backupService.getBackupStats(),
    ]);

    res.json({
      success: true,
      backups,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

export const createSystemBackup = async (req, res, next) => {
  try {
    const { note } = req.body || {};
    const backup = await backupService.createBackup({
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      note,
    });

    res.status(201).json({
      success: true,
      message: 'System backup snapshot generated successfully',
      backup,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fileInfo = await backupService.getBackupFile(id);

    if (!fileInfo || !fs.existsSync(fileInfo.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found',
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
    const stream = fs.createReadStream(fileInfo.filePath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const exportLiveBackup = async (req, res, next) => {
  try {
    const rawData = await backupService.getFullSystemData();
    const timestamp = new Date().toISOString();
    const fileName = `dynastore_live_backup_${timestamp.replace(/[:.]/g, '-')}.json`;

    const counts = {};
    let totalRecords = 0;
    for (const [key, rows] of Object.entries(rawData)) {
      counts[key] = rows.length;
      totalRecords += rows.length;
    }

    const payload = {
      version: '2.0.0',
      system: 'DynaStore',
      exportedAt: timestamp,
      exportedBy: req.user?.email || 'Admin',
      counts,
      totalRecords,
      data: rawData,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    next(error);
  }
};

export const restoreSystemBackup = async (req, res, next) => {
  try {
    const mode = req.body?.mode || 'merge';
    let backupPayload = null;

    if (req.file) {
      // Uploaded as multipart file
      const fileContent = req.file.buffer.toString('utf8');
      backupPayload = JSON.parse(fileContent);
    } else if (req.body?.backupData) {
      // Passed as direct JSON object
      backupPayload = req.body.backupData;
    } else if (req.body?.backupId) {
      // Referenced from existing snapshot on server
      const fileInfo = await backupService.getBackupFile(req.body.backupId);
      if (!fileInfo) {
        return res.status(404).json({ success: false, message: 'Specified backup snapshot not found' });
      }
      const raw = fs.readFileSync(fileInfo.filePath, 'utf8');
      backupPayload = JSON.parse(raw);
    } else {
      return res.status(400).json({
        success: false,
        message: 'No backup file or snapshot ID provided for restoration',
      });
    }

    const result = await backupService.restoreBackup({
      backupData: backupPayload,
      mode,
      adminId: req.user?.id,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSystemBackup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await backupService.deleteBackup(id, req.user?.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// Coupon & Discount Code Management
// =========================================================================

export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await db.listCoupons();
    const stats = {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter((c) => c.is_active).length,
      totalTimesUsed: coupons.reduce((sum, c) => sum + (c.times_used || 0), 0),
    };
    res.json({
      success: true,
      coupons,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_spend,
      max_discount,
      usage_limit,
      expires_at,
      is_active,
    } = req.body;

    if (!code || !discount_value) {
      return res.status(400).json({ success: false, message: 'Code and discount value are required' });
    }

    const coupon = await db.createCoupon({
      code,
      description,
      discount_type: discount_type || 'PERCENTAGE',
      discount_value,
      min_spend,
      max_discount,
      usage_limit,
      expires_at,
      is_active,
    });

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'COUPON_CREATED',
      targetType: 'COUPON',
      targetId: coupon.id,
      metadata: { code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value },
    });

    res.status(201).json({
      success: true,
      message: `Discount code '${coupon.code}' created successfully`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const coupon = await db.updateCoupon(id, updates);

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'COUPON_UPDATED',
      targetType: 'COUPON',
      targetId: id,
      metadata: updates,
    });

    res.json({
      success: true,
      message: 'Discount code updated successfully',
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.deleteCoupon(id);

    await db.createAuditLog({
      adminId: req.user.id,
      action: 'COUPON_DELETED',
      targetType: 'COUPON',
      targetId: id,
    });

    res.json({
      success: true,
      message: 'Discount code deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


