import type { RequestHandler } from 'express';

import * as couponService from '../services/coupon.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Validates a coupon code for the authenticated customer.
 */
export const validateCoupon = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const code = req.body?.code;
  if (!code || typeof code !== 'string') {
    throw new ApiError(400, 'Coupon code is required');
  }

  const bookingAmount = req.body?.bookingAmount !== undefined ? Number(req.body.bookingAmount) : undefined;

  const data = await couponService.validateCouponForCustomer(
    req.auth.userId,
    code,
    bookingAmount,
  );

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Coupon is valid and applied',
    data,
  };

  res.json(response);
});

/**
 * Returns currently active, unexpired offers for customers.
 */
export const getActiveOffers = asyncHandler(async (_req, res) => {
  const data = await couponService.listActiveOffers();

  res.json({
    success: true,
    message: 'Active offers retrieved',
    data,
  });
});

/**
 * Lists all coupons for system admin with pagination, filtering, and search.
 */
export const getAdminCoupons = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const query: couponService.AdminCouponQuery = {
    page: req.query.page !== undefined ? Number(req.query.page) : undefined,
    limit: req.query.limit !== undefined ? Number(req.query.limit) : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    isActive:
      req.query.isActive !== undefined
        ? req.query.isActive === 'true'
        : undefined,
    discountType: typeof req.query.discountType === 'string'
      ? (req.query.discountType as couponService.AdminCouponQuery['discountType'])
      : undefined,
  };

  const data = await couponService.listAdminCoupons(query);

  res.json({
    success: true,
    message: 'Coupons retrieved successfully',
    data,
  });
});

/**
 * Retrieves a single coupon by ID for system admin.
 */
export const getAdminCouponById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Coupon ID is required');

  const data = await couponService.getAdminCouponById(id);

  res.json({
    success: true,
    message: 'Coupon details retrieved',
    data,
  });
});

/**
 * Creates a new coupon by system admin.
 */
export const createAdminCoupon = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await couponService.createAdminCoupon(req.body);

  res.status(201).json({
    success: true,
    message: 'Coupon created successfully',
    data,
  });
});

/**
 * Updates an existing coupon by system admin.
 */
export const updateAdminCoupon = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Coupon ID is required');

  const data = await couponService.updateAdminCoupon(id, req.body);

  res.json({
    success: true,
    message: 'Coupon updated successfully',
    data,
  });
});

/**
 * Deletes an existing coupon by system admin if unused.
 */
export const deleteAdminCoupon = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Coupon ID is required');

  const data = await couponService.deleteAdminCoupon(id);

  res.json({
    success: true,
    message: data.message,
    data: null,
  });
});
