import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { db } from '../utils/db.js';

const BASE_URL = 'http://127.0.0.1:5001/api';

test('E2E - Health Check', async () => {
  const res = await axios.get(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
});

test('E2E - Authentication & JWT Login', async () => {
  const res = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'gamer@dynastore.com',
    password: 'Admin@123',
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.token, 'Should return JWT token');
  assert.equal(res.data.user.email, 'gamer@dynastore.com');

  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${res.data.token}` },
  });
  assert.equal(meRes.status, 200);
  assert.ok(meRes.data.user.username);
});

test('E2E - Google OAuth Login & Profile Creation', async () => {
  const googleEmail = `google_gamer_${Date.now()}@gmail.com`;
  const res = await axios.post(`${BASE_URL}/auth/google`, {
    email: googleEmail,
    name: 'Sokha Gaming',
    picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  });

  assert.equal(res.status, 200);
  assert.ok(res.data.token, 'Must return JWT token');
  assert.equal(res.data.user.email, googleEmail);
  assert.equal(res.data.user.role, 'USER');

  // Verify access with Google JWT
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${res.data.token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.email, googleEmail);
});

test('E2E - Complete 10-Step OTP Forgot Password & Reset Flow', async () => {
  const resetTargetEmail = 'gamer@dynastore.com';

  // 1. Request OTP
  const forgotRes = await axios.post(`${BASE_URL}/auth/forgot-password`, {
    email: resetTargetEmail,
  });
  assert.equal(forgotRes.status, 200);
  assert.ok(forgotRes.data.success);
  const otpCode = forgotRes.data.otpCode;
  assert.ok(otpCode, 'OTP code must be generated');

  // 2. Wrong OTP fails
  try {
    await axios.post(`${BASE_URL}/auth/verify-otp`, {
      email: resetTargetEmail,
      otp: '000000',
    });
    assert.fail('Wrong OTP should have failed');
  } catch (err) {
    assert.equal(err.response?.status, 400);
    assert.ok(err.response?.data?.message?.includes('Invalid'));
  }

  // 3. Resend OTP creates fresh valid code
  const resendRes = await axios.post(`${BASE_URL}/auth/resend-otp`, {
    email: resetTargetEmail,
  });
  assert.equal(resendRes.status, 200);
  const freshOtp = resendRes.data.otpCode;
  assert.ok(freshOtp, 'New OTP must be generated upon resend');

  // 4. Correct OTP verification yields Reset Token
  const verifyRes = await axios.post(`${BASE_URL}/auth/verify-otp`, {
    email: resetTargetEmail,
    otp: freshOtp,
  });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.data.success);
  assert.ok(verifyRes.data.resetToken, 'Must issue single-use reset authorization token');
  const resetToken = verifyRes.data.resetToken;

  // 5. Reuse OTP is rejected
  try {
    await axios.post(`${BASE_URL}/auth/verify-otp`, {
      email: resetTargetEmail,
      otp: freshOtp,
    });
    assert.fail('Reusing consumed OTP should be rejected');
  } catch (err) {
    assert.equal(err.response?.status, 400);
  }

  // 6. Reset password with new password (min 8 chars)
  const newSecretPassword = 'UltraSecurePassword2026!';
  const resetRes = await axios.post(`${BASE_URL}/auth/reset-password`, {
    resetToken,
    newPassword: newSecretPassword,
  });
  assert.equal(resetRes.status, 200);
  assert.ok(resetRes.data.success);

  // 7. Reuse reset token is rejected
  try {
    await axios.post(`${BASE_URL}/auth/reset-password`, {
      resetToken,
      newPassword: 'AnotherPassword999!',
    });
    assert.fail('Reusing consumed resetToken should be rejected');
  } catch (err) {
    assert.equal(err.response?.status, 400);
  }

  // 8. Old password fails
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: resetTargetEmail,
      password: 'OldWrongPassword123!',
    });
    assert.fail('Old password should fail');
  } catch (err) {
    assert.equal(err.response?.status, 401);
  }

  // 9. New password succeeds
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: resetTargetEmail,
    password: newSecretPassword,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);

  // 10. Revert back for other tests
  const revertHash = '$2a$10$Y1s162xN48943.4Qx4B18OB2vQ8YQ81dF26mQ6v0147B.B0874y3.';
  await db.updateUserPassword({ email: resetTargetEmail, newPassword: 'Admin@123', newPasswordHash: revertHash });
});

test('E2E - Real Gmail OTP Dispatch & Passwordless Sign-In', async () => {
  const otpGmail = `pro_player_${Date.now()}@gmail.com`;

  // 1. Dispatch OTP code to Gmail
  const sendRes = await axios.post(`${BASE_URL}/auth/send-otp`, {
    email: otpGmail,
    type: 'LOGIN_OTP',
  });
  assert.equal(sendRes.status, 200);
  assert.ok(sendRes.data.success);
  assert.ok(sendRes.data.otpCode, 'Must return OTP code in dev mode');

  const otpCode = sendRes.data.otpCode;

  // 2. Verify OTP code
  const verifyRes = await axios.post(`${BASE_URL}/auth/verify-otp`, {
    email: otpGmail,
    code: otpCode,
  });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.data.success);

  // 3. Passwordless Login via Gmail OTP
  const loginRes = await axios.post(`${BASE_URL}/auth/otp-login`, {
    email: otpGmail,
    token: verifyRes.data.resetToken,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token, 'Should issue JWT token for verified Gmail OTP user');
  assert.equal(loginRes.data.user.email, otpGmail);

  // 4. Verify authenticated session
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${loginRes.data.token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.email, otpGmail);
});

test('E2E - Products Catalog & Categories', async () => {
  const prodRes = await axios.get(`${BASE_URL}/products`);
  assert.equal(prodRes.status, 200);
  assert.ok(Array.isArray(prodRes.data.products), 'Products should be an array');

  const catRes = await axios.get(`${BASE_URL}/categories`);
  assert.equal(catRes.status, 200);
  assert.ok(Array.isArray(catRes.data.categories), 'Categories should be an array');
});

test('E2E - Wallet Top-Up & ABA Callback Idempotency', async () => {
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'gamer@dynastore.com',
    password: 'Admin@123',
  });
  const token = loginRes.data.token;
  const initialBalance = Number(loginRes.data.user.balance);

  const depRes = await axios.post(
    `${BASE_URL}/wallet/deposit`,
    { amount: 15.00 },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(depRes.status, 201);
  const tranId = depRes.data.transactionId;
  assert.ok(tranId, 'Transaction ID should be returned');

  const cbRes1 = await axios.post(`${BASE_URL}/payments/aba/callback`, {
    tran_id: tranId,
    status: '00',
    amount: '15.00',
  });
  assert.equal(cbRes1.status, 200);

  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(Number(meRes.data.user.balance).toFixed(2), (initialBalance + 15.00).toFixed(2));

  // Repeat callback (Idempotency test)
  const cbRes2 = await axios.post(`${BASE_URL}/payments/aba/callback`, {
    tran_id: tranId,
    status: '00',
    amount: '15.00',
  });
  assert.equal(cbRes2.status, 200);

  const meResAfter = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(Number(meResAfter.data.user.balance).toFixed(2), (initialBalance + 15.00).toFixed(2));
});

test('E2E - CutLuy KHQR Payment, Polling & Auto Fulfill', async () => {
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'gamer@dynastore.com',
    password: 'Admin@123',
  });
  const token = loginRes.data.token;
  const initialBalance = Number(loginRes.data.user.balance);

  // 1. Create CutLuy KHQR Payment session
  const cutluyRes = await axios.post(
    `${BASE_URL}/payments/cutluy/create`,
    { amount: 5.00, paymentType: 'WALLET_DEPOSIT' },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  assert.equal(cutluyRes.status, 201);
  assert.ok(cutluyRes.data.transactionId, 'Must have transactionId');
  assert.ok(cutluyRes.data.qrString || cutluyRes.data.qrSvgUrl, 'Must return KHQR string or SVG');

  const tranId = cutluyRes.data.transactionId;

  // 2. Webhook fulfillment
  const webhookRes = await axios.post(`${BASE_URL}/payments/cutluy/webhook`, {
    type: 'payment.completed',
    data: {
      payment: {
        id: cutluyRes.data.cutluyId,
        status: 'paid',
        amount: '5.00',
        reference_id: tranId,
      },
    },
  });
  assert.equal(webhookRes.status, 200);

  // 3. Verify status polling confirms PAID
  const statusRes = await axios.get(`${BASE_URL}/payments/cutluy/status/${tranId}`);
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.status, 'PAID');

  // 4. Verify wallet balance credited
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(Number(meRes.data.user.balance).toFixed(2), (initialBalance + 5.00).toFixed(2));
});

test('E2E - Purchase Flow, Order Completion & Secure Signed Download', async () => {
  // Use unique new test user to avoid state conflicts
  const uniqueEmail = `testbuyer_${Date.now()}@dynastore.com`;
  const regRes = await axios.post(`${BASE_URL}/auth/register`, {
    email: uniqueEmail,
    username: `buyer_${Date.now()}`,
    password: 'Admin@123',
  });
  const token = regRes.data.token;

  // Get active product dynamically
  const prodsRes = await axios.get(`${BASE_URL}/products`);
  let testProduct = prodsRes.data?.products?.[0];
  if (!testProduct) {
    testProduct = await db.createProduct({
      title: 'CyberPulse 2077 Test',
      slug: `cyberpulse-test-${Date.now()}`,
      price: 19.99,
      is_published: true,
      file_path: 'games/cyberpulse.zip',
    });
  }
  const productId = testProduct.id;

  // Unpurchased product download test -> MUST return 403
  try {
    await axios.get(`${BASE_URL}/downloads/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.fail('Should have thrown 403 for unpurchased product');
  } catch (err) {
    assert.equal(err.response ? err.response.status : 500, 403, 'Must reject unpurchased game download with 403');
  }

  // Top up user balance first
  const depRes = await axios.post(
    `${BASE_URL}/wallet/deposit`,
    { amount: 50.00 },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  await axios.post(`${BASE_URL}/payments/aba/callback`, {
    tran_id: depRes.data.transactionId,
    status: '00',
    amount: '50.00',
  });
  await new Promise((r) => setTimeout(r, 300));

  // Complete purchase using Wallet Balance
  const orderRes = await axios.post(
    `${BASE_URL}/orders`,
    {
      productIds: [productId],
      paymentMethod: 'WALLET_BALANCE',
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.data.status, 'PAID');

  // Now test secure download -> MUST succeed
  const dlRes = await axios.get(`${BASE_URL}/downloads/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(dlRes.status, 200);
  assert.ok(dlRes.data.downloadUrl, 'Signed download URL must be present');
});

test('E2E - Admin Authorization & Metrics', async () => {
  const userLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'gamer@dynastore.com',
    password: 'Admin@123',
  });
  try {
    await axios.get(`${BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${userLogin.data.token}` },
    });
    assert.fail('User should be denied admin access');
  } catch (err) {
    assert.equal(err.response ? err.response.status : 500, 403);
  }

  const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com',
    password: 'dynastoeoroqeiyrp9wIERYIUqwehyrIU',
  });
  const adminToken = adminLogin.data.token;

  const dashRes = await axios.get(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(dashRes.status, 200);
  assert.ok(dashRes.data.metrics.totalUsers >= 1);
  assert.ok(typeof dashRes.data.metrics.totalProducts === 'number');
});

test('E2E - Admin Image Upload & Product Creation with Images', async () => {
  const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com',
    password: 'dynastoeoroqeiyrp9wIERYIUqwehyrIU',
  });
  const adminToken = adminLogin.data.token;

  // 1. Create FormData with a test image
  const formData = new FormData();
  const blob = new Blob([Buffer.from('fake-png-image-binary-data')], { type: 'image/png' });
  formData.append('file', blob, 'test_cover.png');
  formData.append('bucket', 'product-images');

  const uploadRes = await axios.post(`${BASE_URL}/admin/upload`, formData, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  assert.equal(uploadRes.status, 200);
  assert.ok(uploadRes.data.success);
  assert.ok(uploadRes.data.publicUrl, 'Should return public image URL');

  // 2. Create product with uploaded cover image
  const prodRes = await axios.post(
    `${BASE_URL}/admin/products`,
    {
      title: `Neon Horizon ${Date.now()}`,
      slug: `neon-horizon-${Date.now()}`,
      price: 29.99,
      cover_image: uploadRes.data.publicUrl,
      screenshots: [uploadRes.data.publicUrl],
      is_published: true,
      file_path: 'games/neon_horizon.zip',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  assert.equal(prodRes.status, 201);
  assert.ok(prodRes.data.product);
  assert.equal(prodRes.data.product.cover_image, uploadRes.data.publicUrl);
});

test('E2E - Telegram Login & User Account Provisioning', async () => {
  const tgUser = {
    id: 987654321,
    first_name: 'Dara',
    last_name: 'Sok',
    username: `dara_tg_${Date.now()}`,
    photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=dara_tg',
  };

  const tgRes = await axios.post(`${BASE_URL}/auth/telegram`, tgUser);
  assert.equal(tgRes.status, 200);
  assert.ok(tgRes.data.success);
  assert.ok(tgRes.data.token, 'Should issue JWT token for Telegram login');
  assert.equal(tgRes.data.user.role, 'USER');
  assert.ok(tgRes.data.user.email.includes('telegram.dynastore.site'));

  // Test authenticated request with Telegram JWT
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${tgRes.data.token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.email, tgRes.data.user.email);
});

test('E2E - Telegram QR Code Scan Login, Polling & Auto-Confirmation Flow', async () => {
  // 1. Create QR Session
  const createRes = await axios.post(`${BASE_URL}/auth/telegram/qr/create`);
  assert.equal(createRes.status, 200);
  assert.ok(createRes.data.sessionId, 'Should return a unique sessionId');
  assert.ok(createRes.data.deepLink, 'Should return Telegram deepLink');

  const sessionId = createRes.data.sessionId;

  // 2. Poll initial status (should be PENDING)
  const initialStatus = await axios.get(`${BASE_URL}/auth/telegram/qr/status/${sessionId}`);
  assert.equal(initialStatus.status, 200);
  assert.equal(initialStatus.data.status, 'PENDING');

  // 3. Confirm QR scan (simulating user phone scanning QR)
  const confirmRes = await axios.post(`${BASE_URL}/auth/telegram/qr/confirm`, {
    sessionId,
    id: 1122334455,
    username: `qr_gamer_${Date.now()}`,
    first_name: 'QR',
    last_name: 'Player',
  });
  assert.equal(confirmRes.status, 200);
  assert.ok(confirmRes.data.success);
  assert.ok(confirmRes.data.token);

  // 4. Poll confirmed status (should be CONFIRMED with token)
  const confirmedStatus = await axios.get(`${BASE_URL}/auth/telegram/qr/status/${sessionId}`);
  assert.equal(confirmedStatus.status, 200);
  assert.equal(confirmedStatus.data.status, 'CONFIRMED');
  assert.ok(confirmedStatus.data.token, 'Must return signed JWT token on CONFIRMED status');
  assert.ok(confirmedStatus.data.user, 'Must return safe user object');

  // 5. Test authenticated session with returned token
  const meRes = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${confirmedStatus.data.token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.user.id, confirmedStatus.data.user.id);
});

test('E2E - Cross-Device QR Code Authorization & Session Transfer', async () => {
  // 1. Authenticate primary device (Phone / Admin)
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com',
    password: 'dynastoeoroqeiyrp9wIERYIUqwehyrIU',
  });
  const phoneToken = loginRes.data.token;

  // 2. PC creates new device QR session
  const devQrRes = await axios.post(`${BASE_URL}/auth/device-qr/create`);
  assert.equal(devQrRes.status, 200);
  assert.ok(devQrRes.data.sessionId);
  assert.ok(devQrRes.data.qrUrl);

  const sessionId = devQrRes.data.sessionId;

  // 3. PC checks initial status (PENDING)
  const initialStatus = await axios.get(`${BASE_URL}/auth/device-qr/status/${sessionId}`);
  assert.equal(initialStatus.status, 200);
  assert.equal(initialStatus.data.status, 'PENDING');

  // 4. Phone authorizes the PC session
  const authRes = await axios.post(
    `${BASE_URL}/auth/device-qr/authorize`,
    { sessionId },
    { headers: { Authorization: `Bearer ${phoneToken}` } }
  );
  assert.equal(authRes.status, 200);
  assert.ok(authRes.data.success);

  // 5. PC polls approved status and receives new valid token
  const approvedStatus = await axios.get(`${BASE_URL}/auth/device-qr/status/${sessionId}`);
  assert.equal(approvedStatus.status, 200);
  assert.equal(approvedStatus.data.status, 'APPROVED');
  assert.ok(approvedStatus.data.token, 'Must return JWT token for new authorized PC');
  assert.equal(approvedStatus.data.user.role, 'ADMIN');

  // 6. Test PC authenticated access
  const pcMe = await axios.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${approvedStatus.data.token}` },
  });
  assert.equal(pcMe.status, 200);
  assert.equal(pcMe.data.user.role, 'ADMIN');
});



