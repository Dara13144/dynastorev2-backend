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

test('E2E - Forgot Password OTP & Recovery Flow', async () => {
  const resetTargetEmail = 'gamer@dynastore.com';

  // 1. Request password reset code
  const forgotRes = await axios.post(`${BASE_URL}/auth/forgot-password`, {
    email: resetTargetEmail,
  });
  assert.equal(forgotRes.status, 200);
  assert.ok(forgotRes.data.success);

  // 2. Perform reset using verification code
  const resetCode = forgotRes.data.resetCode;
  assert.ok(resetCode, 'Should receive reset code in response');

  const newPass = 'NewSecretPass123!';
  const resetRes = await axios.post(`${BASE_URL}/auth/reset-password`, {
    email: resetTargetEmail,
    code: resetCode,
    new_password: newPass,
  });
  assert.equal(resetRes.status, 200);
  assert.ok(resetRes.data.success);

  // 3. Verify login works with new password
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: resetTargetEmail,
    password: newPass,
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);

  // Revert back for other tests
  const revertHash = '$2a$10$Y1s162xN48943.4Qx4B18OB2vQ8YQ81dF26mQ6v0147B.B0874y3.';
  await db.updateUserPassword({ email: resetTargetEmail, newPassword: 'Admin@123', newPasswordHash: revertHash });
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
    email: 'admin@dynastore.com',
    password: 'Admin@123',
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
    email: 'admin@dynastore.com',
    password: 'Admin@123',
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
