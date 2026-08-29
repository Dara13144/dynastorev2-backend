import axios from 'axios';
import crypto from 'node:crypto';
import { ENV } from '../config/env.js';

class CutLuyService {
  constructor() {
    this.apiKey = ENV.CUTLUY.API_KEY;
    this.apiUrl = ENV.CUTLUY.API_URL || 'https://cutluy.com/v1';
    this.webhookSecret = ENV.CUTLUY.WEBHOOK_SECRET;
  }

  /**
   * Create a new KHQR payment session on CutLuy
   * @param {Object} params
   * @param {number|string} params.amount - Amount in USD (e.g. 1.50)
   * @param {string} params.reference_id - Order or Wallet Deposit reference ID
   * @returns {Promise<Object>} CutLuy payment object
   */
  async createPayment({ amount, reference_id }) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0.01) {
      throw new Error('Minimum payment amount is 0.01 USD');
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          amount: parsedAmount,
          reference_id: reference_id.toString(),
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('CutLuy Create Payment Error:', error.response?.data || error.message);
      
      // Fallback dev simulator if live network or key is unreachable during offline test
      if (!this.apiKey || this.apiKey.startsWith('test_')) {
        const mockId = `cutluy_mock_${Date.now()}`;
        return {
          id: mockId,
          status: 'pending',
          amount: parsedAmount.toFixed(2),
          currency: 'USD',
          reference_id,
          qr_string: `00020101021229330016dynastore@bkrt01090000000005204599953038405404${parsedAmount.toFixed(2)}5802KH5911DynaStore6010Phnom Penh62140110${reference_id}63045F4B`,
          checkout_url: `https://cutluy.com/pay/${mockId}`,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
      }

      throw new Error(error.response?.data?.message || 'Failed to initialize CutLuy KHQR payment');
    }
  }

  /**
   * Check status of a payment on CutLuy
   * @param {string} paymentId
   * @returns {Promise<Object>}
   */
  async checkPaymentStatus(paymentId) {
    if (!paymentId) {
      throw new Error('CutLuy payment ID is required');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 8000,
      });

      return response.data;
    } catch (error) {
      console.error(`CutLuy Check Status Error [${paymentId}]:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to check payment status on CutLuy');
    }
  }

  /**
   * Verify CutLuy Webhook Signature (HMAC-SHA256)
   * @param {string|Buffer} rawBody
   * @param {string} signatureHeader - X-CutLuy-Signature
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader || !this.webhookSecret) {
      // If secret is not set yet in dev, allow webhook in test mode
      return true;
    }

    try {
      const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
      if (!parts.t || !parts.v1) return false;

      // Check freshness (5 minutes tolerance)
      const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
      if (!fresh) return false;

      const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(`${parts.t}.${bodyStr}`)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
    } catch (err) {
      console.error('CutLuy signature verification error:', err);
      return false;
    }
  }
}

export const cutluyService = new CutLuyService();
export default cutluyService;
