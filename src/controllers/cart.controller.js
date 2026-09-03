import { db, supabase } from '../utils/db.js';

// Helper: get the actual user cart UUID from Supabase carts table
async function getSupabaseCartId(userId) {
  const { data } = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle();
  if (data?.id) return data.id;
  // Auto-create cart if missing
  const { data: newCart } = await supabase.from('carts').insert({ user_id: userId }).select('id').single();
  return newCart?.id || null;
}

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // --- Supabase path ---
    if (db.isConfigured() && supabase) {
      const cartId = await getSupabaseCartId(userId);
      if (!cartId) {
        return res.json({ success: true, cart: { items: [], subtotal: 0, total: 0 } });
      }

      const { data: cartItems, error } = await supabase
        .from('cart_items')
        .select('id, product_id, quantity, product:products(id, title, slug, price, discount_price, cover_image, platform, is_published)')
        .eq('cart_id', cartId);

      if (error) throw error;

      const hydratedItems = [];
      let subtotal = 0;

      for (const item of (cartItems || [])) {
        const product = item.product;
        if (product && product.is_published) {
          const finalPrice = product.discount_price !== null && product.discount_price !== undefined
            ? Number(product.discount_price)
            : Number(product.price);
          subtotal += finalPrice * item.quantity;
          hydratedItems.push({
            id: item.product_id,
            productId: item.product_id,
            product,
            price: finalPrice,
            originalPrice: Number(product.price),
            quantity: item.quantity,
          });
        }
      }

      return res.json({
        success: true,
        cart: {
          items: hydratedItems,
          subtotal: Number(subtotal.toFixed(2)),
          total: Number(subtotal.toFixed(2)),
        },
      });
    }

    // --- In-memory fallback ---
    const items = db.store.carts[userId] || [];
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

    // --- Supabase path ---
    if (db.isConfigured() && supabase) {
      const cartId = await getSupabaseCartId(userId);
      if (!cartId) throw new Error('Could not create cart');

      // Check if already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        return res.json({ success: true, message: 'Item already in cart (Digital games limited to 1 per order)' });
      }

      const { error } = await supabase.from('cart_items').insert({ cart_id: cartId, product_id: productId, quantity: 1 });
      if (error) throw error;

      return res.status(201).json({ success: true, message: 'Added to cart' });
    }

    // --- In-memory fallback ---
    if (!db.store.carts[userId]) {
      db.store.carts[userId] = [];
    }

    const existing = db.store.carts[userId].find(i => i.productId === productId);
    if (existing) {
      return res.json({ success: true, message: 'Item already in cart (Digital games limited to 1 per order)' });
    }

    db.store.carts[userId].push({ productId, quantity: 1 });
    res.status(201).json({ success: true, message: 'Added to cart' });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // --- Supabase path ---
    if (db.isConfigured() && supabase) {
      const cartId = await getSupabaseCartId(userId);
      if (cartId) {
        await supabase.from('cart_items').delete().eq('cart_id', cartId).eq('product_id', productId);
      }
      return res.json({ success: true, message: 'Item removed from cart' });
    }

    // --- In-memory fallback ---
    if (db.store.carts[userId]) {
      db.store.carts[userId] = db.store.carts[userId].filter(i => i.productId !== productId);
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // --- Supabase path ---
    if (db.isConfigured() && supabase) {
      const cartId = await getSupabaseCartId(userId);
      if (cartId) {
        await supabase.from('cart_items').delete().eq('cart_id', cartId);
      }
      return res.json({ success: true, message: 'Cart cleared' });
    }

    // --- In-memory fallback ---
    db.store.carts[userId] = [];
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};
