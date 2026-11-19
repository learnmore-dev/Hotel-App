import 'dotenv/config';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';

import { getPrismaClient } from '../src/config/prisma.js';
import * as razorpayService from '../src/services/razorpay.service.js';
import * as paymentService from '../src/services/payment.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 17 — Real Payment Gateway Integration (Razorpay Test Mode) Tests', () => {
  const prisma = getPrismaClient();

  const mockSecret = 'test_secret_razorpay_998877';
  const mockWebhookSecret = 'test_webhook_secret_665544';

  let customerUser: any;
  let otherCustomerUser: any;
  let partnerUser: any;
  let testHotel: any;
  let testRoom: any;

  let testBooking: any;
  let paidBooking: any;
  let cancelledBooking: any;

  describe('1. Security & Environment Safeguards', () => {
    it('strictly forbids live Razorpay credentials (rzp_live_*) in non-production', () => {
      const prevKey = process.env.RAZORPAY_KEY_ID;
      try {
        process.env.RAZORPAY_KEY_ID = 'rzp_live_dangerous_key_123';
        assert.throws(
          () => razorpayService.getRazorpayClient(),
          /SECURITY VIOLATION: Live Razorpay credentials are strictly forbidden/i,
        );
      } finally {
        process.env.RAZORPAY_KEY_ID = prevKey;
      }
    });

    it('permits test Razorpay credentials (rzp_test_*)', () => {
      const prevKey = process.env.RAZORPAY_KEY_ID;
      try {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_safe_key_123';
        const client = razorpayService.getRazorpayClient();
        assert.ok(client, 'Client should be instantiated for test credentials');
      } finally {
        process.env.RAZORPAY_KEY_ID = prevKey;
      }
    });
  });

  describe('2. Test Seed & Booking Context Setup', () => {
    it('loads required seed users, hotel, and sets up test bookings', async () => {
      customerUser = await prisma.user.findUnique({
        where: { email: 'customer@trumitrip.dev' },
      });
      assert.ok(customerUser, 'Customer user must exist');

      partnerUser = await prisma.user.findUnique({
        where: { email: 'partner@trumitrip.dev' },
        include: { partnerProfile: { include: { hotels: { include: { rooms: true } } } } },
      });
      assert.ok(partnerUser?.partnerProfile?.hotels?.length, 'Partner hotel must exist');
      testHotel = partnerUser.partnerProfile.hotels[0];
      testRoom = testHotel.rooms[0];

      // Find or create a second customer to test ownership isolation
      otherCustomerUser = await prisma.user.findFirst({
        where: { role: 'CUSTOMER', NOT: { id: customerUser.id } },
      });
      if (!otherCustomerUser) {
        otherCustomerUser = await prisma.user.create({
          data: {
            email: 'othercustomer_rzp@trumitrip.dev',
            passwordHash: 'dummy_hash',
            fullName: 'Other Customer',
            role: 'CUSTOMER',
          },
        });
      }

      const defaultGuestDetails = {
        fullName: 'Test Customer',
        email: 'customer@trumitrip.dev',
        phone: '+919876543210',
      };

      // Create test booking for order creation
      testBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-TEST-RZP-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-01'),
          checkOut: new Date('2026-11-03'),
          roomsCount: 1,
          guestsCount: 2,
          numberOfNights: 2,
          roomPrice: 120,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 240,
          bookingStatus: 'PENDING',
          paymentStatus: 'PENDING',
          guestDetails: defaultGuestDetails,
        },
      });

      // Create a cancelled booking
      cancelledBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-CANCELLED-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-05'),
          checkOut: new Date('2026-11-06'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 1,
          roomPrice: 100,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 100,
          bookingStatus: 'CANCELLED',
          paymentStatus: 'PENDING',
          guestDetails: defaultGuestDetails,
        },
      });

      // Create an already paid booking
      paidBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-PAID-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-10'),
          checkOut: new Date('2026-11-12'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 2,
          roomPrice: 150,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 300,
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
          guestDetails: defaultGuestDetails,
        },
      });
    });
  });

  describe('3. Authoritative Server-Side Order Creation', () => {
    it('creates Razorpay order deriving amount strictly from PostgreSQL totalAmount in paise', async () => {
      const order = await razorpayService.createRazorpayOrder(customerUser.id, {
        bookingId: testBooking.id,
      });

      assert.ok(order.orderId.startsWith('order_'), 'Must return valid order ID');
      assert.equal(order.amount, 24000, 'Amount must be 240 * 100 = 24000 paise');
      assert.equal(order.currency, 'INR');
      assert.equal(order.bookingId, testBooking.id);
      assert.equal(order.bookingRef, testBooking.bookingId);
      assert.equal(order.hotelName, testHotel.name);

      // Verify server updated Payment record with gatewayOrderId
      const payment = await prisma.payment.findUnique({
        where: { bookingId: testBooking.id },
      });
      assert.ok(payment, 'Payment record must be created');
      assert.equal(payment.gatewayOrderId, order.orderId);
      assert.equal(payment.status, 'PENDING');
      assert.equal(payment.gateway, 'RAZORPAY');
    });

    it('rejects order creation for another customer booking with 403 Forbidden', async () => {
      await assert.rejects(
        async () => {
          await razorpayService.createRazorpayOrder(otherCustomerUser.id, {
            bookingId: testBooking.id,
          });
        },
        (err: any) => err instanceof ApiError && err.statusCode === 403,
      );
    });

    it('rejects order creation for cancelled booking with 400 Bad Request', async () => {
      await assert.rejects(
        async () => {
          await razorpayService.createRazorpayOrder(customerUser.id, {
            bookingId: cancelledBooking.id,
          });
        },
        (err: any) => err instanceof ApiError && err.statusCode === 400,
      );
    });

    it('rejects order creation for already paid booking with 400 Bad Request', async () => {
      await assert.rejects(
        async () => {
          await razorpayService.createRazorpayOrder(customerUser.id, {
            bookingId: paidBooking.id,
          });
        },
        (err: any) => err instanceof ApiError && err.statusCode === 400,
      );
    });

    it('never exposes Razorpay Key Secret in order response', async () => {
      const order = await razorpayService.createRazorpayOrder(customerUser.id, {
        bookingId: testBooking.id,
      });
      assert.equal((order as any).keySecret, undefined);
      assert.equal((order as any).secret, undefined);
    });
  });

  describe('4. Signature Verification & Timing Attack Protection', () => {
    it('verifies valid HMAC-SHA256 signature using constant-time comparison', () => {
      const orderId = 'order_valid_12345';
      const paymentId = 'pay_valid_67890';
      const signature = crypto
        .createHmac('sha256', mockSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = razorpayService.verifySignature(orderId, paymentId, signature, mockSecret);
      assert.equal(isValid, true, 'Valid signature must return true');
    });

    it('rejects tampered or forged signatures', () => {
      const orderId = 'order_valid_12345';
      const paymentId = 'pay_valid_67890';
      const forgedSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = razorpayService.verifySignature(orderId, paymentId, forgedSignature, mockSecret);
      assert.equal(isValid, false, 'Forged signature must be rejected');
    });

    it('rejects verification if order ID does not match server-initiated order', async () => {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: testBooking.id },
      });
      assert.ok(payment.gatewayOrderId);

      await assert.rejects(
        async () => {
          await razorpayService.verifyRazorpayPayment(
            customerUser.id,
            {
              bookingId: testBooking.id,
              razorpay_order_id: 'order_mismatched_99999',
              razorpay_payment_id: 'pay_test_123',
              razorpay_signature: 'dummy_sig',
            },
            mockSecret,
          );
        },
        (err: any) => err instanceof ApiError && err.statusCode === 400 && /mismatch/i.test(err.message),
      );
    });

    it('confirms booking and marks payment SUCCESS upon valid client verification', async () => {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: testBooking.id },
      });
      const orderId = payment.gatewayOrderId!;
      const paymentId = `pay_confirmed_${Date.now()}`;
      const validSignature = crypto
        .createHmac('sha256', mockSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const verified = await razorpayService.verifyRazorpayPayment(
        customerUser.id,
        {
          bookingId: testBooking.id,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        },
        mockSecret,
      );

      assert.equal(verified.status, 'SUCCESS');
      assert.equal(verified.gatewayPaymentId, paymentId);
      assert.equal(verified.gatewaySignature, validSignature);
      assert.ok(verified.paidAt);

      // Verify booking updated to CONFIRMED and PAID
      const updatedBooking = await prisma.booking.findUniqueOrThrow({
        where: { id: testBooking.id },
      });
      assert.equal(updatedBooking.bookingStatus, 'CONFIRMED');
      assert.equal(updatedBooking.paymentStatus, 'PAID');
    });

    it('is idempotent when verification is repeated for already confirmed payment', async () => {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: testBooking.id },
      });
      const orderId = payment.gatewayOrderId!;
      const paymentId = payment.gatewayPaymentId!;
      const validSignature = payment.gatewaySignature!;

      const repeated = await razorpayService.verifyRazorpayPayment(
        customerUser.id,
        {
          bookingId: testBooking.id,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        },
        mockSecret,
      );

      assert.equal(repeated.status, 'SUCCESS');
      assert.equal(repeated.id, payment.id);
    });
  });

  describe('5. Webhook Signature Verification & Idempotency', () => {
    it('verifies valid raw-body webhook HMAC signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
      const validSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const isValid = razorpayService.verifyWebhookSignature(rawBody, validSignature, mockWebhookSecret);
      assert.equal(isValid, true, 'Valid webhook signature must pass');
    });

    it('rejects forged webhook HMAC signature with 400 Bad Request', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', id: 'evt_forged' });
      const forgedSignature = 'forged_signature_hex';

      await assert.rejects(
        async () => {
          await razorpayService.processRazorpayWebhook(rawBody, forgedSignature, mockWebhookSecret);
        },
        (err: any) => err instanceof ApiError && err.statusCode === 400 && /signature/i.test(err.message),
      );
    });

    it('processes payment.captured webhook and transitions payment to SUCCESS', async () => {
      // Create a fresh booking for webhook testing
      const webhookBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-WB-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-20'),
          checkOut: new Date('2026-11-22'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 2,
          roomPrice: 100,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 200,
          bookingStatus: 'PENDING',
          paymentStatus: 'PENDING',
          guestDetails: { fullName: 'Test Customer', email: 'customer@trumitrip.dev', phone: '+919876543210' },
        },
      });

      const gatewayOrderId = `order_wb_${Date.now()}`;
      await prisma.payment.create({
        data: {
          bookingId: webhookBooking.id,
          customerId: customerUser.id,
          amount: 200,
          currency: 'INR',
          paymentMethod: 'CARD',
          transactionId: gatewayOrderId,
          gatewayOrderId,
          status: 'PENDING',
          gateway: 'RAZORPAY',
        },
      });

      const eventId = `evt_captured_${Date.now()}`;
      const payload = {
        event: 'payment.captured',
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_wb_${Date.now()}`,
              order_id: gatewayOrderId,
              amount: 20000,
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const result = await razorpayService.processRazorpayWebhook(rawBody, signature, mockWebhookSecret);
      assert.equal(result.success, true);
      assert.equal(result.event, 'payment.captured');

      // Verify DB was updated
      const updatedPayment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: webhookBooking.id },
      });
      assert.equal(updatedPayment.status, 'SUCCESS');
      assert.ok(updatedPayment.paidAt);

      const updatedBooking = await prisma.booking.findUniqueOrThrow({
        where: { id: webhookBooking.id },
      });
      assert.equal(updatedBooking.paymentStatus, 'PAID');
      assert.equal(updatedBooking.bookingStatus, 'CONFIRMED');

      // Re-deliver same event to test WebhookEvent idempotency
      const duplicateResult = await razorpayService.processRazorpayWebhook(rawBody, signature, mockWebhookSecret);
      assert.equal(duplicateResult.success, true);
      assert.equal(duplicateResult.duplicate, true, 'Duplicate webhook event must be recognized idempotently');
    });

    it('processes payment.failed webhook and marks payment and booking FAILED', async () => {
      const failedBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-FAIL-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-25'),
          checkOut: new Date('2026-11-26'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 1,
          roomPrice: 80,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 80,
          bookingStatus: 'PENDING',
          paymentStatus: 'PENDING',
          guestDetails: { fullName: 'Test Customer', email: 'customer@trumitrip.dev', phone: '+919876543210' },
        },
      });

      const gatewayOrderId = `order_fail_${Date.now()}`;
      await prisma.payment.create({
        data: {
          bookingId: failedBooking.id,
          customerId: customerUser.id,
          amount: 80,
          currency: 'INR',
          paymentMethod: 'UPI',
          transactionId: gatewayOrderId,
          gatewayOrderId,
          status: 'PENDING',
          gateway: 'RAZORPAY',
        },
      });

      const eventId = `evt_failed_${Date.now()}`;
      const payload = {
        event: 'payment.failed',
        event_id: eventId,
        payload: {
          payment: {
            entity: {
              id: `pay_failed_${Date.now()}`,
              order_id: gatewayOrderId,
              error_description: 'Card declined by bank',
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const result = await razorpayService.processRazorpayWebhook(rawBody, signature, mockWebhookSecret);
      assert.equal(result.success, true);

      const updatedPayment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: failedBooking.id },
      });
      assert.equal(updatedPayment.status, 'FAILED');

      const updatedBooking = await prisma.booking.findUniqueOrThrow({
        where: { id: failedBooking.id },
      });
      assert.equal(updatedBooking.paymentStatus, 'FAILED');
    });
  });

  describe('6. Out-of-Order Webhook Delivery Protection', () => {
    it('does not revert REFUNDED status back to SUCCESS if payment.captured arrives late', async () => {
      const outOfOrderBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-OOO-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-11-28'),
          checkOut: new Date('2026-11-29'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 1,
          roomPrice: 90,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 90,
          bookingStatus: 'CANCELLED',
          paymentStatus: 'REFUNDED',
          guestDetails: { fullName: 'Test Customer', email: 'customer@trumitrip.dev', phone: '+919876543210' },
        },
      });

      const gatewayOrderId = `order_ooo_${Date.now()}`;
      await prisma.payment.create({
        data: {
          bookingId: outOfOrderBooking.id,
          customerId: customerUser.id,
          amount: 90,
          currency: 'INR',
          paymentMethod: 'CARD',
          transactionId: gatewayOrderId,
          gatewayOrderId,
          status: 'REFUNDED',
          gateway: 'RAZORPAY',
        },
      });

      // Delayed payment.captured webhook arrives
      const payload = {
        event: 'payment.captured',
        event_id: `evt_delayed_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_delayed_${Date.now()}`,
              order_id: gatewayOrderId,
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(rawBody)
        .digest('hex');

      await razorpayService.processRazorpayWebhook(rawBody, signature, mockWebhookSecret);

      // Verify payment remains REFUNDED and did NOT regress to SUCCESS
      const paymentAfter = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: outOfOrderBooking.id },
      });
      assert.equal(paymentAfter.status, 'REFUNDED', 'Payment status must remain REFUNDED');

      const bookingAfter = await prisma.booking.findUniqueOrThrow({
        where: { id: outOfOrderBooking.id },
      });
      assert.equal(bookingAfter.paymentStatus, 'REFUNDED', 'Booking payment status must remain REFUNDED');
    });
  });

  describe('7. Pay at Hotel Offline Isolation Safeguard', () => {
    it('creates Pay at Hotel payment bypassing Razorpay gateway order generation', async () => {
      const payAtHotelBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-PAH-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-12-01'),
          checkOut: new Date('2026-12-03'),
          roomsCount: 1,
          guestsCount: 2,
          numberOfNights: 2,
          roomPrice: 110,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 220,
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PENDING',
          guestDetails: { fullName: 'Test Customer', email: 'customer@trumitrip.dev', phone: '+919876543210' },
        },
      });

      const payment = await paymentService.createPayment(customerUser.id, {
        bookingId: payAtHotelBooking.id,
        paymentMethod: 'PAY_AT_HOTEL',
      });

      assert.equal(payment.paymentMethod, 'PAY_AT_HOTEL');
      assert.equal(payment.gateway, 'PAY_AT_HOTEL');
      assert.equal(payment.status, 'PENDING');
      assert.equal((payment as any).gatewayOrderId, null);
      assert.equal((payment as any).gatewayPaymentId, null);
    });
  });

  describe('8. Gateway Refund API & Payout Voiding', () => {
    it('processes refund on paid gateway payment and voids pending partner payouts', async () => {
      // Use testBooking which was confirmed and marked SUCCESS earlier
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { bookingId: testBooking.id },
      });
      assert.equal(payment.status, 'SUCCESS');

      // Create a pending payout for this booking to test voiding
      const pendingPayout = await prisma.payout.create({
        data: {
          partnerId: testHotel.partnerId,
          bookingId: testBooking.id,
          amount: 240,
          commissionAmount: 36,
          netAmount: 204,
          status: 'PENDING',
        },
      });

      // Trigger refund
      const refunded = await paymentService.updatePaymentStatus(
        customerUser.id,
        payment.id,
        'REFUNDED',
        'Customer requested cancellation',
      );

      assert.equal(refunded.status, 'REFUNDED');

      // Verify payout was marked FAILED (voided)
      const updatedPayout = await prisma.payout.findUniqueOrThrow({
        where: { id: pendingPayout.id },
      });
      assert.equal(updatedPayout.status, 'FAILED');
    });
  });

  describe('9. Mobile Test Mode Helper & Simulator Signatures', () => {
    it('generates test signatures for mobile simulator / Expo Go in TEST MODE', async () => {
      const sigBooking = await prisma.booking.create({
        data: {
          bookingId: `TRM-SIG-${Date.now()}`,
          customerId: customerUser.id,
          hotelId: testHotel.id,
          roomId: testRoom.id,
          checkIn: new Date('2026-12-10'),
          checkOut: new Date('2026-12-11'),
          roomsCount: 1,
          guestsCount: 1,
          numberOfNights: 1,
          roomPrice: 95,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 95,
          bookingStatus: 'PENDING',
          paymentStatus: 'PENDING',
          guestDetails: { fullName: 'Test Customer', email: 'customer@trumitrip.dev', phone: '+919876543210' },
        },
      });

      const order = await razorpayService.createRazorpayOrder(customerUser.id, {
        bookingId: sigBooking.id,
      });

      const credentials = await razorpayService.generateTestPaymentSignature(
        customerUser.id,
        { bookingId: sigBooking.id, orderId: order.orderId },
        mockSecret,
      );

      assert.equal(credentials.razorpayOrderId, order.orderId);
      assert.ok(credentials.razorpayPaymentId.startsWith('pay_test_'));
      assert.ok(credentials.razorpaySignature.length > 20);

      // Verify the generated signature passes verifySignature
      const isValid = razorpayService.verifySignature(
        credentials.razorpayOrderId,
        credentials.razorpayPaymentId,
        credentials.razorpaySignature,
        mockSecret,
      );
      assert.equal(isValid, true, 'Generated test signature must be cryptographically valid');
    });

    it('strictly forbids test signature generation in production (NODE_ENV=production)', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        await assert.rejects(
          async () => {
            await razorpayService.generateTestPaymentSignature(customerUser.id, {
              bookingId: testBooking.id,
            });
          },
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /strictly forbidden in production/i);
            return true;
          },
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('strictly forbids test signature generation when live key is configured', async () => {
      const prevKey = process.env.RAZORPAY_KEY_ID;
      try {
        process.env.RAZORPAY_KEY_ID = 'rzp_live_realproductionkey';
        await assert.rejects(
          async () => {
            await razorpayService.generateTestPaymentSignature(customerUser.id, {
              bookingId: testBooking.id,
            });
          },
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /forbidden in live mode/i);
            return true;
          },
        );
      } finally {
        process.env.RAZORPAY_KEY_ID = prevKey;
      }
    });

    it('strictly rejects test-sign generated payment IDs (pay_test_*) during verification in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        await assert.rejects(
          async () => {
            await razorpayService.verifyRazorpayPayment(customerUser.id, {
              bookingId: testBooking.id,
              razorpay_order_id: 'order_test_any',
              razorpay_payment_id: 'pay_test_123456',
              razorpay_signature: 'dummy_sig',
            });
          },
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /Test payment signatures cannot confirm/i);
            return true;
          },
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('strictly rejects verification when live key is configured', async () => {
      const prevKey = process.env.RAZORPAY_KEY_ID;
      try {
        process.env.RAZORPAY_KEY_ID = 'rzp_live_realproductionkey';
        await assert.rejects(
          async () => {
            await razorpayService.verifyRazorpayPayment(customerUser.id, {
              bookingId: testBooking.id,
              razorpay_order_id: 'order_test_any',
              razorpay_payment_id: 'pay_real_123456',
              razorpay_signature: 'dummy_sig',
            });
          },
          (err: any) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /SECURITY VIOLATION: Live Razorpay credentials are strictly forbidden/i);
            return true;
          },
        );
      } finally {
        process.env.RAZORPAY_KEY_ID = prevKey;
      }
    });
  });
});
