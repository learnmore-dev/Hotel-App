import { Router } from 'express';

import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createPaymentValidation,
  createRazorpayOrderValidation,
  refundPaymentValidation,
  updatePaymentStatusValidation,
  verifyRazorpayPaymentValidation,
} from '../validators/payment.validators.js';

const paymentRouter = Router();

// Razorpay order creation for online checkout
paymentRouter.post(
  '/razorpay/order',
  authenticate,
  requireRole('CUSTOMER'),
  createRazorpayOrderValidation,
  validateRequest,
  paymentController.createRazorpayOrder,
);

// Razorpay payment signature verification
paymentRouter.post(
  '/razorpay/verify',
  authenticate,
  requireRole('CUSTOMER'),
  verifyRazorpayPaymentValidation,
  validateRequest,
  paymentController.verifyRazorpayPayment,
);

// Razorpay test signature generator (for mobile simulator / Expo Go test mode only)
// Strictly forbidden and omitted in production
if (process.env.NODE_ENV !== 'production') {
  paymentRouter.post(
    '/razorpay/test-sign',
    authenticate,
    requireRole('CUSTOMER'),
    paymentController.generateTestPaymentSignature,
  );
}

// Razorpay webhook endpoint (HMAC signature verified)
paymentRouter.post('/razorpay/webhook', paymentController.handleRazorpayWebhook);
paymentRouter.post('/webhook', paymentController.handleRazorpayWebhook);

// Customer creates/initiates payment (supports Pay at Hotel & simulated fallback)
paymentRouter.post(
  '/',
  authenticate,
  requireRole('CUSTOMER'),
  createPaymentValidation,
  validateRequest,
  paymentController.createPayment,
);

// Get payment by booking reference or UUID
paymentRouter.get(
  '/booking/:bookingId',
  authenticate,
  paymentController.getBookingPayment,
);

// Get payment by payment ID or transaction ID
paymentRouter.get(
  '/:id',
  authenticate,
  paymentController.getPaymentById,
);

// Admin updates payment status
paymentRouter.patch(
  '/:id/status',
  authenticate,
  requireRole('ADMIN'),
  updatePaymentStatusValidation,
  validateRequest,
  paymentController.updatePaymentStatus,
);

// Admin refunds payment
paymentRouter.post(
  '/:id/refund',
  authenticate,
  requireRole('ADMIN'),
  refundPaymentValidation,
  validateRequest,
  paymentController.refundPayment,
);

export default paymentRouter;
