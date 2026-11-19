import type { RequestHandler } from 'express';

import * as payoutService from '../services/payout.service.js';
import type {
  AdminPayoutsQuery,
  PartnerEarningsHistoryQuery,
  PartnerPayoutsQuery,
} from '../services/payout.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Retrieves earnings summary for the authenticated partner.
 */
export const getPartnerEarningsSummary = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await payoutService.getPartnerEarningsSummary(req.auth.userId);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Partner earnings summary retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Retrieves booking-level earnings history for the authenticated partner.
 */
export const getPartnerEarningsHistory = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const query = {
    status: req.query.status as PartnerEarningsHistoryQuery['status'],
    hotelId: req.query.hotelId as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const data = await payoutService.getPartnerEarningsHistory(req.auth.userId, query);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Partner earnings history retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Retrieves payout requests and history for the authenticated partner.
 */
export const getPartnerPayouts = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const query = {
    status: req.query.status as PartnerPayoutsQuery['status'],
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const data = await payoutService.getPartnerPayouts(req.auth.userId, query);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Partner payouts retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Submits a new payout request for eligible completed bookings.
 */
export const requestPartnerPayout = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const { bookingIds, notes } = req.body;

  const data = await payoutService.requestPartnerPayout(req.auth.userId, {
    bookingIds,
    notes,
  });

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Payout request created successfully',
    data,
  };

  res.status(201).json(response);
});

/**
 * Retrieves all payout requests across partners for admin management.
 */
export const getAdminPayouts = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const query = {
    status: req.query.status as AdminPayoutsQuery['status'],
    partnerId: req.query.partnerId as string | undefined,
    hotelId: req.query.hotelId as string | undefined,
    batchReference: req.query.batchReference as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };

  const data = await payoutService.getAdminPayouts(query);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Admin payouts retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Retrieves single payout record by ID for admin detail view.
 */
export const getAdminPayoutById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const id = req.params.id as string;
  const data = await payoutService.getAdminPayoutById(id);

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Payout detail retrieved successfully',
    data,
  };

  res.json(response);
});

/**
 * Approves, rejects, or marks a payout as paid.
 */
export const updateAdminPayoutStatus = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const id = req.params.id as string;
  const { action, transactionReference, rejectionReason, notes } = req.body;

  const data = await payoutService.updateAdminPayoutStatus(req.auth.userId, id, {
    action,
    transactionReference,
    rejectionReason,
    notes,
  });

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: `Payout successfully ${action === 'APPROVE' ? 'approved' : action === 'REJECT' ? 'rejected' : 'marked as paid'}`,
    data,
  };

  res.json(response);
});

/**
 * Updates a partner's commission rate by administrator.
 */
export const updatePartnerCommission = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const id = req.params.id as string;
  const { commissionRate } = req.body;

  const data = await payoutService.updatePartnerCommissionRate(req.auth.userId, id, Number(commissionRate));

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Partner commission rate updated successfully',
    data,
  };

  res.json(response);
});
