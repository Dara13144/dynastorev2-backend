import { db } from '../utils/db.js';

const setNoCacheHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

export const getAllProducts = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { category, search, platform, minPrice, maxPrice, sort } = req.query;

    const products = await db.getProducts({
      category,
      search,
      platform,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort,
      isPublished: true,
    });

    console.log('GET /api/products count:', products?.length || 0);

    res.json({
      success: true,
      count: products.length,
      products: products || [],
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const { slug } = req.params;
    let product = await db.getProductBySlug(slug);
    if (!product && slug) {
      product = await db.getProductById(slug);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedAndSpotlight = async (req, res, next) => {
  try {
    setNoCacheHeaders(res);
    const all = await db.getProducts({ isPublished: true });
    const featured = all[0] || null;
    const popular = all.slice(0, 4);
    const newReleases = [...all].reverse().slice(0, 4);
    const specialOffers = all.filter(p => p.discount_price && Number(p.discount_price) < Number(p.price));

    res.json({
      success: true,
      featured,
      popular,
      newReleases,
      specialOffers,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProductHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    console.log('DELETE product ID:', id);
    const result = await db.deleteProduct(id);

    if (!result.success || !result.deletedRows || result.deletedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    console.log('Supabase deleted row count:', result.deletedRows.length);

    try {
      await db.createAuditLog({
        adminId: req.user?.id,
        action: 'DELETE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: id,
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Product deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('Delete product handler error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete product',
    });
  }
};

export const createProductHandler = async (req, res, next) => {
  try {
    const { title, price } = req.body;
    if (!title || price === undefined) {
      return res.status(400).json({ success: false, message: 'Title and price are required' });
    }
    const created = await db.createProduct(req.body);
    try {
      await db.createAuditLog({
        adminId: req.user?.id,
        action: 'CREATE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: created.id,
        metadata: { title: created.title, price: created.price },
      });
    } catch (e) {}
    res.status(201).json({ success: true, product: created });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create product' });
  }
};

export const updateProductHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await db.updateProduct(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    try {
      await db.createAuditLog({
        adminId: req.user?.id,
        action: 'UPDATE_PRODUCT',
        targetType: 'PRODUCT',
        targetId: id,
        metadata: { title: updated.title, price: updated.price },
      });
    } catch (e) {}
    res.json({ success: true, product: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update product' });
  }
};
