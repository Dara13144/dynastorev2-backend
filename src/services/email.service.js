import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';
import { supabase, isConfigured } from '../config/supabase.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (ENV.SMTP.USER && ENV.SMTP.PASS) {
      try {
        this.transporter = nodemailer.createTransport({
          host: ENV.SMTP.HOST,
          port: ENV.SMTP.PORT,
          secure: ENV.SMTP.SECURE || ENV.SMTP.PORT === 465,
          auth: {
            user: ENV.SMTP.USER,
            pass: ENV.SMTP.PASS,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        console.log(`📧 SMTP Email service initialized for ${ENV.SMTP.USER} (${ENV.SMTP.HOST})`);
      } catch (err) {
        console.warn('⚠️ SMTP Transporter initialization warning:', err.message);
      }
    }
  }

  /**
   * Send Password Reset Verification Email
   * @param {string} email
   * @param {string} resetCode 6-digit numeric OTP
   * @param {string} resetToken Signed token for direct reset link
   * @param {string} username
   */
  async sendPasswordResetEmail({ email, resetCode, resetToken, username }) {
    const frontendUrl = ENV.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/forgot-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(resetCode)}&token=${encodeURIComponent(resetToken || '')}`;

    const subject = `🔒 Your DynaStore Password Reset Code: ${resetCode}`;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #334155; }
    .logo { width: 56px; height: 56px; border-radius: 50%; background: #ffffff; padding: 4px; display: inline-block; margin-bottom: 12px; }
    .title { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 0.5px; }
    .subtitle { color: #38bdf8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .greeting { font-size: 15px; color: #cbd5e1; margin-bottom: 16px; }
    .otp-container { background: #090d16; border: 1px solid #0284c7; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 8px; }
    .otp-code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .button-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #020617 !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; letter-spacing: 0.5px; }
    .footer { background: #0b0f19; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
    .warning { color: #f43f5e; font-size: 12px; margin-top: 16px; background: rgba(244,63,94,0.1); padding: 12px; border-radius: 10px; border: 1px solid rgba(244,63,94,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Dyna<span style="color:#38bdf8">Store</span></div>
      <div class="subtitle">Security & Account Recovery</div>
    </div>
    <div class="content">
      <div class="greeting">Hello <strong>${username || 'Gamer'}</strong>,</div>
      <p style="color: #94a3b8; font-size: 14px;">
        We received a request to reset the password for your DynaStore account associated with <strong>${email}</strong>.
      </p>
      
      <div class="otp-container">
        <div class="otp-label">Your 6-Digit Verification Code</div>
        <div class="otp-code">${resetCode}</div>
      </div>

      <div class="button-container">
        <a href="${resetUrl}" class="btn">Reset Password Directly</a>
      </div>

      <div class="warning">
        ⏱️ This code will expire in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your account remains secure.
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
          from: ENV.SMTP.FROM,
          to: email,
          subject,
          html,
        });
        console.log(`✅ Password reset email sent via SMTP to ${email}: ${info.messageId}`);
        delivered = true;
      } catch (smtpErr) {
        console.warn(`⚠️ SMTP send error to ${email}:`, smtpErr.message);
      }
    }

    // 2. Also trigger Supabase Auth reset email if configured
    if (isConfigured && supabase) {
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

    // Always log OTP for development & live fallback
    console.log(`🔑 [DynaStore Password Reset OTP] Email: ${email} | Code: ${resetCode} | Direct URL: ${resetUrl}`);

    return {
      success: true,
      delivered,
      email,
      resetCode,
      resetUrl,
    };
  }
}

export const emailService = new EmailService();
