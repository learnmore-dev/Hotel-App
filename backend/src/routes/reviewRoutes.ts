import { Router } from 'express';

import * as reviewController from '../controllers/review.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  bookingEligibilityValidation,
  createReviewValidation,
  hotelReviewsQueryValidation,
  reviewIdValidation,
  updateReviewValidation,
} from '../validators/review.validators.js';

const reviewRouter = Router();

// Customer: Submit review for eligible completed booking
reviewRouter.post(
  '/',
  authenticate,
  requireRole('CUSTOMER'),
  createReviewValidation,
  validateRequest,
  reviewController.createReview,
);

// Customer: List reviews written by current authenticated customer
reviewRouter.get(
  '/my',
  authenticate,
  requireRole('CUSTOMER'),
  reviewController.getCustomerReviews,
);

// Customer: Check review eligibility for a booking
reviewRouter.get(
  '/eligibility/:bookingId',
  authenticate,
  requireRole('CUSTOMER'),
  bookingEligibilityValidation,
  validateRequest,
  reviewController.getBookingEligibility,
);

// Public: List published reviews for a hotel with rating summary
reviewRouter.get(
  '/hotel/:hotelId',
  hotelReviewsQueryValidation,
  validateRequest,
  reviewController.getHotelReviews,
);

// Authenticated / Public: Get single review by ID
reviewRouter.get(
  '/:id',
  optionalAuthenticate,
  reviewIdValidation,
  validateRequest,
  reviewController.getReviewById,
);

// Customer: Update own review
reviewRouter.put(
  '/:id',
  authenticate,
  requireRole('CUSTOMER'),
  updateReviewValidation,
  validateRequest,
  reviewController.updateCustomerReview,
);

// Customer: Delete own review
reviewRouter.delete(
  '/:id',
  authenticate,
  requireRole('CUSTOMER'),
  reviewIdValidation,
  validateRequest,
  reviewController.deleteCustomerReview,
);

export default reviewRouter;
