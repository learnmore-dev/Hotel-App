import { Router } from 'express';

import * as bookingController from '../controllers/booking.controller.js';
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
  partnerEarningsHistoryQueryValidation,
  partnerPayoutsQueryValidation,
  requestPayoutValidation,
} from '../validators/payout.validators.js';
import { partnerReviewsQueryValidation } from '../validators/review.validators.js';
import { partnerHotelRouter } from './hotel.routes.js';

const partnerRouter = Router();

partnerRouter.use(partnerHotelRouter);

// Partner review management endpoints
partnerRouter.get(
  '/reviews',
  authenticate,
  requireRole('PARTNER'),
  partnerReviewsQueryValidation,
  validateRequest,
  reviewController.getPartnerReviews,
);

// Partner booking management endpoints
partnerRouter.get(
  '/bookings',
  authenticate,
  requireRole('PARTNER'),
  bookingQueryValidation,
  validateRequest,
  bookingController.getPartnerBookings,
);

partnerRouter.get(
  '/bookings/:id',
  authenticate,
  requireRole('PARTNER'),
  bookingController.getPartnerBookingById,
);

partnerRouter.patch(
  '/bookings/:id/status',
  authenticate,
  requireRole('PARTNER'),
  updateBookingStatusValidation,
  validateRequest,
  bookingController.updatePartnerBookingStatus,
);

// Partner earnings & payouts endpoints (Phase 14)
partnerRouter.get(
  '/earnings/summary',
  authenticate,
  requireRole('PARTNER'),
  payoutController.getPartnerEarningsSummary,
);

partnerRouter.get(
  '/earnings/history',
  authenticate,
  requireRole('PARTNER'),
  partnerEarningsHistoryQueryValidation,
  validateRequest,
  payoutController.getPartnerEarningsHistory,
);

partnerRouter.get(
  '/payouts',
  authenticate,
  requireRole('PARTNER'),
  partnerPayoutsQueryValidation,
  validateRequest,
  payoutController.getPartnerPayouts,
);

partnerRouter.post(
  '/payouts/request',
  authenticate,
  requireRole('PARTNER'),
  requestPayoutValidation,
  validateRequest,
  payoutController.requestPartnerPayout,
);

export default partnerRouter;
