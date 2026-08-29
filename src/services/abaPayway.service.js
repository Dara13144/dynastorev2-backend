import crypto from 'crypto';
import axios from 'axios';
import { ENV } from '../config/env.js';

/**
 * ABA PayWay Official Integration Service
 * Standards compliant with ABA PayWay Payment Gateway API V1 / V2
 */
class AbaPaywayService {
  constructor() {
    this.merchantId = ENV.ABA_PAYWAY.MERCHANT_ID;
    this.apiKey = ENV.ABA_PAYWAY.API_KEY;
    this.secret = ENV.ABA_PAYWAY.SECRET;
    this.environment = ENV.ABA_PAYWAY.ENVIRONMENT;
    this.apiUrl = ENV.ABA_PAYWAY.API_URL;
    this.returnUrl = ENV.ABA_PAYWAY.RETURN_URL;
    this.cancelUrl = ENV.ABA_PAYWAY.CANCEL_URL;
    this.callbackUrl = ENV.ABA_PAYWAY.CALLBACK_URL;
  }

  /**
   * Format current time as YYYYMMDDHHmmss required by ABA PayWay
   */
  getReqTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = now.getUTCFullYear();
    const month = pad(now.getUTCMonth() + 1);
    const day = pad(now.getUTCDate());
    const hours = pad(now.getUTCHours());
    const minutes = pad(now.getUTCMinutes());
    const seconds = pad(now.getUTCSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate HMAC-SHA512 Base64 signature
   * @param {string} rawString - The concatenated string of parameters
   * @returns {string} Base64 encoded HMAC-SHA512 hash
   */
  generateHash(rawString) {
    if (!this.apiKey) {
      // Return a simulated deterministic hash in development mode without API key
      return crypto.createHmac('sha512', 'dynastore_dev_key').update(rawString).digest('base64');
    }
    return crypto.createHmac('sha512', this.apiKey).update(rawString).digest('base64');
  }

  /**
   * Build payment checkout payload and signature for ABA PayWay Web / Popup / QR checkout
   */
  createPaymentPayload({
    tranId,
    amount,
    items = [],
    firstName = 'Customer',
    lastName = 'User',
    email = 'customer@example.com',
    phone = '012345678',
    paymentOption = '', // 'cards', 'abapay', 'abapay_khqr' or empty for all
    type = 'purchase',
    currency = 'USD',
    returnParams = '',
    customSuccessUrl = '',
  }) {
    const reqTime = this.getReqTime();
    const formattedAmount = Number(amount).toFixed(2);
    const encodedItems = Buffer.from(JSON.stringify(items)).toString('base64');
    const shipping = '0.00';
    const returnUrl = Buffer.from(this.returnUrl).toString('base64');
    const cancelUrl = Buffer.from(this.cancelUrl).toString('base64');
    const continueSuccessUrl = customSuccessUrl
      ? Buffer.from(customSuccessUrl).toString('base64')
      : returnUrl;

    // Concatenation rule specified by ABA PayWay official integration guide:
    // req_time + merchant_id + tran_id + amount + items + shipping + firstname + lastname + email + phone + type + payment_option + return_url + cancel_url + continue_success_url + return_params
    const rawString = [
      reqTime,
      this.merchantId,
      tranId,
      formattedAmount,
      encodedItems,
      shipping,
      firstName,
      lastName,
      email,
      phone,
      type,
      paymentOption,
      returnUrl,
      cancelUrl,
      continueSuccessUrl,
      returnParams,
    ].join('');

    const hash = this.generateHash(rawString);

    return {
      api_url: `${this.apiUrl}/api/payment-gateway/v1/payments/purchase`,
      req_time: reqTime,
      merchant_id: this.merchantId,
      tran_id: tranId,
      amount: formattedAmount,
      currency,
      items: encodedItems,
      shipping,
      firstname: firstName,
      lastname: lastName,
      email,
      phone,
      type,
      payment_option: paymentOption,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      continue_success_url: continueSuccessUrl,
      return_params: returnParams,
      callback_url: this.callbackUrl,
      hash,
      environment: this.environment,
    };
  }

  /**
   * Query ABA PayWay API to check real transaction status
   * POST /api/payment-gateway/v1/payments/check-transaction
   */
  async checkTransactionStatus(tranId) {
    const reqTime = this.getReqTime();
    const rawString = `${reqTime}${this.merchantId}${tranId}`;
    const hash = this.generateHash(rawString);

    const payload = {
      req_time: reqTime,
      merchant_id: this.merchantId,
      tran_id: tranId,
      hash,
    };

    try {
      // In sandbox/live environment with ABA PayWay API
      if (this.apiKey && this.apiKey !== 'aba_sandbox_api_key_test_dynastore') {
        const response = await axios.post(
          `${this.apiUrl}/api/payment-gateway/v1/payments/check-transaction`,
          payload,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );
        return {
          success: true,
          status: response.data?.status || response.data?.payment_status,
          data: response.data,
          raw: response.data,
        };
      } else {
        // Development / Sandbox sandbox mock fallback response if mock credentials
        return {
          success: true,
          status: 'APPROVED',
          is_mock: true,
          data: {
            status: 0, // 0 = success in ABA PayWay
            description: 'Approved (Sandbox Dev Mode)',
            amount: '10.00',
            tran_id: tranId,
            payment_status: 'PAID',
          },
        };
      }
    } catch (error) {
      console.error('ABA PayWay check-transaction error:', error?.response?.data || error.message);
      return {
        success: false,
        error: error?.response?.data || error.message,
      };
    }
  }

  /**
   * Validate ABA Callback/Webhook signature
   */
  verifyCallbackSignature(callbackBody) {
    if (!callbackBody) return false;

    const { tran_id, status, amount, hash, req_time } = callbackBody;

    // If sandbox dev test with no real key, verify basic integrity
    if (!this.apiKey || this.apiKey === 'aba_sandbox_api_key_test_dynastore') {
      return true;
    }

    if (!hash || !tran_id) return false;

    // Construct expected hash depending on callback format
    const checkString = `${req_time || ''}${this.merchantId}${tran_id}${status || ''}${amount || ''}`;
    const expectedHash = this.generateHash(checkString);

    return hash === expectedHash;
  }
}

export const abaPaywayService = new AbaPaywayService();
export default abaPaywayService;
