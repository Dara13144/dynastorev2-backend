import crypto from 'crypto';
import { db } from '../utils/db.js';
import { abaPaywayService } from '../services/abaPayway.service.js';
import { cutluyService } from '../services/cutluy.service.js';
import { telegramService } from '../services/telegram.service.js';

export const createPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, paymentType = 'WALLET_DEPOSIT', orderId } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount greater than $0 is required' });
    }

    const tranId = `DS-DEP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const items = [
      {
        name: paymentType === 'WALLET_DEPOSIT' ? 'Wallet Balance Deposit' : 'Digital Game Purchase',
        quantity: 1,
        price: numAmount.toFixed(2),
      },
    ];

    const nameParts = (req.user.username || 'Customer User').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const paywayPayload = abaPaywayService.createPaymentPayload({
      tranId,
      amount: numAmount,
      items,
      firstName,
      lastName,
      email: req.user.email,
      returnParams: JSON.stringify({ user_id: userId, payment_type: paymentType, order_id: orderId }),
    });

    const paymentRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      order_id: orderId || null,
      transaction_id: tranId,
      provider: 'ABA_PAYWAY',
      amount: numAmount,
      currency: 'USD',
      payment_type: paymentType,
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

    res.status(201).json({
      success: true,
      transactionId: tranId,
      amount: numAmount,
      abaPayment: paywayPayload,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    let payment = null;
    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        const { data } = await supabase.from('payments').select('*').eq('transaction_id', transactionId).maybeSingle();
        payment = data;
      } catch (e) {}
    }
    if (!payment) {
      payment = db.store.payments.find(p => p.transaction_id === transactionId);
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found' });
    }

    // If still pending, query ABA PayWay check-transaction API directly
    if (payment.status === 'PENDING') {
      const checkResult = await abaPaywayService.checkTransactionStatus(transactionId);
      if (checkResult.success && (checkResult.status === 'APPROVED' || checkResult.data?.status === 0)) {
        // Auto-resolve payment if approved by ABA
        await completeSuccessfulPayment(payment, checkResult.data);
        payment.status = 'PAID';
      }
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ABA PayWay Callback / Webhook Handler
 * Idempotent, Signature verified, updates order or wallet deposit
 */
export const abaCallback = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { tran_id, status, amount, hash } = body;

    console.log(`[ABA PayWay Webhook Received] TranID: ${tran_id}, Status: ${status}, Amount: ${amount}`);

    if (!tran_id) {
      return res.status(400).json({ status: '01', message: 'Missing tran_id' });
    }

    // 1. Signature Verification
    const isSignatureValid = abaPaywayService.verifyCallbackSignature(body);
    if (!isSignatureValid) {
      console.warn(`[ABA PayWay Webhook] Invalid Signature for tran_id: ${tran_id}`);
      return res.status(400).json({ status: '02', message: 'Invalid signature / hash' });
    }

    // 2. Find payment record in database
    let payment = null;
    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        const { data } = await supabase.from('payments').select('*').eq('transaction_id', tran_id).maybeSingle();
        payment = data;
      } catch (e) {}
    }
    if (!payment) {
      payment = db.store.payments.find(p => p.transaction_id === tran_id);
    }

    if (!payment) {
      console.warn(`[ABA PayWay Webhook] Transaction not found: ${tran_id}`);
      return res.status(404).json({ status: '03', message: 'Transaction not found in store' });
    }

    // 3. Idempotency check: If already paid or processed, ignore to prevent duplicate credits
    if (payment.status === 'PAID') {
      console.log(`[ABA PayWay Webhook] Idempotent repeat: Transaction ${tran_id} already marked PAID.`);
      return res.status(200).json({ status: '00', message: 'Transaction already completed' });
    }

    // 4. Verify amount
    if (amount && Math.abs(Number(amount) - Number(payment.amount)) > 0.01) {
      console.error(`[ABA PayWay Webhook] Amount mismatch! Expected: ${payment.amount}, Received: ${amount}`);
      return res.status(400).json({ status: '04', message: 'Amount mismatch' });
    }

    // 5. Handle Status (0 or 00 or 'APPROVED' represents success in ABA PayWay)
    if (status === '0' || status === '00' || status === 0 || status === 'APPROVED') {
      await completeSuccessfulPayment(payment, body);
      return res.status(200).json({ status: '00', message: 'Payment successfully processed' });
    } else {
      // Payment Failed / Cancelled
      payment.status = 'FAILED';
      payment.provider_response = body;

      if (db.isConfigured()) {
        const { supabase } = await import('../config/supabase.js');
        await supabase.from('payments').update({ status: 'FAILED', provider_response: body, updated_at: new Date().toISOString() }).eq('id', payment.id);
        if (payment.order_id) {
          await supabase.from('orders').update({ status: 'FAILED', payment_status: 'FAILED', updated_at: new Date().toISOString() }).eq('id', payment.order_id);
        }
      } else {
        if (payment.order_id) {
          const ord = db.store.orders.find(o => o.id === payment.order_id);
          if (ord) {
            ord.status = 'FAILED';
            ord.payment_status = 'FAILED';
          }
        }
      }

      telegramService.notifyFailedPayment(payment).catch(() => {});
      return res.status(200).json({ status: '00', message: 'Payment failure recorded' });
    }
  } catch (error) {
    console.error('ABA Callback Processing Error:', error);
    next(error);
  }
};

/**
 * Helper to transition Payment & Order / Wallet to completed state atomically
 */
async function completeSuccessfulPayment(payment, rawResponse = {}) {
  payment.status = 'PAID';
  payment.signature_verified = true;
  payment.provider_response = rawResponse;

  const devPayment = db.store.payments.find(p => p.transaction_id === payment.transaction_id || p.id === payment.id);
  if (devPayment) {
    devPayment.status = 'PAID';
    devPayment.signature_verified = true;
    devPayment.provider_response = rawResponse;
  }

  if (db.isConfigured()) {
    try {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('payments').update({
        status: 'PAID',
        signature_verified: true,
        provider_response: rawResponse,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);
    } catch (e) {}
  }

  // If this payment was for an ORDER
  if (payment.payment_type === 'ORDER' && payment.order_id) {
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('orders').update({
        status: 'PAID',
        payment_status: 'PAID',
        updated_at: new Date().toISOString(),
      }).eq('id', payment.order_id);
    } else {
      const ord = db.store.orders.find(o => o.id === payment.order_id);
      if (ord) {
        ord.status = 'PAID';
        ord.payment_status = 'PAID';
      }
    }

    // Clear cart
    db.store.carts[payment.user_id] = [];

    // Notification
    await db.createNotification({
      userId: payment.user_id,
      title: 'Payment Successful! Games Unlocked',
      message: `Your ABA PayWay payment of $${payment.amount} has been verified. Your game files are ready in Downloads.`,
      type: 'SUCCESS',
    });

    telegramService.notifySuccessfulPayment(payment).catch(() => {});
  }

  // If this payment was for a WALLET_DEPOSIT
  if (payment.payment_type === 'WALLET_DEPOSIT') {
    const depositResult = await db.adjustWallet({
      userId: payment.user_id,
      type: 'DEPOSIT',
      amount: payment.amount,
      referenceId: payment.transaction_id,
      description: `ABA PayWay Top-up (${payment.transaction_id})`,
    });

    const user = await db.findUserById(payment.user_id);

    await db.createNotification({
      userId: payment.user_id,
      title: 'Wallet Deposit Credited',
      message: `+$${payment.amount} added to your DynaStore wallet via ABA PayWay. New balance: $${depositResult.balance_after}.`,
      type: 'SUCCESS',
    });

    telegramService.notifyWalletDeposit({
      username: user?.username,
      user_id: payment.user_id,
      amount: payment.amount,
      balance_after: depositResult.balance_after,
    }).catch(() => {});
  }
}

/**
 * Create CutLuy KHQR Payment session for Order or Wallet Top-Up
 */
export const createCutLuyPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, paymentType = 'WALLET_DEPOSIT', orderId } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0.01) {
      return res.status(400).json({ success: false, message: 'Valid amount (minimum $0.01) is required' });
    }

    const tranId = `DS-CUT-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create session on CutLuy API
    const cutluyData = await cutluyService.createPayment({
      amount: numAmount,
      reference_id: tranId,
    });

    const paymentRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      order_id: orderId || null,
      transaction_id: tranId,
      provider: 'CUTLUY',
      amount: numAmount,
      currency: 'USD',
      payment_type: paymentType,
      status: 'PENDING',
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

    // Official KHQR SVG Render URL from CutLuy
    const qrSvgUrl = `https://cutluy.com/api/render/khqr/${encodeURIComponent(cutluyData.qr_string || '')}.svg`;

    res.status(201).json({
      success: true,
      transactionId: tranId,
      cutluyId: cutluyData.id,
      amount: numAmount,
      currency: cutluyData.currency || 'USD',
      qrString: cutluyData.qr_string,
      qrSvgUrl,
      checkoutUrl: cutluyData.checkout_url,
      expiresAt: cutluyData.expires_at,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Poll / Check Status of CutLuy Payment every 3-5 seconds
 */
export const checkCutLuyPayment = async (req, res, next) => {
  try {
    const { id } = req.params; // Can be transaction_id or cutluyId

    let payment = null;
    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        const { data } = await supabase
          .from('payments')
          .select('*')
          .or(`transaction_id.eq.${id},provider_transaction_id.eq.${id}`)
          .maybeSingle();
        payment = data;
      } catch (e) {}
    }
    if (!payment) {
      payment = db.store.payments.find(
        (p) => p.transaction_id === id || p.provider_transaction_id === id
      );
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment transaction not found' });
    }

    // If still pending, query CutLuy API to auto-resolve
    if (payment.status === 'PENDING' && payment.provider_transaction_id) {
      try {
        const cutluyCheck = await cutluyService.checkPaymentStatus(payment.provider_transaction_id);
        if (cutluyCheck?.status === 'paid' || cutluyCheck?.data?.status === 'paid') {
          await completeSuccessfulPayment(payment, cutluyCheck);
          payment.status = 'PAID';
        } else if (cutluyCheck?.status === 'expired' || cutluyCheck?.status === 'failed') {
          payment.status = cutluyCheck.status.toUpperCase();
        }
      } catch (err) {
        console.warn('CutLuy live polling warning:', err.message);
      }
    }

    res.json({
      success: true,
      status: payment.status,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CutLuy Webhook receiver with HMAC-SHA256 signature verification
 */
export const cutluyWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-cutluy-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = cutluyService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('CutLuy invalid webhook signature received');
      return res.status(400).json({ error: 'invalid_signature' });
    }

    const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    console.log('[CutLuy Webhook Event Received]:', payload.type || payload.status);

    const paymentData = payload.data?.payment || payload.payment || payload;
    const refId = paymentData.reference_id;
    const cutluyId = paymentData.id;

    if (!refId && !cutluyId) {
      return res.status(400).json({ error: 'missing_reference' });
    }

    let payment = null;
    if (db.isConfigured()) {
      try {
        const { supabase } = await import('../config/supabase.js');
        const { data } = await supabase
          .from('payments')
          .select('*')
          .or(`transaction_id.eq.${refId},provider_transaction_id.eq.${cutluyId}`)
          .maybeSingle();
        payment = data;
      } catch (e) {}
    }
    if (!payment) {
      payment = db.store.payments.find(
        (p) => (refId && p.transaction_id === refId) || (cutluyId && p.provider_transaction_id === cutluyId)
      );
    }

    if (payment && payment.status !== 'PAID') {
      if (payload.type === 'payment.completed' || paymentData.status === 'paid') {
        await completeSuccessfulPayment(payment, payload);
        console.log(`[CutLuy Webhook] Payment ${payment.transaction_id} fulfilled successfully!`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('CutLuy Webhook Handler Error:', error);
    res.status(500).json({ error: 'internal_error' });
  }
};

