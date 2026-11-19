import type { RequestHandler } from 'express';

import * as reviewService from '../services/review.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Creates a review for an eligible booking.
 */
export const createReview = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const { bookingId, rating, comment } = req.body;

  const data = await reviewService.createReview(req.auth.userId, {
    bookingId,
    rating: Number(rating),
    comment,
  });

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Review submitted successfully',
    data,
  };

  res.status(201).json(response);
});

/**
 * Checks review eligibility for a booking.
 */
export const getBookingEligibility = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const bookingId = req.params.bookingId as string;
  const data = await reviewService.getBookingEligibilityStatus(bookingId, req.auth.userId);

  res.json({
    success: true,
    message: 'Eligibility status retrieved',
    data,
  });
});

/**
 * Retrieves published reviews and rating summary for a hotel.
 */
export const getHotelReviews = asyncHandler(async (req, res) => {
  const hotelId = (req.params.hotelId || req.params.id) as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;

  const data = await reviewService.getHotelReviews(hotelId, { page, limit, rating });

  res.json({
    success: true,
    message: 'Hotel reviews retrieved',
    data,
  });
});

/**
 * Retrieves all reviews submitted by the authenticated customer.
 */
export const getCustomerReviews = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const data = await reviewService.getCustomerReviews(req.auth.userId, { page, limit });

  res.json({
    success: true,
    message: 'Your reviews retrieved',
    data,
  });
});

/**
 * Retrieves a single review by ID.
 */
export const getReviewById = asyncHandler(async (req, res) => {
  const reviewId = req.params.id as string;
  const currentUserId = req.auth?.userId;
  const userRole = req.auth?.role;

  const data = await reviewService.getReviewById(reviewId, currentUserId, userRole);

  res.json({
    success: true,
    message: 'Review retrieved',
    data,
  });
});

/**
 * Updates a customer's own review.
 */
export const updateCustomerReview = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const reviewId = req.params.id as string;
  const { rating, comment } = req.body;

  const data = await reviewService.updateCustomerReview(req.auth.userId, reviewId, {
    rating: rating !== undefined ? Number(rating) : undefined,
    comment,
  });

  res.json({
    success: true,
    message: 'Review updated successfully',
    data,
  });
});

/**
 * Deletes a customer's own review.
 */
export const deleteCustomerReview = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const reviewId = req.params.id as string;
  const data = await reviewService.deleteCustomerReview(req.auth.userId, reviewId);

  res.json({
    success: true,
    message: data.message,
    data: null,
  });
});

/**
 * Partner: List reviews for partner's hotels.
 */
export const getPartnerReviews = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const hotelId = req.query.hotelId as string | undefined;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;

  const data = await reviewService.getPartnerReviews(req.auth.userId, {
    hotelId,
    page,
    limit,
    rating,
  });

  res.json({
    success: true,
    message: 'Partner reviews retrieved',
    data,
  });
});

/**
 * Admin: List all reviews across the platform with filters.
 */
export const getAdminReviews = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const hotelId = req.query.hotelId as string | undefined;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;
  const isPublished =
    req.query.isPublished !== undefined
      ? String(req.query.isPublished) === 'true'
      : undefined;

  const data = await reviewService.getAdminReviews({
    hotelId,
    page,
    limit,
    rating,
    isPublished,
  });

  res.json({
    success: true,
    message: 'Admin reviews retrieved',
    data,
  });
});

/**
 * Admin: Moderate a review (hide or publish).
 */
export const moderateReview = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const reviewId = req.params.id as string;
  const { isPublished, reason } = req.body;

  const data = await reviewService.moderateReview(req.auth.userId, reviewId, {
    isPublished: Boolean(isPublished),
    reason,
  });

  res.json({
    success: true,
    message: isPublished ? 'Review published' : 'Review hidden from public view',
    data,
  });
});
