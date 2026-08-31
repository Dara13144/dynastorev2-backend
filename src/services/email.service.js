import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';
import { supabase, isConfigured } from '../config/supabase.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const smtpUser = process.env.SMTP_USER || ENV.SMTP.USER;
    const smtpPass = process.env.SMTP_PASS || ENV.SMTP.PASS;
    const smtpHost = process.env.SMTP_HOST || ENV.SMTP.HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || ENV.SMTP.PORT || 465);

    if (smtpUser && smtpPass) {
      try {
        const isGmail = smtpHost.includes('gmail') || smtpUser.includes('@gmail.com');
        const transportConfig = isGmail
          ? {
              service: 'gmail',
              auth: {
                user: smtpUser,
                pass: smtpPass,
              },
            }
          : {
              host: smtpHost,
              port: smtpPort,
              secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
              auth: {
                user: smtpUser,
                pass: smtpPass,
              },
              tls: {
                rejectUnauthorized: false,
              },
            };

        this.transporter = nodemailer.createTransport(transportConfig);
        console.log(`📧 Real Gmail SMTP service connected for ${smtpUser}`);
      } catch (err) {
        console.warn('⚠️ SMTP Transporter initialization warning:', err.message);
      }
    }
  }

  /**
   * Universal OTP Email Sender for Gmail
   * @param {Object} options
   * @param {string} options.email Target recipient
   * @param {string} options.otpCode 6-digit numeric OTP code
   * @param {string} [options.username] Username / display name
   * @param {string} [options.type] 'PASSWORD_RESET' | 'LOGIN_OTP' | 'EMAIL_VERIFY'
   * @param {string} [options.token] Optional signed JWT reset token
   */
  async sendOtpEmail({ email, otpCode, username = 'Gamer', type = 'PASSWORD_RESET', token = '' }) {
    const frontendUrl = ENV.FRONTEND_URL || 'http://localhost:5173';
    let subject = `🔒 Your DynaStore Verification Code: ${otpCode}`;
    let heading = 'Verification Code';
    let subHeading = 'Security Verification';
    let actionDesc = 'Use the 6-digit verification code below to verify your Gmail account:';
    let directButton = null;

    if (type === 'PASSWORD_RESET') {
      subject = `🔒 Your DynaStore Password Reset Code: ${otpCode}`;
      heading = 'Password Reset Code';
      subHeading = 'Account Recovery';
      actionDesc = 'We received a request to reset your DynaStore account password. Use this 6-digit code:';
      const resetUrl = `${frontendUrl}/forgot-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpCode)}&token=${encodeURIComponent(token)}`;
      directButton = `<div style="text-align: center; margin: 28px 0;"><a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #020617 !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; letter-spacing: 0.5px;">Reset Password Directly</a></div>`;
    } else if (type === 'LOGIN_OTP') {
      subject = `⚡ Your DynaStore 1-Click Login Code: ${otpCode}`;
      heading = '1-Click Login Code';
      subHeading = 'Instant Gmail Sign-In';
      actionDesc = 'Use the 6-digit code below to log in to your DynaStore account instantly:';
    } else if (type === 'EMAIL_VERIFY') {
      subject = `✨ Verify Your Gmail for DynaStore: ${otpCode}`;
      heading = 'Email Verification';
      subHeading = 'Account Activation';
      actionDesc = 'Please verify your Gmail address to activate your DynaStore account & game library:';
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #334155; }
    .title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 0.5px; }
    .subtitle { color: #38bdf8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .greeting { font-size: 15px; color: #cbd5e1; margin-bottom: 16px; }
    .otp-container { background: #090d16; border: 1px solid #0284c7; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 8px; }
    .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .footer { background: #0b0f19; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
    .warning { color: #f43f5e; font-size: 12px; margin-top: 16px; background: rgba(244,63,94,0.1); padding: 12px; border-radius: 10px; border: 1px solid rgba(244,63,94,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Dyna<span style="color:#38bdf8">Store</span></div>
      <div class="subtitle">${subHeading}</div>
    </div>
    <div class="content">
      <div class="greeting">Hello <strong>${username}</strong>,</div>
      <p style="color: #94a3b8; font-size: 14px;">
        ${actionDesc}
      </p>
      
      <div class="otp-container">
        <div class="otp-label">${heading}</div>
        <div class="otp-code">${otpCode}</div>
      </div>

      ${directButton || ''}

      <div class="warning">
        ⏱️ This verification code is valid for <strong>15 minutes</strong>. If you did not request this code, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      &copy; 2026 DynaStore Cambodia. All rights reserved.<br>
      Digital Game Marketplace & Instant Bakong KHQR Delivery
    </div>
  </div>
</body>
</html>
`;

    let delivered = false;

    // 1. Try sending via SMTP / Gmail Transporter
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: ENV.SMTP.FROM || `DynaStore Security <${ENV.SMTP.USER}>`,
          to: email,
          subject,
          html,
        });
        console.log(`✅ [Real Gmail] OTP email sent via SMTP to ${email}: ${info.messageId}`);
        delivered = true;
      } catch (smtpErr) {
        console.warn(`⚠️ SMTP send error to ${email}:`, smtpErr.message);
      }
    }

    // 2. Also trigger Supabase Auth reset email if configured and password reset
    if (type === 'PASSWORD_RESET' && isConfigured && supabase) {
      try {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${frontendUrl}/forgot-password`,
        });
        console.log(`✅ Supabase Auth password reset email requested for ${email}`);
        delivered = true;
      } catch (supaErr) {
        console.warn(`Supabase reset email notice for ${email}:`, supaErr.message);
      }
    }

    // Always log OTP for development & monitoring
    console.log(`🔑 [DynaStore OTP] Recipient: ${email} | Type: ${type} | Code: ${otpCode}`);

    return {
      success: true,
      delivered,
      email,
      otpCode,
    };
  }

  // Alias for backward compatibility
  async sendPasswordResetEmail({ email, resetCode, resetToken, username }) {
    return this.sendOtpEmail({
      email,
      otpCode: resetCode,
      username,
      type: 'PASSWORD_RESET',
      token: resetToken,
    });
  }
}

export const emailService = new EmailService();

