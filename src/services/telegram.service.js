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
   * Resolve IP location details via public geolocation API
   */
  async resolveIpLocation(ip) {
    try {
      let targetIp = ip;
      // If local/loopback or private subnet, detect external public IP
      if (
        !targetIp ||
        targetIp === '127.0.0.1' ||
        targetIp === '::1' ||
        targetIp.startsWith('192.168.') ||
        targetIp.startsWith('10.') ||
        targetIp.startsWith('172.16.') ||
        targetIp.startsWith('::ffff:127.')
      ) {
        try {
          const pubRes = await axios.get('https://api.ipify.org?format=json', { timeout: 2500 });
          if (pubRes.data?.ip) {
            targetIp = pubRes.data.ip;
          }
        } catch (e) {
          // ignore
        }
      }

      const geoUrl = `http://ip-api.com/json/${targetIp}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
      const res = await axios.get(geoUrl, { timeout: 3500 });
      if (res.data?.status === 'success') {
        return {
          ip: res.data.query || targetIp,
          country: res.data.country || 'Unknown',
          countryCode: res.data.countryCode || '',
          region: res.data.regionName || '',
          city: res.data.city || 'Unknown',
          lat: res.data.lat,
          lon: res.data.lon,
          timezone: res.data.timezone || '',
          isp: res.data.isp || res.data.org || 'Unknown ISP',
        };
      }
    } catch (err) {
      // ignore
    }
    return {
      ip: ip || '127.0.0.1',
      country: 'Unknown',
      countryCode: '',
      region: '',
      city: 'Unknown',
      lat: null,
      lon: null,
      timezone: '',
      isp: 'Unknown Network',
    };
  }

  /**
   * Send native Telegram Interactive Location Pin
   */
  async sendLocation(latitude, longitude) {
    if (!this.isConfigured || !latitude || !longitude) return;
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendLocation`;
      await axios.post(url, {
        chat_id: this.adminChatId,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });
    } catch (e) {
      console.warn('Telegram sendLocation notice:', e.message);
    }
  }

  /**
   * Notify Telegram Bot when Admin or User logs in with IP, Geolocation, Device & Google Maps Link
   */
  async notifyLoginAlert({ user, req, loginMethod = 'Email & Password', clientGeo = null }) {
    if (!this.isConfigured || !user) return;

    // Strictly send location and login alerts for ADMIN accounts only
    if (user.role !== 'ADMIN') {
      return;
    }

    try {
      // 1. Resolve client IP
      const forwarded = req?.headers?.['x-forwarded-for'];
      const rawIp = forwarded ? forwarded.split(',')[0].trim() : (req?.socket?.remoteAddress || req?.ip || '127.0.0.1');
      const cleanIp = rawIp.replace(/^::ffff:/, '');

      // 2. Resolve Geolocation
      const geo = await this.resolveIpLocation(cleanIp);
      const lat = clientGeo?.lat || clientGeo?.latitude || geo.lat;
      const lon = clientGeo?.lon || clientGeo?.longitude || geo.lon;

      // 3. Resolve User Agent / Device
      const userAgent = req?.headers?.['user-agent'] || 'Unknown Device';
      const isMobile = /mobile|iphone|android|ipad/i.test(userAgent);
      const deviceIcon = isMobile ? '📱 Mobile Device' : '💻 Desktop PC';

      const isAdmin = user.role === 'ADMIN';
      const roleBadge = isAdmin ? '👑 <b>ADMINISTRATOR</b>' : '🎮 Standard User';

      // 4. Build Google Maps Link
      let mapLink = '';
      if (lat && lon) {
        mapLink = `\n📍 <b>Google Maps:</b> <a href="https://www.google.com/maps?q=${lat},${lon}">View Live Coordinates (${lat}, ${lon})</a>`;
      }

      // Convert 2-letter country code to flag emoji
      const flagEmoji = geo.countryCode
        ? String.fromCodePoint(...[...geo.countryCode.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65))
        : '🌍';

      const alertHeader = isAdmin
        ? `🚨 <b>DynaStore SECURITY ALERT - Admin Login Detected!</b> 🚨`
        : `🔔 <b>DynaStore - User Login Event</b>`;

      const text = `${alertHeader}\n\n` +
        `👤 <b>User:</b> ${user.username || 'Gamer'}\n` +
        `📧 <b>Email:</b> <code>${user.email}</code>\n` +
        `🛡️ <b>Role:</b> ${roleBadge}\n` +
        `🔑 <b>Login Method:</b> ${loginMethod}\n\n` +
        `🌐 <b>IP Address:</b> <code>${geo.ip || cleanIp}</code>\n` +
        `${flagEmoji} <b>Location:</b> ${geo.city}${geo.region ? ', ' + geo.region : ''}, ${geo.country}\n` +
        `🏢 <b>ISP / Network:</b> ${geo.isp}\n` +
        (geo.timezone ? `⏳ <b>Timezone:</b> ${geo.timezone}\n` : '') +
        `🖥️ <b>Platform:</b> ${deviceIcon}\n` +
        `🔍 <b>User Agent:</b> <code>${userAgent.slice(0, 100)}...</code>` +
        `${mapLink}\n\n` +
        `⏰ <b>Timestamp:</b> ${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}`;

      // Send HTML Summary Message
      await this.sendMessage(text);

      // Send interactive Map Pin on Telegram if coordinates exist
      if (lat && lon) {
        await this.sendLocation(lat, lon);
      }
    } catch (error) {
      console.error('Telegram notifyLoginAlert error:', error.message);
    }
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

