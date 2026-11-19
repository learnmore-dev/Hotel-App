import crypto from 'node:crypto';
import Razorpay from 'razorpay';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { voidPendingPayoutsForBooking } from './payout.service.js';
import { safeNotify } from './notification.service.js';
import { paymentDetailSelect } from './payment.service.js';

export type CreateRazorpayOrderInput = {
  bookingId: string;
};

export type VerifyRazorpayPaymentInput = {
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayOrderResponse = {
  orderId: string;
  amount: number; // in subunits (paise)
  currency: string;
  keyId: string;
  bookingId: string;
  bookingRef: string;
  hotelName: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
  };
};

let globalCustomClient: Razorpay | null = null;

export function setRazorpayClient(client: Razorpay | null): void {
  globalCustomClient = client;
}

/**
 * Returns an instance of the Razorpay SDK.
 * Safety guard: Strictly forbids live credentials (rzp_live_*) during Phase 17.
 */
export function getRazorpayClient(customClient?: Razorpay): Razorpay {
  if (customClient) return customClient;
  if (globalCustomClient) return globalCustomClient;

  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';

  if (keyId.startsWith('rzp_live_')) {
    throw new Error(
      'SECURITY VIOLATION: Live Razorpay credentials are strictly forbidden in Phase 17. Only TEST mode is permitted.',
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Creates an authoritative Razorpay order for an authenticated customer's booking.
 * Amount is derived exclusively from PostgreSQL (booking.totalAmount).
 * Never trusts a client-supplied amount.
 */
export async function createRazorpayOrder(
  customerId: string,
  input: CreateRazorpayOrderInput,
  customClient?: Razorpay,
): Promise<RazorpayOrderResponse> {
  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bookingId);

  // 1. Fetch authoritative booking from database
  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: input.bookingId } : { bookingId: input.bookingId },
    select: {
      id: true,
      bookingId: true,
      customerId: true,
      totalAmount: true,
      bookingStatus: true,
      paymentStatus: true,
      hotel: { select: { id: true, name: true } },
      customer: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId !== customerId) {
    throw new ApiError(403, "You cannot pay for another customer's booking");
  }

  if (booking.bookingStatus === 'CANCELLED') {
    throw new ApiError(400, 'Cannot process payment for a cancelled booking');
  }

  if (booking.paymentStatus === 'PAID') {
    throw new ApiError(400, 'This booking has already been paid');
  }

  // Check if an existing payment is already SUCCESS
  const existingPayment = await prisma.payment.findUnique({
    where: { bookingId: booking.id },
  });

  if (existingPayment?.status === 'SUCCESS') {
    throw new ApiError(400, 'This booking already has a completed payment');
  }

  // 2. Derive authoritative amount in currency subunits (e.g. paise for INR, cents for USD)
  const currency = process.env.RAZORPAY_CURRENCY || 'INR';
  const totalAmountNum = Number(booking.totalAmount);
  const amountInSubunits = Math.round(totalAmountNum * 100);

  if (amountInSubunits <= 0) {
    throw new ApiError(400, 'Invalid booking amount for online payment');
  }

  // 3. Create order on Razorpay
  const razorpay = getRazorpayClient(customClient);
  let order: { id: string; amount: number; currency: string; receipt?: string };

  try {
    const created = await razorpay.orders.create({
      amount: amountInSubunits,
      currency,
      receipt: booking.bookingId,
      notes: {
        bookingId: booking.id,
        bookingRef: booking.bookingId,
        customerId,
      },
    });
    order = created as { id: string; amount: number; currency: string; receipt?: string };
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Razorpay] Order creation failed:', error);
    }
    const currentKeyId = process.env.RAZORPAY_KEY_ID || '';
    if (
      process.env.NODE_ENV !== 'production' &&
      (currentKeyId.includes('placeholder') || currentKeyId.includes('local') || currentKeyId.includes('mock'))
    ) {
      order = {
        id: `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: amountInSubunits,
        currency,
        receipt: booking.bookingId,
      };
    } else {
      const msg = error instanceof Error ? error.message : 'Gateway error';
      throw new ApiError(502, `Failed to initialize payment gateway order: ${msg}`);
    }
  }

  // 4. Upsert Payment record with gatewayOrderId
  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: {
      bookingId: booking.id,
      customerId,
      amount: booking.totalAmount,
      currency,
      paymentMethod: 'CARD', // will be refined upon payment capture
      transactionId: order.id,
      gatewayOrderId: order.id,
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayResponse: {
        orderId: order.id,
        currency,
        amountInSubunits,
        createdAt: new Date().toISOString(),
      },
    },
    update: {
      amount: booking.totalAmount,
      currency,
      transactionId: order.id,
      gatewayOrderId: order.id,
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayResponse: {
        orderId: order.id,
        currency,
        amountInSubunits,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';

  return {
    orderId: order.id,
    amount: amountInSubunits,
    currency,
    keyId,
    bookingId: booking.id,
    bookingRef: booking.bookingId,
    hotelName: booking.hotel.name,
    customerName: booking.customer.fullName,
    customerEmail: booking.customer.email,
    customerPhone: booking.customer.phone,
    customer: {
      name: booking.customer.fullName,
      email: booking.customer.email,
      phone: booking.customer.phone,
    },
  };
}

/**
 * Validates a Razorpay payment signature using HMAC SHA-256.
 * Compares computed digest against client-submitted signature using constant-time comparison.
 */
export function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
): boolean {
  if (!orderId || !paymentId || !signature) return false;

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (expectedSignature.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf-8'),
    Buffer.from(signature, 'utf-8'),
  );
}

/**
 * Verifies Razorpay payment signature submitted by client and confirms the booking.
 * Strictly checks order ID against stored server record.
 */
export async function verifyRazorpayPayment(
  customerId: string,
  input: VerifyRazorpayPaymentInput,
  secretOverride?: string,
) {
  // Security lockdown: Forbid live keys in Phase 17 and prevent test signatures from confirming production/live payments
  const currentKeyId = process.env.RAZORPAY_KEY_ID || '';
  if (currentKeyId.startsWith('rzp_live_')) {
    throw new ApiError(
      403,
      'SECURITY VIOLATION: Live Razorpay credentials are strictly forbidden in Phase 17. Only TEST mode is permitted.',
    );
  }

  if (
    (process.env.NODE_ENV === 'production' || currentKeyId.startsWith('rzp_live_')) &&
    input.razorpay_payment_id?.startsWith('pay_test_')
  ) {
    throw new ApiError(403, 'Test payment signatures cannot confirm real payments in production or live mode.');
  }

  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bookingId);

  // 1. Fetch booking and stored payment record
  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: input.bookingId } : { bookingId: input.bookingId },
    include: {
      payment: true,
      hotel: { select: { id: true, name: true, partnerId: true, partner: { select: { userId: true } } } },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId !== customerId) {
    throw new ApiError(403, "You cannot verify payment for another customer's booking");
  }

  const payment = booking.payment;
  if (!payment) {
    throw new ApiError(400, 'No payment record initiated for this booking');
  }

  // 2. Validate that the order ID matches the server-initiated order
  if (payment.gatewayOrderId && payment.gatewayOrderId !== input.razorpay_order_id) {
    throw new ApiError(400, 'Order ID mismatch. Verification rejected.');
  }

  // 3. Verify HMAC-SHA256 signature
  const secret = secretOverride || process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
  const isValid = verifySignature(
    input.razorpay_order_id,
    input.razorpay_payment_id,
    input.razorpay_signature,
    secret,
  );

  if (!isValid) {
    throw new ApiError(400, 'Invalid payment signature. Verification failed.');
  }

  // If already confirmed, return existing payment record idempotently
  if (payment.status === 'SUCCESS') {
    return prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: paymentDetailSelect,
    });
  }

  // 4. Update Payment to SUCCESS and Booking to CONFIRMED inside database transaction
  const updatedPayment = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        transactionId: input.razorpay_payment_id,
        gatewayPaymentId: input.razorpay_payment_id,
        gatewaySignature: input.razorpay_signature,
        paidAt: new Date(),
        gatewayResponse: {
          ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
            ? (payment.gatewayResponse as Record<string, unknown>)
            : {}),
          captured: true,
          verifiedVia: 'CLIENT_CALLBACK',
          razorpayPaymentId: input.razorpay_payment_id,
          verifiedAt: new Date().toISOString(),
        },
      },
      select: paymentDetailSelect,
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'PAID',
        ...(booking.bookingStatus === 'PENDING' ? { bookingStatus: 'CONFIRMED' } : {}),
      },
    });

    return updated;
  });

  // 5. Trigger notifications (fail-safe and non-blocking)
  void safeNotify({
    userId: customerId,
    title: 'Payment Confirmed',
    message: `Your payment of ${updatedPayment.currency} ${updatedPayment.amount} for booking #${booking.bookingId} was verified successfully.`,
    type: 'PAYMENT',
    dedupKey: `PAYMENT_SUCCESS:${updatedPayment.id}`,
    actionUrl: `/(customer)/booking/${booking.id}`,
    data: { paymentId: updatedPayment.id, bookingId: booking.id },
  });

  if (booking.hotel?.partner?.userId) {
    void safeNotify({
      userId: booking.hotel.partner.userId,
      title: 'Booking Payment Confirmed',
      message: `Online payment verified for booking #${booking.bookingId} (${updatedPayment.currency} ${updatedPayment.amount}).`,
      type: 'PAYMENT',
      dedupKey: `PARTNER_PAYMENT_CONFIRMED:${updatedPayment.id}`,
      actionUrl: `/(partner)/bookings/${booking.id}`,
      data: { paymentId: updatedPayment.id, bookingId: booking.id },
    });
  }

  return updatedPayment;
}

/**
 * Validates a Razorpay webhook signature against the raw body buffer.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder',
): boolean {
  if (!rawBody || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature.length !== signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf-8'),
    Buffer.from(signature, 'utf-8'),
  );
}

export type WebhookProcessingResult = {
  success: boolean;
  message: string;
  duplicate?: boolean;
  event?: string;
  paymentId?: string;
};

type RazorpayWebhookPayload = {
  event: string;
  event_id?: string;
  id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_description?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
      };
    };
  };
};

/**
 * Processes incoming Razorpay webhook events idempotently and securely.
 * Reconciles payment and booking status based on authoritative gateway events.
 */
export async function processRazorpayWebhook(
  rawBody: Buffer | string,
  signature: string,
  secretOverride?: string,
): Promise<WebhookProcessingResult> {
  const secret = secretOverride || process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';

  // 1. Verify webhook signature using the exact raw body
  const isValid = verifyWebhookSignature(rawBody, signature, secret);
  if (!isValid) {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  // 2. Parse payload
  let payload: RazorpayWebhookPayload;
  try {
    const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    payload = JSON.parse(rawStr) as RazorpayWebhookPayload;
  } catch {
    throw new ApiError(400, 'Invalid JSON payload in webhook body');
  }

  const eventType: string = payload.event;
  const eventId: string = payload.event_id || payload.id || `evt_${Date.now()}_${Math.random()}`;

  const prisma = getPrismaClient();

  // 3. Idempotency Check: prevent duplicate event processing
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent) {
    return {
      success: true,
      duplicate: true,
      message: 'Webhook event already processed (idempotent)',
      event: eventType,
    };
  }

  // 4. Reconcile based on event type
  let processedPaymentId: string | undefined;

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
    const rzpPaymentId = paymentEntity?.id;

    if (orderId) {
      const payment = await prisma.payment.findFirst({
        where: { gatewayOrderId: orderId },
        include: { booking: { select: { id: true, bookingId: true, bookingStatus: true } } },
      });

      if (payment) {
        processedPaymentId = payment.id;
        // If not already SUCCESS or REFUNDED, transition to SUCCESS
        if (payment.status !== 'SUCCESS' && payment.status !== 'REFUNDED') {
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: 'SUCCESS',
                transactionId: rzpPaymentId || payment.transactionId,
                gatewayPaymentId: rzpPaymentId || payment.gatewayPaymentId,
                paidAt: new Date(),
                gatewayResponse: {
                  ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
                    ? (payment.gatewayResponse as Record<string, unknown>)
                    : {}),
                  webhookCaptured: true,
                  webhookEventId: eventId,
                  updatedAt: new Date().toISOString(),
                },
              },
            });

            await tx.booking.update({
              where: { id: payment.bookingId },
              data: {
                paymentStatus: 'PAID',
                ...(payment.booking.bookingStatus === 'PENDING' ? { bookingStatus: 'CONFIRMED' } : {}),
              },
            });
          });

          void safeNotify({
            userId: payment.customerId,
            title: 'Payment Successful',
            message: `Your payment for booking #${payment.booking.bookingId} has been confirmed.`,
            type: 'PAYMENT',
            dedupKey: `PAYMENT_SUCCESS:${payment.id}`,
            actionUrl: `/(customer)/booking/${payment.bookingId}`,
            data: { paymentId: payment.id, bookingId: payment.bookingId },
          });
        }
      }
    }
  } else if (eventType === 'payment.failed') {
    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const rzpPaymentId = paymentEntity?.id;

    if (orderId) {
      const payment = await prisma.payment.findFirst({
        where: { gatewayOrderId: orderId },
        include: { booking: { select: { id: true, bookingId: true } } },
      });

      if (payment && payment.status !== 'SUCCESS' && payment.status !== 'REFUNDED') {
        processedPaymentId = payment.id;
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              transactionId: rzpPaymentId || payment.transactionId,
              gatewayResponse: {
                ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
                  ? (payment.gatewayResponse as Record<string, unknown>)
                  : {}),
                webhookFailed: true,
                errorDetails: paymentEntity?.error_description || 'Payment failed at gateway',
                updatedAt: new Date().toISOString(),
              },
            },
          });

          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: 'FAILED' },
          });
        });

        void safeNotify({
          userId: payment.customerId,
          title: 'Payment Failed',
          message: `Payment for booking #${payment.booking.bookingId} failed. Please try again with another method.`,
          type: 'PAYMENT',
          dedupKey: `PAYMENT_FAILED:${payment.id}:${Date.now()}`,
          actionUrl: `/(customer)/booking/${payment.bookingId}`,
          data: { paymentId: payment.id, bookingId: payment.bookingId },
        });
      }
    }
  } else if (eventType === 'refund.processed') {
    const refundEntity = payload.payload?.refund?.entity;
    const rzpPaymentId = refundEntity?.payment_id;

    if (rzpPaymentId) {
      const payment = await prisma.payment.findFirst({
        where: { gatewayPaymentId: rzpPaymentId },
        include: { booking: { select: { id: true, bookingId: true } } },
      });

      if (payment && payment.status !== 'REFUNDED') {
        processedPaymentId = payment.id;
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'REFUNDED',
              gatewayResponse: {
                ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
                  ? (payment.gatewayResponse as Record<string, unknown>)
                  : {}),
                refundProcessed: true,
                refundId: refundEntity?.id,
                refundedAt: new Date().toISOString(),
              },
            },
          });

          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: 'REFUNDED' },
          });

          await voidPendingPayoutsForBooking(payment.bookingId, 'Gateway refund processed', tx);
        });
      }
    }
  }

  // 5. Store processed event in WebhookEvent table for idempotency
  await prisma.webhookEvent.create({
    data: {
      eventId,
      eventType,
      provider: 'RAZORPAY',
      payload,
    },
  });

  return {
    success: true,
    message: 'Webhook processed successfully',
    event: eventType,
    paymentId: processedPaymentId,
  };
}

/**
 * Triggers a real refund via Razorpay's refund API when payment was captured online.
 */
export async function refundRazorpayPayment(
  paymentId: string,
  reason?: string,
  customClient?: Razorpay,
) {
  const prisma = getPrismaClient();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  if (payment.status !== 'SUCCESS') {
    throw new ApiError(400, `Cannot refund payment with status ${payment.status}`);
  }

  if (payment.gateway === 'RAZORPAY' && payment.gatewayPaymentId) {
    const razorpay = getRazorpayClient(customClient);
    try {
      await razorpay.payments.refund(payment.gatewayPaymentId, {
        notes: {
          reason: reason?.trim() || 'Customer requested refund',
          paymentId: payment.id,
          bookingId: payment.bookingId,
        },
      });
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[Razorpay] Gateway refund API error:', error);
      }
      const currentKeyId = process.env.RAZORPAY_KEY_ID || '';
      if (
        process.env.NODE_ENV !== 'production' &&
        (currentKeyId.includes('placeholder') || currentKeyId.includes('local') || currentKeyId.includes('mock'))
      ) {
        return true;
      }
      // If gateway indicates already refunded or error, handle informatively
      const msg = error instanceof Error ? error.message : 'Gateway error';
      throw new ApiError(502, `Payment gateway refund failed: ${msg}`);
    }
  }

  return true;
}

/**
 * Generates test payment credentials for Expo Go / mobile simulator testing in TEST MODE.
 * Strictly forbidden and disabled if live keys are present or in production.
 */
export async function generateTestPaymentSignature(
  customerId: string,
  input: { bookingId: string; orderId?: string },
  secretOverride?: string,
) {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(403, 'Test payment signatures are strictly forbidden in production');
  }

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  if (keyId.startsWith('rzp_live_')) {
    throw new ApiError(403, 'Test payment signatures are forbidden in live mode');
  }

  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bookingId);
  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: input.bookingId } : { bookingId: input.bookingId },
    include: { payment: true },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId !== customerId) {
    throw new ApiError(403, 'Unauthorized booking access');
  }

  const orderId = input.orderId || booking.payment?.gatewayOrderId;
  if (!orderId) {
    throw new ApiError(400, 'No active gateway order found for this booking');
  }

  const paymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secret = secretOverride || process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
    bookingId: booking.id,
  };
}

