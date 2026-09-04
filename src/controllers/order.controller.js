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
      }      // Clear User Cart (Supabase + in-memory)
      if (db.isConfigured()) {
        try {
          const sbCarts = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle();
          if (sbCarts?.data?.id) {
            await supabase.from('cart_items').delete().eq('cart_id', sbCarts.data.id);
          }
        } catch (e) {}
      }
      db.store.carts[userId] = [];


      // Notifications
      await db.createNotification({
        userId,
        title: 'Order Paid with Wallet!',
        message: `Your order #${order.id.slice(0, 8)} was successful. Total paid: $${totalAmount}.`,
        type: 'SUCCESS',
      });

      return res.status(201).json({
        success: true,
        message: 'Order paid successfully via wallet balance',
        orderId: order.id,
        status: 'PAID',
      });
    }

    // 2. If paying with CutLuy (ABA KHQR Auto-Confirm)
    if (paymentMethod === 'CUTLUY') {
      const order = await db.createOrder({
        userId,
        totalAmount,
        paymentMethod: 'CUTLUY',
        transactionId: tranId,
        items: validatedProducts,
        couponCode: appliedCoupon?.code || null,
        discountAmount,
      });

      // Call CutLuy Payment Gateway API to generate real Bakong KHQR
      const cutluyData = await cutluyService.createPayment({
        amount: totalAmount,
        referenceId: tranId,
        description: `Order ${tranId.slice(-6)} - DynaStore`,
        customerName: req.user.username || 'Gamer',
        customerEmail: req.user.email || 'customer@dynastore.com',
      });

      // Record payment attempt
      const paymentRecord = {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: userId,
        provider: 'CUTLUY',
        transaction_id: tranId,
        amount: totalAmount,
        currency: 'USD',
        status: 'PENDING',
        payment_type: 'PURCHASE',
        qr_string: cutluyData.qr_string || null,
        payment_url: cutluyData.payment_url || null,
        provider_transaction_id: cutluyData.id,
        provider_response: cutluyData,
        signature_verified: false,
        created_at: new Date().toISOString(),
      };

      db.store.payments.push(paymentRecord);
      if (db.isConfigured()) {
        try {
          const { supabase } = await import('../config/supabase.js');
          await supabase.from('payments').insert(paymentRecord);
        } catch (e) {}
      }

      telegramService.notifyNewOrder(order).catch(() => {});

      const qrSvgUrl = `https://cutluy.com/api/render/khqr/${encodeURIComponent(cutluyData.qr_string || '')}.svg`;

      return res.status(201).json({
        success: true,
        message: 'Order created, proceed to CutLuy KHQR payment',
        orderId: order.id,
        transactionId: tranId,
        totalAmount,
        cutluyPayment: {
          cutluyId: cutluyData.id,
          qrString: cutluyData.qr_string,
          qrSvgUrl,
          paymentUrl: cutluyData.payment_url,
          status: cutluyData.status || 'pending',
          expiresAt: cutluyData.expires_at,
        },
      });
    }

    // 3. If paying with ABA PayWay (Cards / ABA Mobile)
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

    const paywayPayload = abaPaywayService.generatePurchasePayload({
      tranId,
      amount: totalAmount,
      reqTime: Math.floor(Date.now() / 1000),
      firstname: req.user.username || 'Gamer',
      lastname: 'DynaStore',
      email: req.user.email,
      phone: req.user.phone || '012345678',
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order/success?tran_id=${tranId}`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order/cancel?tran_id=${tranId}`,
    });

    // Record payment attempt
    const paymentRecord = {
      id: crypto.randomUUID(),
      order_id: order.id,
      user_id: userId,
      transaction_id: tranId,
      provider: 'ABA_PAYWAY',
      amount: totalAmount,
      currency: 'USD',
      payment_type: 'ORDER',
      status: 'PENDING',
      signature_verified: false,
      created_at: new Date().toISOString(),
    };

    db.store.payments.push(paymentRecord);
    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        await supabase.from('payments').insert(paymentRecord);
      } catch (e) {}
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
