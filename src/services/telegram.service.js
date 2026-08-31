import axios from 'axios';
import crypto from 'crypto';
import { ENV } from '../config/env.js';

class TelegramService {
  constructor() {
    this.botToken = ENV.TELEGRAM.BOT_TOKEN;
    this.adminChatId = ENV.TELEGRAM.ADMIN_CHAT_ID;
  }

  get isConfigured() {
    return Boolean(this.botToken && this.adminChatId);
  }

  /**
   * Verify Telegram Login Widget authentication hash
   * @param {Object} data 
   * @returns {boolean}
   */
  verifyTelegramAuth(data) {
    if (!data || !data.hash) return false;
    const botToken = this.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return true; // allow dev/fallback authentication

    try {
      const { hash, ...rest } = data;
      const checkString = Object.keys(rest)
        .sort()
        .map(k => `${k}=${rest[k]}`)
        .join('\n');

      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

      return hmac === hash;
    } catch (e) {
      console.warn('Telegram auth verification warning:', e.message);
      return false;
    }
  }

  async sendMessage(messageText) {
    if (!this.isConfigured) return;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.adminChatId,
        text: messageText,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Telegram notification error:', error.message);
    }
  }

  async notifyNewOrder(order) {
    const text = `🛍 <b>DynaStore - New Order Created</b>\n\n` +
      `<b>Order ID:</b> <code>${order.id}</code>\n` +
      `<b>Amount:</b> $${order.total_amount}\n` +
      `<b>Payment Method:</b> ${order.payment_method}\n` +
      `<b>Status:</b> ${order.status}`;
    return this.sendMessage(text);
  }

  async notifySuccessfulPayment(payment) {
    const text = `💰 <b>DynaStore - Payment Received</b>\n\n` +
      `<b>Transaction ID:</b> <code>${payment.transaction_id}</code>\n` +
      `<b>Type:</b> ${payment.payment_type}\n` +
      `<b>Amount:</b> $${payment.amount} ${payment.currency || 'USD'}\n` +
      `<b>Status:</b> ${payment.status}`;
    return this.sendMessage(text);
  }

  async notifyWalletDeposit(deposit) {
    const text = `💳 <b>DynaStore - Wallet Top-up</b>\n\n` +
      `<b>User:</b> ${deposit.username || deposit.user_id}\n` +
      `<b>Amount:</b> +$${deposit.amount}\n` +
      `<b>New Balance:</b> $${deposit.balance_after}`;
    return this.sendMessage(text);
  }

  async notifyFailedPayment(payment) {
    const text = `⚠️ <b>DynaStore - Payment Failed/Cancelled</b>\n\n` +
      `<b>Transaction ID:</b> <code>${payment.transaction_id}</code>\n` +
      `<b>Amount:</b> $${payment.amount}\n` +
      `<b>Reason:</b> ${payment.reason || 'Payment rejected or cancelled by user'}`;
    return this.sendMessage(text);
  }

  async notifyNewUser(user) {
    const text = `👤 <b>DynaStore - New User Registered</b>\n\n` +
      `<b>Username:</b> ${user.username}\n` +
      `<b>Email:</b> ${user.email}`;
    return this.sendMessage(text);
  }

  /**
   * Start polling Telegram updates to auto-login users who click /start login_...
   */
  startPolling(autoConfirmCallback) {
    if (!this.botToken) return;

    let lastUpdateId = 0;
    let isPolling = false;

    const poll = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
        const res = await axios.get(url, { timeout: 10000 });
        const updates = res.data?.result || [];

        for (const update of updates) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const text = msg.text.trim();
          if (text.startsWith('/start login_') || text.startsWith('/start tg_qr_') || text.startsWith('/start dev_qr_')) {
            const rawSession = text.replace('/start', '').trim();
            const from = msg.from || {};

            if (autoConfirmCallback) {
              await autoConfirmCallback(rawSession, from);
            }

            // Send confirmation back to user
            const replyUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            await axios.post(replyUrl, {
              chat_id: msg.chat.id,
              text: `🎉 <b>Welcome to DynaStore, ${from.first_name || 'Gamer'}!</b>\n\n✅ <b>Login Approved!</b> You have successfully logged in on your website browser.`,
              parse_mode: 'HTML',
            }).catch(() => {});
          }
        }
      } catch (err) {
        // Network timeout / retry silently
      } finally {
        isPolling = false;
      }
    };

    // Run periodic poll loop
    setInterval(poll, 2500);
    poll();
  }
}

export const telegramService = new TelegramService();
export default telegramService;

