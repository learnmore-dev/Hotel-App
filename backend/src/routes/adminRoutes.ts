import { Router } from 'express';

import * as bookingController from '../controllers/booking.controller.js';
import * as couponController from '../controllers/coupon.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as payoutController from '../controllers/payout.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  bookingQueryValidation,
  updateBookingStatusValidation,
} from '../validators/booking.validators.js';
import {
  adminCouponQueryValidation,
  createCouponValidation,
  updateCouponValidation,
} from '../validators/coupon.validators.js';
import { broadcastNotificationValidation } from '../validators/notification.validators.js';
import {
  adminPayoutIdValidation,
  adminPayoutsQueryValidation,
  adminUpdateCommissionValidation,
  adminUpdatePayoutStatusValidation,
} from '../validators/payout.validators.js';
import {
  adminModerateReviewValidation,
  adminReviewsQueryValidation,
} from '../validators/review.validators.js';
import { adminHotelRouter } from './hotel.routes.js';

const adminRouter = Router();

adminRouter.use(adminHotelRouter);

// Admin booking management endpoints
adminRouter.get(
  '/bookings',
  authenticate,
  requireRole('ADMIN'),
  bookingQueryValidation,
  validateRequest,
  bookingController.getAdminBookings,
);

adminRouter.get(
  '/bookings/:id',
  authenticate,
  requireRole('ADMIN'),
  bookingController.getAdminBookingById,
);

adminRouter.patch(
  '/bookings/:id/status',
  authenticate,
  requireRole('ADMIN'),
  updateBookingStatusValidation,
  validateRequest,
  bookingController.updateAdminBookingStatus,
);

// Admin coupon management endpoints (Step 8 & Step 9)
adminRouter.get(
  '/coupons',
  authenticate,
  requireRole('ADMIN'),
  adminCouponQueryValidation,
  validateRequest,
  couponController.getAdminCoupons,
);

adminRouter.post(
  '/coupons',
  authenticate,
  requireRole('ADMIN'),
  createCouponValidation,
  validateRequest,
  couponController.createAdminCoupon,
);

adminRouter.get(
  '/coupons/:id',
  authenticate,
  requireRole('ADMIN'),
  couponController.getAdminCouponById,
);

adminRouter.patch(
  '/coupons/:id',
  authenticate,
  requireRole('ADMIN'),
  updateCouponValidation,
  validateRequest,
  couponController.updateAdminCoupon,
);

adminRouter.delete(
  '/coupons/:id',
  authenticate,
  requireRole('ADMIN'),
  couponController.deleteAdminCoupon,
);

// Admin review moderation endpoints
adminRouter.get(
  '/reviews',
  authenticate,
  requireRole('ADMIN'),
  adminReviewsQueryValidation,
  validateRequest,
  reviewController.getAdminReviews,
);

adminRouter.patch(
  '/reviews/:id/moderate',
  authenticate,
  requireRole('ADMIN'),
  adminModerateReviewValidation,
  validateRequest,
  reviewController.moderateReview,
);

// Admin payout management endpoints (Phase 14)
adminRouter.get(
  '/payouts',
  authenticate,
  requireRole('ADMIN'),
  adminPayoutsQueryValidation,
  validateRequest,
  payoutController.getAdminPayouts,
);

adminRouter.get(
  '/payouts/:id',
  authenticate,
  requireRole('ADMIN'),
  adminPayoutIdValidation,
  validateRequest,
  payoutController.getAdminPayoutById,
);

adminRouter.patch(
  '/payouts/:id/status',
  authenticate,
  requireRole('ADMIN'),
  adminUpdatePayoutStatusValidation,
  validateRequest,
  payoutController.updateAdminPayoutStatus,
);

// Admin partner commission rate management endpoint (Phase 14)
adminRouter.patch(
  '/partners/:id/commission',
  authenticate,
  requireRole('ADMIN'),
  adminUpdateCommissionValidation,
  validateRequest,
  payoutController.updatePartnerCommission,
);

// Admin notification broadcast endpoint (Phase 15)
adminRouter.post(
  '/notifications/broadcast',
  authenticate,
  requireRole('ADMIN'),
  broadcastNotificationValidation,
  validateRequest,
  notificationController.broadcastNotification,
);

export default adminRouter;
