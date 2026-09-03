import crypto from 'crypto';
import { db, supabase } from '../utils/db.js';
import { abaPaywayService } from '../services/abaPayway.service.js';
import { cutluyService } from '../services/cutluy.service.js';
import { telegramService } from '../services/telegram.service.js';

export const validateCoupon = async (req, res, next) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please provide a discount code' });
    }
    const result = await db.validateCoupon(code, cartTotal);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      valid: true,
      coupon: result.coupon,
      message: `Promo code ${result.coupon.code} applied! Saved $${result.coupon.discountAmount.toFixed(2)}`,
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productIds, paymentMethod, couponCode } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product is required to create an order' });
    }

    if (!['ABA_PAYWAY', 'WALLET_BALANCE', 'CUTLUY'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // Always fetch REAL price directly from Supabase / DB — Never trust client prices!
    const validatedProducts = [];
    let calculatedTotal = 0;

    for (const pid of productIds) {
      const product = await db.getProductById(pid);
      if (!product || !product.is_published) {
        return res.status(400).json({ success: false, message: `Product ${pid} is no longer available` });
      }

      // Check if already purchased
      const alreadyOwned = await db.hasUserPurchasedProduct(userId, pid);
      if (alreadyOwned) {
        return res.status(400).json({
          success: false,
          message: `You already own "${product.title}". Check your Downloads page.`,
        });
      }

      const itemPrice = product.discount_price !== null && product.discount_price !== undefined
        ? Number(product.discount_price)
        : Number(product.price);

      calculatedTotal += itemPrice;
      validatedProducts.push(product);
    }

    // Process discount code if provided
    let appliedCoupon = null;
    let discountAmount = 0;
    if (couponCode) {
      const couponCheck = await db.validateCoupon(couponCode, calculatedTotal);
      if (couponCheck.valid) {
        appliedCoupon = couponCheck.coupon;
        discountAmount = couponCheck.coupon.discountAmount;
      } else {
        return res.status(400).json({ success: false, message: couponCheck.message });
      }
    }

    const subtotal = Number(calculatedTotal.toFixed(2));
    const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
    const tranId = `DS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 1. If paying with Wallet Balance
    if (paymentMethod === 'WALLET_BALANCE') {
      const user = await db.findUserById(userId);
      if (Number(user.balance) < totalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. You have $${user.balance}, but order total is $${totalAmount}.`,
        });
      }

      // Create Order
      const order = await db.createOrder({
        userId,
        totalAmount,
        paymentMethod: 'WALLET_BALANCE',
        transactionId: tranId,
        items: validatedProducts,
        couponCode: appliedCoupon?.code,
        discountAmount,
      });

      if (appliedCoupon?.code) {
        await db.incrementCouponUsage(appliedCoupon.code);
      }

      // Deduct balance atomically
      await db.adjustWallet({
        userId,
        type: 'PURCHASE',
        amount: -totalAmount,
        referenceId: order.id,
        description: `Purchased order #${order.id}`,
      });

      // Mark Order as PAID
      if (db.isConfigured()) {
        try {
          await supabase.from('orders').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', order.id);
        } catch (e) {}
      }
      const ord = db.store.orders.find(o => o.id === order.id);
      if (ord) {
        ord.status = 'PAID';
      }

      // Clear User Cart (Supabase + in-memory)
      if (db.isConfigured()) {
        const sbCarts = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle();
        if (sbCarts?.data?.id) {
          await supabase.from('cart_items').delete().eq('cart_id', sbCarts.data.id);
        }
      }
      db.store.carts[userId] = [];


      // Notifications
      await db.createNotification({
        userId,
        title: 'Order Paid & Games Unlocked!',
        message: `Order #${order.id} for $${totalAmount} was paid via Wallet Balance. You can now download your game files.`,
        type: 'SUCCESS',
      });

      telegramService.notifyNewOrder({ ...order, status: 'PAID' }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Order completed and paid with wallet balance',
        orderId: order.id,
        status: 'PAID',
        totalAmount,
      });
    }

    // 2. If paying with CutLuy KHQR (Bakong / All Banks)
    if (paymentMethod === 'CUTLUY') {
      const order = await db.createOrder({
        userId,
        totalAmount,
        paymentMethod: 'CUTLUY',
        transactionId: tranId,
        items: validatedProducts,
        couponCode: appliedCoupon?.code,
        discountAmount,
      });

      if (appliedCoupon?.code) {
        await db.incrementCouponUsage(appliedCoupon.code);
      }

      const cutluyData = await cutluyService.createPayment({
        amount: totalAmount,
        reference_id: tranId,
      });

      const paymentRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        order_id: order.id,
        transaction_id: tranId,
        provider: 'CUTLUY',
        amount: totalAmount,
        currency: 'USD',
        payment_type: 'ORDER',
        status: 'PENDING',
        provider_transaction_id: cutluyData.id,
        provider_response: cutluyData,
        signature_verified: false,
        created_at: new Date().toISOString(),
      };

      if (db.isConfigured()) {
        const { supabase } = await import('../config/supabase.js');
        await supabase.from('payments').insert(paymentRecord);
      } else {
        db.store.payments.push(paymentRecord);
      }

      telegramService.notifyNewOrder(order).catch(() => {});

      const qrSvgUrl = `https://cutluy.com/api/render/khqr/${encodeURIComponent(cutluyData.qr_string || '')}.svg`;

      return res.status(201).json({
        success: true,
        message: 'Order created, proceed to CutLuy KHQR payment',
        orderId: order.id,
        transactionId: tranId,
        cutluyId: cutluyData.id,
        totalAmount,
        currency: cutluyData.currency || 'USD',
        qrString: cutluyData.qr_string,
        qrSvgUrl,
        checkoutUrl: cutluyData.checkout_url,
        expiresAt: cutluyData.expires_at,
        cutluyPayment: cutluyData,
      });
    }

    // 3. If paying with ABA PayWay
    const order = await db.createOrder({
      userId,
      totalAmount,
      paymentMethod: 'ABA_PAYWAY',
      transactionId: tranId,
      items: validatedProducts,
      couponCode: appliedCoupon?.code,
      discountAmount,
    });

    if (appliedCoupon?.code) {
      await db.incrementCouponUsage(appliedCoupon.code);
    }

    // Generate ABA PayWay payload
    const abaItems = validatedProducts.map(p => ({
      name: p.title.slice(0, 40),
      quantity: 1,
      price: (p.discount_price !== null && p.discount_price !== undefined ? Number(p.discount_price) : Number(p.price)).toFixed(2),
    }));

    const nameParts = (req.user.username || 'Customer User').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const paywayPayload = abaPaywayService.createPaymentPayload({
      tranId,
      amount: totalAmount,
      items: abaItems,
      firstName,
      lastName,
      email: req.user.email,
      returnParams: JSON.stringify({ order_id: order.id, user_id: userId }),
    });

    // Record pending payment in DB
    const paymentRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      order_id: order.id,
      transaction_id: tranId,
      provider: 'ABA_PAYWAY',
      amount: totalAmount,
      currency: 'USD',
      payment_type: 'ORDER',
      status: 'PENDING',
      signature_verified: false,
      created_at: new Date().toISOString(),
    };

    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('payments').insert(paymentRecord);
    } else {
      db.store.payments.push(paymentRecord);
    }

    telegramService.notifyNewOrder(order).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Order created, proceed to ABA PayWay payment',
      orderId: order.id,
      transactionId: tranId,
      totalAmount,
      abaPayment: paywayPayload,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const orders = await db.getUserOrders(req.user.id);
    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await db.getOrderById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this order' });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};
