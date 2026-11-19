import type { RequestHandler } from 'express';

import * as paymentService from '../services/payment.service.js';
import * as razorpayService from '../services/razorpay.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Creates or initiates a payment for a booking by the authenticated customer.
 * POST /api/payments
 */
export const createPayment = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const { bookingId, paymentMethod, idempotencyKey, simulateFailure } = req.body;

  if (!bookingId || !paymentMethod) {
    throw new ApiError(400, 'bookingId and paymentMethod are required');
  }

  const payment = await paymentService.createPayment(req.auth.userId, {
    bookingId,
    paymentMethod,
    idempotencyKey,
    simulateFailure,
  });

  const response: ApiSuccess<typeof payment> = {
    success: true,
    message:
      payment.status === 'SUCCESS'
        ? 'Payment completed successfully'
        : payment.status === 'PENDING'
          ? 'Payment pending (pay at hotel)'
          : 'Payment failed',
    data: payment,
  };

  res.status(201).json(response);
});

/**
 * Retrieves payment details by payment ID or transaction ID.
 * GET /api/payments/:id
 */
export const getPaymentById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    throw new ApiError(400, 'Payment ID is required');
  }

  const payment = await paymentService.getPaymentById(req.auth.userId, req.auth.role, id);

  res.json({
    success: true,
    message: 'Payment details retrieved',
    data: payment,
  });
});

/**
 * Retrieves payment details for a specific booking.
 * GET /api/bookings/:bookingId/payment or GET /api/payments/booking/:bookingId
 */
export const getBookingPayment = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.bookingId || req.params.id;
  const bookingId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  const payment = await paymentService.getBookingPayment(req.auth.userId, req.auth.role, bookingId);

  res.json({
    success: true,
    message: 'Booking payment details retrieved',
    data: payment,
  });
});

/**
 * Updates a payment's status (Admin only).
 * PATCH /api/payments/:id/status
 */
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    throw new ApiError(400, 'Payment ID is required');
  }

  const { status, reason } = req.body;
  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const updated = await paymentService.updatePaymentStatus(req.auth.userId, id, status, reason);

  res.json({
    success: true,
    message: `Payment status updated to ${status}`,
    data: updated,
  });
});

/**
 * Refunds a successful payment (Admin only).
 * POST /api/payments/:id/refund
 */
export const refundPayment = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    throw new ApiError(400, 'Payment ID is required');
  }

  const { reason } = req.body || {};

  // If Razorpay gateway, trigger provider refund API first
  const existingPayment = await paymentService.getPaymentById(req.auth.userId, req.auth.role, id);
  if (existingPayment.gateway === 'RAZORPAY' && existingPayment.gatewayPaymentId) {
    await razorpayService.refundRazorpayPayment(id, reason);
  }

  const refunded = await paymentService.updatePaymentStatus(req.auth.userId, id, 'REFUNDED', reason);

  res.json({
    success: true,
    message: 'Payment refunded successfully',
    data: refunded,
  });
});

/**
 * Creates an authoritative Razorpay order for online checkout.
 * POST /api/payments/razorpay/order
 */
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const { bookingId } = req.body;
  const orderDetails = await razorpayService.createRazorpayOrder(req.auth.userId, { bookingId });

  res.status(201).json({
    success: true,
    message: 'Razorpay order created successfully',
    data: orderDetails,
  });
});

/**
 * Verifies Razorpay payment signature and confirms booking.
 * POST /api/payments/razorpay/verify
 */
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const bookingId = req.body.bookingId;
  const razorpay_order_id = req.body.razorpay_order_id || req.body.razorpayOrderId;
  const razorpay_payment_id = req.body.razorpay_payment_id || req.body.razorpayPaymentId;
  const razorpay_signature = req.body.razorpay_signature || req.body.razorpaySignature;

  const payment = await razorpayService.verifyRazorpayPayment(req.auth.userId, {
    bookingId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  res.json({
    success: true,
    message: 'Payment verified and booking confirmed',
    data: payment,
  });
});

/**
 * Webhook receiver for Razorpay events (payment.captured, payment.failed, etc.).
 * POST /api/payments/razorpay/webhook
 */
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = (req.headers['x-razorpay-signature'] as string) || '';
  if (!signature) {
    throw new ApiError(400, 'Missing x-razorpay-signature header');
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody || JSON.stringify(req.body);
  const result = await razorpayService.processRazorpayWebhook(rawBody, signature);

  res.status(200).json(result);
});

/**
 * Generates test payment credentials for Expo Go / simulator test mode.
 * POST /api/payments/razorpay/test-sign
 */
export const generateTestPaymentSignature = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(403, 'Test payment signatures are strictly forbidden in production');
  }

  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const { bookingId, orderId } = req.body;
  if (!bookingId) {
    throw new ApiError(400, 'bookingId is required');
  }

  const credentials = await razorpayService.generateTestPaymentSignature(req.auth.userId, {
    bookingId,
    orderId,
  });

  res.json({
    success: true,
    message: 'Test payment signature generated',
    data: credentials,
  });
});

