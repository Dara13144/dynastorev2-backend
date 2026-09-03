import { db } from '../utils/db.js';

export async function getSpinConfig(req, res, next) {
  try {
    const segments = await db.listSpinSegments();
    return res.json({ success: true, segments });
  } catch (err) { next(err); }
}

export async function doSpin(req, res, next) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

    const alreadySpun = await db.hasSpinForOrder(orderId);
    if (alreadySpun) return res.status(409).json({ success: false, message: 'You have already used your spin for this order' });

    const segments = await db.listSpinSegments();
    if (!segments.length) return res.status(404).json({ success: false, message: 'Spin wheel is not configured yet' });

    const winner = db.pickSpinSegment(segments);
    if (!winner) return res.status(500).json({ success: false, message: 'Could not select a prize segment' });

    const prizeValue = String(winner.prize_value || '0');
    let awardResult = null;

    if (winner.prize_type === 'WALLET') {
      const amount = Number(prizeValue);
      if (amount > 0) {
        try {
          await db.adjustWallet({
            userId,
            type: 'SPIN_WIN',
            amount,
            description: 'Spin Wheel Prize: ' + winner.label,
          });
          awardResult = { walletCredit: amount };
        } catch (e) {
          console.warn('Spin wallet credit error:', e.message);
          awardResult = { walletCredit: amount };
        }
      }
    } else if (winner.prize_type === 'COUPON') {
      const couponCode = 'SPIN-' + Date.now().toString(36).toUpperCase() + '-' + userId.slice(-4).toUpperCase();
      const discountValue = Number(prizeValue);
      try {
        await db.createCoupon({ code: couponCode, description: 'Spin Wheel Prize: ' + winner.label, discount_type: 'PERCENTAGE', discount_value: discountValue, min_order_amount: 0, max_uses: 1, is_active: true });
      } catch (e) { console.warn('Spin coupon creation error:', e.message); }
      awardResult = { couponCode, discountValue };
    } else if (winner.prize_type === 'BADGE') {
      awardResult = { badge: prizeValue };
    }

    await db.recordSpin({ userId, orderId, segmentId: winner.id, prizeType: winner.prize_type, prizeValue, prizeLabel: winner.label });

    return res.json({
      success: true,
      winner: { id: winner.id, label: winner.label, color: winner.color, prize_type: winner.prize_type, prize_value: prizeValue },
      award: awardResult,
      message: winner.prize_type === 'NONE' ? 'Better luck next time!' : 'You won: ' + winner.label + '!',
    });
  } catch (err) { next(err); }
}

export async function adminGetSegments(req, res, next) {
  try {
    const segments = await db.listSpinSegments();
    return res.json({ success: true, segments });
  } catch (err) { next(err); }
}

export async function adminCreateSegment(req, res, next) {
  try {
    const { label, color, prize_type, prize_value, weight, is_active } = req.body;
    if (!label) return res.status(400).json({ success: false, message: 'label is required' });
    // Sanitize numeric fields — prevent empty string → Supabase numeric error
    const safeWeight = weight === '' || weight === undefined || weight === null ? 10 : Number(weight) || 10;
    const safePrizeValue = prize_value === '' || prize_value === undefined || prize_value === null ? '0' : prize_value;
    const seg = await db.createSpinSegment({ label, color, prize_type, prize_value: safePrizeValue, weight: safeWeight, is_active });
    return res.status(201).json({ success: true, segment: seg });
  } catch (err) { next(err); }
}

export async function adminUpdateSegment(req, res, next) {
  try {
    const updates = { ...req.body };
    // Sanitize numeric fields — prevent empty string → Supabase numeric error
    if (updates.weight === '' || updates.weight === null) updates.weight = 10;
    if (updates.weight !== undefined) updates.weight = Number(updates.weight) || 10;
    if (updates.prize_value === '' || updates.prize_value === null) updates.prize_value = '0';
    const seg = await db.updateSpinSegment(req.params.id, updates);
    if (!seg) return res.status(404).json({ success: false, message: 'Segment not found' });
    return res.json({ success: true, segment: seg });
  } catch (err) { next(err); }
}

export async function adminDeleteSegment(req, res, next) {
  try {
    await db.deleteSpinSegment(req.params.id);
    return res.json({ success: true, message: 'Segment deleted' });
  } catch (err) { next(err); }
}
