import { body, param } from 'express-validator';

export const createPaymentValidation = [
  body('bookingId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('bookingId is required'),
  body('paymentMethod')
    .isString()
    .trim()
    .isIn(['UPI', 'CARD', 'NET_BANKING', 'PAY_AT_HOTEL'])
    .withMessage('paymentMethod must be one of UPI, CARD, NET_BANKING, PAY_AT_HOTEL'),
  body('idempotencyKey')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('idempotencyKey must be between 1 and 128 characters'),
  body('simulateFailure')
    .optional()
    .isBoolean()
    .withMessage('simulateFailure must be a boolean')
    .toBoolean(),
];

export const updatePaymentStatusValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('status')
    .isString()
    .trim()
    .isIn(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'])
    .withMessage('status must be one of PENDING, SUCCESS, FAILED, REFUNDED'),
  body('reason')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be 500 characters or fewer'),
];

export const refundPaymentValidation = [
  param('id')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('reason')
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('reason must be 500 characters or fewer'),
];

export const createRazorpayOrderValidation = [
  body('bookingId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('bookingId is required'),
];

export const verifyRazorpayPaymentValidation = [
  body('bookingId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('bookingId is required'),
  body('razorpay_order_id')
    .custom((val, { req }) => {
      const orderId = val || req.body.razorpayOrderId;
      if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
        throw new Error('razorpay_order_id is required');
      }
      return true;
    }),
  body('razorpay_payment_id')
    .custom((val, { req }) => {
      const paymentId = val || req.body.razorpayPaymentId;
      if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
        throw new Error('razorpay_payment_id is required');
      }
      return true;
    }),
  body('razorpay_signature')
    .custom((val, { req }) => {
      const signature = val || req.body.razorpaySignature;
      if (!signature || typeof signature !== 'string' || !signature.trim()) {
        throw new Error('razorpay_signature is required');
      }
      return true;
    }),
];
