import test from 'node:test';
import assert from 'node:assert/strict';
import { abaPaywayService } from '../services/abaPayway.service.js';
import { db } from '../utils/db.js';

test('ABA PayWay Service - Hash Generation & Payload creation', () => {
  const payload = abaPaywayService.createPaymentPayload({
    tranId: 'TEST-TRAN-12345',
    amount: 14.99,
    items: [{ name: 'Test Cyber Game', quantity: 1, price: '14.99' }],
    firstName: 'Sophea',
    lastName: 'Chan',
    email: 'sophea@example.com',
  });

  assert.ok(payload.hash, 'Hash must be generated');
  assert.equal(typeof payload.hash, 'string');
  assert.equal(payload.tran_id, 'TEST-TRAN-12345');
  assert.equal(payload.amount, '14.99');
  assert.ok(payload.req_time.length === 14, 'req_time must be YYYYMMDDHHmmss');
});

test('Database Adapter - Fetch products and seed data', async () => {
  const products = await db.getProducts({ isPublished: true });
  assert.ok(Array.isArray(products), 'Should return products array');
});

test('Database Adapter - Wallet adjustments and integrity', async () => {
  const testEmail = `test_wallet_${Date.now()}@example.com`;
  const user = await db.createUser({
    email: testEmail,
    username: 'WalletTester',
    balance: 50.00,
    role: 'USER',
  });
  assert.ok(user, 'Should create test user');

  const beforeBalance = user.balance;
  const result = await db.adjustWallet({
    userId: user.id,
    type: 'DEPOSIT',
    amount: 25.00,
    referenceId: 'TEST-DEP-001',
    description: 'Unit test top-up',
  });

  assert.equal(result.balance_after, beforeBalance + 25.00);

  // Test deduction
  const deductResult = await db.adjustWallet({
    userId: user.id,
    type: 'PURCHASE',
    amount: -10.00,
    referenceId: 'TEST-BUY-001',
    description: 'Unit test purchase',
  });

  assert.equal(deductResult.balance_after, beforeBalance + 15.00);
});
