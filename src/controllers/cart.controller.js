import { db } from '../utils/db.js';

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const items = db.store.carts[userId] || [];

    // Hydrate product data
    const hydratedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await db.getProductById(item.productId);
      if (product && product.is_published) {
        const finalPrice = product.discount_price !== null && product.discount_price !== undefined
          ? Number(product.discount_price)
          : Number(product.price);
        subtotal += finalPrice * item.quantity;
        hydratedItems.push({
          id: item.productId,
          productId: item.productId,
          product,
          price: finalPrice,
          originalPrice: Number(product.price),
          quantity: item.quantity,
        });
      }
    }

    res.json({
      success: true,
      cart: {
        items: hydratedItems,
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(subtotal.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }

    const product = await db.getProductById(productId);
    if (!product || !product.is_published) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    // Check if user already bought this game
    const alreadyPurchased = await db.hasUserPurchasedProduct(userId, productId);
    if (alreadyPurchased) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this game. It is available in your Downloads section.',
      });
    }

    if (!db.store.carts[userId]) {
      db.store.carts[userId] = [];
    }

    const existing = db.store.carts[userId].find(i => i.productId === productId);
    if (existing) {
      return res.json({
        success: true,
        message: 'Item already in cart (Digital games limited to 1 per order)',
      });
    }

    db.store.carts[userId].push({ productId, quantity: 1 });

    res.status(201).json({
      success: true,
      message: 'Added to cart',
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (db.store.carts[userId]) {
      db.store.carts[userId] = db.store.carts[userId].filter(i => i.productId !== productId);
    }

    res.json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    db.store.carts[userId] = [];
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};
