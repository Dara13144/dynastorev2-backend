import axios from 'axios';
import { ENV } from '../config/env.js';

class TelegramService {
  constructor() {
    this.botToken = ENV.TELEGRAM.BOT_TOKEN;
    this.adminChatId = ENV.TELEGRAM.ADMIN_CHAT_ID;
  }

  get isConfigured() {
    return Boolean(this.botToken && this.adminChatId);
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
}

export const telegramService = new TelegramService();
export default telegramService;
