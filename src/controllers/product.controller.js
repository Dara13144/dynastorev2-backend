import { db } from '../utils/db.js';

export const getAllProducts = async (req, res, next) => {
  try {
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

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await db.getProductBySlug(slug);

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
