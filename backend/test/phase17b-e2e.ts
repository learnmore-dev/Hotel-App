import 'dotenv/config';
import crypto from 'node:crypto';
import { getPrismaClient } from '../src/config/prisma.js';
import { generateAccessToken } from '../src/utils/jwt.js';

const BASE_URL = 'http://localhost:5000/api';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'trumitrip_local_secret_mock';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'trumitrip_local_webhook_secret';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedChecks++;
  console.log(`  ✅ PASSED: ${message}`);
}

async function api(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.log(`[API Error] ${options.method || 'GET'} ${path} returned ${res.status}:`, JSON.stringify(json));
  }
  return { status: res.status, ok: res.ok, data: json };
}

function computeSignature(orderId: string, paymentId: string, secret = RAZORPAY_KEY_SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function computeWebhookSignature(body: string, secret = RAZORPAY_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function runPhase17bE2E() {
  console.log('================================================================');
  console.log('🚀 STARTING PHASE 17B END-TO-END RAZORPAY VERIFICATION');
  console.log('================================================================');

  const prisma = getPrismaClient();

  // 1. Health check
  console.log('\n[1] Checking Backend Health...');
  const healthRes = await api('/health');
  assert(healthRes.ok && healthRes.data?.database === 'connected', 'TrumiTrip backend API is healthy');

  // 2. Authentication
  console.log('\n[2] Authenticating Test Customer and Admin...');
  const customerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@trumitrip.dev' } });
  const customerToken = generateAccessToken(customerUser.id, 'CUSTOMER');
  const customerId = customerUser.id;
  assert(Boolean(customerToken), 'Customer Alex Morgan authenticated successfully (JWT issued)');

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@trumitrip.dev' } });
  const adminToken = generateAccessToken(adminUser.id, 'ADMIN');
  assert(Boolean(adminToken), 'System Admin authenticated successfully (JWT issued)');

  // 3. Find a test hotel & room
  console.log('\n[3] Querying Test Hotel and Room for Booking...');
  const room = await prisma.room.findFirst({
    where: { status: 'AVAILABLE' },
    include: { hotel: true },
  });
  assert(Boolean(room && room.hotel), `Found active test room ${room?.roomType} in ${room?.hotel?.name}`);
  const hotelId = room!.hotel.id;
  const roomId = room!.id;

  // 4. Test Case 1: Standard Razorpay Order Creation & Verification
  console.log('\n[4] Test Case 1: Standard Razorpay Order Creation & Native Verification Flow...');
  const today = new Date();
  const checkInDate = new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10);
  const checkOutDate = new Date(today.getTime() + 13 * 86400000).toISOString().slice(0, 10);

  const guestDetails = {
    fullName: 'Alex Morgan',
    email: 'customer@trumitrip.dev',
    phone: '+1-555-0200',
  };

  const createBookingRes = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId,
      roomId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomsCount: 1,
      guestsCount: 2,
      guestDetails,
    },
  });
  assert(createBookingRes.ok, `Booking created: #${createBookingRes.data.data.bookingId}`);
  const booking1 = createBookingRes.data.data;
  assert(booking1.bookingStatus === 'PENDING', 'Initial booking status is PENDING');
  assert(booking1.paymentStatus === 'PENDING', 'Initial payment status is PENDING');

  // 4b. Create authoritative Razorpay Order
  const orderRes = await api('/payments/razorpay/order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: booking1.id },
  });
  assert(orderRes.ok, `Created Razorpay order: ${orderRes.data?.data?.orderId}`);
  const orderData = orderRes.data.data;
  const expectedPaise = Math.round(Number(booking1.totalAmount) * 100);
  assert(orderData.amount === expectedPaise, `Authoritative order amount matches booking amount (${expectedPaise} paise)`);
  assert(orderData.keyId.startsWith('rzp_test_'), `Test mode key ID returned: ${orderData.keyId}`);
  assert(orderData.currency === 'INR', 'Currency is INR');

  // Check DB Payment record
  const initialPaymentRecord = await prisma.payment.findUnique({
    where: { bookingId: booking1.id },
  });
  assert(initialPaymentRecord !== null, 'Payment record was created in database');
  assert(initialPaymentRecord?.status === 'PENDING', 'Payment record status is PENDING');
  assert(initialPaymentRecord?.gateway === 'RAZORPAY', 'Payment gateway is RAZORPAY');
  assert(initialPaymentRecord?.gatewayOrderId === orderData.orderId, 'Payment gatewayOrderId matches generated order');

  // 4c. Verify Razorpay Payment (Simulating official Native SDK completion)
  const testPaymentId = `pay_test_${Date.now()}_nativedev`;
  const validSignature = computeSignature(orderData.orderId, testPaymentId);

  const verifyRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking1.id,
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
    },
  });
  assert(verifyRes.ok, `Payment verified successfully: ${verifyRes.data.data.id}`);
  assert(verifyRes.data.data.status === 'SUCCESS', 'Payment status is SUCCESS');
  assert(verifyRes.data.data.gatewayPaymentId === testPaymentId, 'gatewayPaymentId stored');

  // Check DB Booking status
  const confirmedBooking = await prisma.booking.findUnique({ where: { id: booking1.id } });
  assert(confirmedBooking?.bookingStatus === 'CONFIRMED', 'Booking transitioned to CONFIRMED');
  assert(confirmedBooking?.paymentStatus === 'PAID', 'Booking paymentStatus transitioned to PAID');

  // Check DB Notification
  const customerNotification = await prisma.notification.findFirst({
    where: {
      userId: customerId,
      dedupKey: `PAYMENT_SUCCESS:${verifyRes.data.data.id}`,
    },
  });
  assert(customerNotification !== null, 'Customer received PAYMENT_SUCCESS notification');

  // 5. Test Case 2: Duplicate Verification Idempotency
  console.log('\n[5] Test Case 2: Duplicate Verification Idempotency...');
  const duplicateVerifyRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking1.id,
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
    },
  });
  assert(duplicateVerifyRes.ok, 'Duplicate verify returns HTTP 200 without error');
  assert(duplicateVerifyRes.data.data.id === verifyRes.data.data.id, 'Duplicate verify returns the existing payment record');

  // 6. Test Case 3: Invalid Signature Rejection
  console.log('\n[6] Test Case 3: Invalid Signature Rejection...');
  const createBooking2 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId,
      roomId,
      checkIn: new Date(today.getTime() + 15 * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(today.getTime() + 17 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1,
      guestsCount: 1,
      guestDetails,
    },
  });
  const booking2 = createBooking2.data.data;
  const orderRes2 = await api('/payments/razorpay/order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: booking2.id },
  });
  const order2 = orderRes2.data.data;

  const invalidVerifyRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking2.id,
      razorpay_order_id: order2.orderId,
      razorpay_payment_id: 'pay_test_tampered',
      razorpay_signature: 'deadbeef_invalid_hmac_signature',
    },
  });
  assert(invalidVerifyRes.status === 400, 'Tampered/invalid signature is rejected with HTTP 400');

  // 7. Test Case 4: Mismatched Order ID Rejection
  console.log('\n[7] Test Case 4: Mismatched Order ID Rejection...');
  const fakeOrderId = 'order_tampered_999999';
  const mismatchedSig = computeSignature(fakeOrderId, 'pay_test_123');
  const mismatchedOrderRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking2.id,
      razorpay_order_id: fakeOrderId,
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: mismatchedSig,
    },
  });
  assert(mismatchedOrderRes.status === 400, 'Mismatched gatewayOrderId is rejected with HTTP 400');

  // 8. Test Case 5: Security Lockdown Checks
  console.log('\n[8] Test Case 5: Security Lockdown Checks...');
  // Another customer cannot verify
  const partnerUser = await prisma.user.findUnique({ where: { email: 'partner@trumitrip.dev' } });
  const otherCustomerRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: adminToken, // admin or another role attempting customer route
    body: {
      bookingId: booking2.id,
      razorpay_order_id: order2.orderId,
      razorpay_payment_id: 'pay_test_x',
      razorpay_signature: 'sig',
    },
  });
  assert(otherCustomerRes.status === 403, 'Unauthorized user rejected with HTTP 403');

  // 9. Test Case 6: Cancellation & Retry Flow
  console.log('\n[9] Test Case 6: Cancellation & Retry Flow...');
  // booking2 order was created above, but user cancelled before completing
  const freshBooking2 = await prisma.booking.findUnique({ where: { id: booking2.id } });
  assert(freshBooking2?.bookingStatus === 'PENDING', 'Booking remains PENDING after user cancels checkout');
  assert(freshBooking2?.paymentStatus === 'PENDING', 'Payment remains PENDING after cancellation');

  // User retries payment
  const retryOrderRes = await api('/payments/razorpay/order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: booking2.id },
  });
  assert(retryOrderRes.ok, 'Retry order initialization succeeded');
  const retryOrder = retryOrderRes.data.data;
  const retryPaymentId = `pay_test_${Date.now()}_retried`;
  const retrySig = computeSignature(retryOrder.orderId, retryPaymentId);

  const retryVerifyRes = await api('/payments/razorpay/verify', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking2.id,
      razorpay_order_id: retryOrder.orderId,
      razorpay_payment_id: retryPaymentId,
      razorpay_signature: retrySig,
    },
  });
  assert(retryVerifyRes.ok, 'Retried payment verified successfully');
  const retriedBooking = await prisma.booking.findUnique({ where: { id: booking2.id } });
  assert(retriedBooking?.bookingStatus === 'CONFIRMED', 'Retried booking transitioned to CONFIRMED');
  assert(retriedBooking?.paymentStatus === 'PAID', 'Retried booking paymentStatus is PAID');

  // 10. Test Case 7: Webhook Delivery & Idempotency
  console.log('\n[10] Test Case 7: Webhook Delivery & Idempotency (payment.captured)...');
  const createBooking3 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId,
      roomId,
      checkIn: new Date(today.getTime() + 20 * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(today.getTime() + 22 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1,
      guestsCount: 1,
      guestDetails,
    },
  });
  const booking3 = createBooking3.data.data;
  const orderRes3 = await api('/payments/razorpay/order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: booking3.id },
  });
  const order3 = orderRes3.data.data;

  // Construct official Razorpay payment.captured webhook payload
  const webhookEventId = `evt_test_${Date.now()}_captured`;
  const webhookPaymentId = `pay_test_${Date.now()}_webhook`;
  const webhookBodyObj = {
    entity: 'event',
    account_id: 'acc_test_123',
    event: 'payment.captured',
    event_id: webhookEventId,
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: webhookPaymentId,
          entity: 'payment',
          amount: order3.amount,
          currency: 'INR',
          status: 'captured',
          order_id: order3.orderId,
          method: 'card',
          captured: true,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };
  const rawWebhookBody = JSON.stringify(webhookBodyObj);
  const webhookSignature = computeWebhookSignature(rawWebhookBody);

  const webhookRes = await fetch(`${BASE_URL}/payments/razorpay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': webhookSignature,
    },
    body: rawWebhookBody,
  });
  const webhookJson = await webhookRes.json();
  assert(webhookRes.status === 200, 'payment.captured webhook accepted with HTTP 200');
  assert(webhookJson.success === true, 'Webhook processed successfully');

  // Verify booking & payment status via webhook
  const webhookBooking = await prisma.booking.findUnique({ where: { id: booking3.id } });
  assert(webhookBooking?.bookingStatus === 'CONFIRMED', 'Webhook reconciled booking to CONFIRMED');
  assert(webhookBooking?.paymentStatus === 'PAID', 'Webhook reconciled paymentStatus to PAID');

  // Test duplicate webhook idempotency
  const dupWebhookRes = await fetch(`${BASE_URL}/payments/razorpay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': webhookSignature,
    },
    body: rawWebhookBody,
  });
  const dupWebhookJson = await dupWebhookRes.json();
  assert(dupWebhookRes.status === 200, 'Duplicate webhook returns HTTP 200');
  assert(dupWebhookJson.duplicate === true, 'Duplicate webhook recognized as duplicate (idempotent)');

  // 11. Test Case 8: Webhook payment.failed Handling
  console.log('\n[11] Test Case 8: Webhook payment.failed Handling...');
  const createBooking4 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId,
      roomId,
      checkIn: new Date(today.getTime() + 25 * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(today.getTime() + 27 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1,
      guestsCount: 1,
      guestDetails,
    },
  });
  const booking4 = createBooking4.data.data;
  const orderRes4 = await api('/payments/razorpay/order', {
    method: 'POST',
    token: customerToken,
    body: { bookingId: booking4.id },
  });
  const order4 = orderRes4.data.data;

  const failedEventId = `evt_test_${Date.now()}_failed`;
  const failedBodyObj = {
    entity: 'event',
    event: 'payment.failed',
    event_id: failedEventId,
    payload: {
      payment: {
        entity: {
          id: `pay_test_${Date.now()}_failed`,
          order_id: order4.orderId,
          error_description: 'Card declined by issuing bank',
        },
      },
    },
  };
  const rawFailedBody = JSON.stringify(failedBodyObj);
  const failedSignature = computeWebhookSignature(rawFailedBody);

  const failedWebhookRes = await fetch(`${BASE_URL}/payments/razorpay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': failedSignature,
    },
    body: rawFailedBody,
  });
  const failedText = await failedWebhookRes.text();
  if (failedWebhookRes.status !== 200) {
    console.log('Failed Webhook Error response:', failedWebhookRes.status, failedText);
  }
  assert(failedWebhookRes.status === 200, 'payment.failed webhook accepted');
  const failedPaymentRecord = await prisma.payment.findUnique({ where: { bookingId: booking4.id } });
  assert(failedPaymentRecord?.status === 'FAILED', 'Payment record transitioned to FAILED');
  const failedBookingRecord = await prisma.booking.findUnique({ where: { id: booking4.id } });
  assert(failedBookingRecord?.paymentStatus === 'FAILED', 'Booking paymentStatus transitioned to FAILED');

  // 12. Test Case 9: Admin Refund Workflow & Payout Voiding
  console.log('\n[12] Test Case 9: Admin Refund Workflow & Partner Payout Voiding...');
  const refundRes = await api(`/payments/${verifyRes.data.data.id}/refund`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Guest requested cancellation within free refund window' },
  });
  assert(refundRes.ok, `Refund processed by admin: ${refundRes.data.data.status}`);
  assert(refundRes.data.data.status === 'REFUNDED', 'Payment status is REFUNDED');

  const refundedBooking = await prisma.booking.findUnique({ where: { id: booking1.id } });
  assert(refundedBooking?.paymentStatus === 'REFUNDED', 'Booking paymentStatus is REFUNDED');

  // Check duplicate refund attempt is rejected
  const dupRefundRes = await api(`/payments/${verifyRes.data.data.id}/refund`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Second refund attempt' },
  });
  assert(dupRefundRes.status === 400, 'Duplicate refund attempt rejected with HTTP 400');

  // 13. Test Case 10: Pay at Hotel Offline Payment Method
  console.log('\n[13] Test Case 10: Pay at Hotel Offline Payment Method...');
  const createBooking5 = await api('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId,
      roomId,
      checkIn: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(today.getTime() + 32 * 86400000).toISOString().slice(0, 10),
      roomsCount: 1,
      guestsCount: 2,
      guestDetails,
    },
  });
  const booking5 = createBooking5.data.data;

  const payAtHotelRes = await api('/payments', {
    method: 'POST',
    token: customerToken,
    body: {
      bookingId: booking5.id,
      paymentMethod: 'PAY_AT_HOTEL',
    },
  });
  assert(payAtHotelRes.ok, 'Pay at Hotel payment record created');
  assert(payAtHotelRes.data.data.paymentMethod === 'PAY_AT_HOTEL', 'Payment method is PAY_AT_HOTEL');
  assert(payAtHotelRes.data.data.status === 'PENDING', 'Pay at Hotel payment status is PENDING (to be settled at hotel)');
  assert(payAtHotelRes.data.data.gateway === 'PAY_AT_HOTEL', 'Payment gateway is PAY_AT_HOTEL (Razorpay gateway bypassed)');

  console.log('\n================================================================');
  console.log(`🎉 ALL PHASE 17B VERIFICATION CHECKS PASSED: ${passedChecks}/${totalChecks}`);
  console.log('================================================================\n');
}

runPhase17bE2E()
  .catch((err) => {
    console.error('\n💥 FATAL VERIFICATION ERROR:', err);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
