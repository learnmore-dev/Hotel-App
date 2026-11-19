import type { RequestHandler } from 'express';

import * as bookingService from '../services/booking.service.js';
import type { ApiSuccess } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function queryFromRequest(query: Record<string, unknown>): bookingService.BookingQuery {
  const text = (key: string): string | undefined => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const number = (key: string): number | undefined => {
    const val = text(key);
    return val === undefined ? undefined : Number(val);
  };

  return {
    page: number('page'),
    limit: number('limit'),
    status: text('status') as bookingService.BookingQuery['status'],
    paymentStatus: text('paymentStatus') as bookingService.BookingQuery['paymentStatus'],
    hotelId: text('hotelId'),
    customerId: text('customerId'),
    startDate: text('startDate'),
    endDate: text('endDate'),
    search: text('search'),
    timeFilter: text('timeFilter') as bookingService.BookingQuery['timeFilter'],
  };
}

export const createBooking = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const idempotencyKey =
    (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined) ||
    req.get('Idempotency-Key') ||
    req.get('idempotency-key') ||
    null;

  const data = await bookingService.createBooking(req.auth.userId, {
    hotelId: req.body.hotelId,
    roomId: req.body.roomId,
    checkIn: req.body.checkIn,
    checkOut: req.body.checkOut,
    roomsCount: Number(req.body.roomsCount),
    guestsCount: Number(req.body.guestsCount),
    guestDetails: req.body.guestDetails,
    specialRequests: req.body.specialRequests,
    idempotencyKey,
    couponCode: typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined,
  });

  const response: ApiSuccess<typeof data> = {
    success: true,
    message: 'Booking created successfully',
    data,
  };

  res.status(201).json(response);
});

export const getMyBookings = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const data = await bookingService.listCustomerBookings(
    req.auth.userId,
    queryFromRequest(req.query as Record<string, unknown>),
  );

  res.json({ success: true, message: 'Bookings retrieved', data });
});

export const getBookingById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const data = await bookingService.findCustomerBookingById(req.auth.userId, id);
  res.json({ success: true, message: 'Booking details retrieved', data });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const reason = typeof req.body?.cancellationReason === 'string' ? req.body.cancellationReason : undefined;
  const data = await bookingService.cancelCustomerBooking(req.auth.userId, id, reason);

  res.json({ success: true, message: 'Booking cancelled successfully', data });
});

export const getPartnerBookings = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await bookingService.listPartnerBookings(
    req.auth.userId,
    queryFromRequest(req.query as Record<string, unknown>),
  );

  res.json({ success: true, message: 'Partner bookings retrieved', data });
});

export const getPartnerBookingById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const data = await bookingService.findPartnerBookingById(req.auth.userId, id);
  res.json({ success: true, message: 'Partner booking details retrieved', data });
});

export const updatePartnerBookingStatus = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const status = req.body.status as bookingService.BookingStatus;
  const reason = typeof req.body.reason === 'string' ? req.body.reason : undefined;

  const data = await bookingService.updatePartnerBookingStatus(req.auth.userId, id, status, reason);
  res.json({ success: true, message: `Booking status updated to ${status}`, data });
});

export const getAdminBookings = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const data = await bookingService.listAdminBookings(queryFromRequest(req.query as Record<string, unknown>));

  res.json({ success: true, message: 'Admin bookings retrieved', data });
});

export const getAdminBookingById = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const data = await bookingService.findAdminBookingById(id);
  res.json({ success: true, message: 'Admin booking details retrieved', data });
});

export const updateAdminBookingStatus = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, 'Authentication required');
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) throw new ApiError(400, 'Booking ID is required');

  const status = req.body.status as bookingService.BookingStatus;
  const reason = typeof req.body.reason === 'string' ? req.body.reason : undefined;

  const data = await bookingService.updateAdminBookingStatus(id, status, reason);
  res.json({ success: true, message: `Booking status updated to ${status}`, data });
});
