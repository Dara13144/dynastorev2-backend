import crypto from 'crypto';
import { db } from '../utils/db.js';
import { abaPaywayService } from '../services/abaPayway.service.js';

export const getWallet = async (req, res, next) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let transactions = [];
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      transactions = data || [];
    } else {
      transactions = db.store.wallet_transactions
        .filter(t => t.user_id === req.user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    res.json({
      success: true,
      balance: Number(user.balance || 0).toFixed(2),
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    let transactions = [];
    if (db.isConfigured()) {
      const { supabase } = await import('../config/supabase.js');
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
      transactions = data || [];
    } else {
      transactions = db.store.wallet_transactions
        .filter(t => t.user_id === req.user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

export const deposit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount greater than $0' });
    }

    const tranId = `DS-DEP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const items = [
      {
        name: `DynaStore Wallet Deposit ($${numAmount.toFixed(2)})`,
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
      returnParams: JSON.stringify({ user_id: userId, payment_type: 'WALLET_DEPOSIT' }),
    });

    const paymentRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      order_id: null,
      transaction_id: tranId,
      provider: 'ABA_PAYWAY',
      amount: numAmount,
      currency: 'USD',
      payment_type: 'WALLET_DEPOSIT',
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
      message: 'Deposit payment initialized',
      transactionId: tranId,
      amount: numAmount,
      abaPayment: paywayPayload,
    });
  } catch (error) {
    next(error);
  }
};
