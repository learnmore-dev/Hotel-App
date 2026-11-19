import { Prisma, type BookingPaymentStatus, type BookingStatus, type CouponDiscountType } from '@prisma/client';

export type { BookingPaymentStatus, BookingStatus };

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { generateBookingId } from '../utils/bookingId.js';
import { calculatePeakBookedRooms } from '../utils/roomAvailability.js';
import { calculateBookingPricing, calculateNumberOfNights } from './pricing.service.js';
import { voidPendingPayoutsForBooking } from './payout.service.js';
import { safeNotify } from './notification.service.js';

export type GuestDetails = {
  fullName: string;
  email: string;
  phone: string;
};

export type CreateBookingInput = {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  guestsCount: number;
  guestDetails: GuestDetails;
  specialRequests?: string | null;
  idempotencyKey?: string | null;
  couponCode?: string | null;
};

export type BookingQuery = {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  hotelId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  timeFilter?: 'upcoming' | 'past' | 'cancelled';
};

export const VALID_BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
};

export const bookingDetailSelect = {
  id: true,
  bookingId: true,
  idempotencyKey: true,
  customerId: true,
  hotelId: true,
  roomId: true,
  checkIn: true,
  checkOut: true,
  roomsCount: true,
  guestsCount: true,
  guestDetails: true,
  specialRequests: true,
  numberOfNights: true,
  roomPrice: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  bookingStatus: true,
  paymentStatus: true,
  couponId: true,
  cancellationReason: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  coupon: {
    select: {
      id: true,
      code: true,
      discountType: true,
      discountValue: true,
      description: true,
    },
  },
  hotel: {
    select: {
      id: true,
      name: true,
      city: true,
      destination: true,
      address: true,
      mainImage: true,
      starRating: true,
      checkInTime: true,
      checkOutTime: true,
      partner: { select: { businessName: true } },
    },
  },
  room: {
    select: {
      id: true,
      roomType: true,
      pricePerNight: true,
      maxGuests: true,
      bedType: true,
      images: true,
      amenities: true,
    },
  },
  customer: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
} satisfies Prisma.BookingSelect;

function parseDateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${label} must be a valid calendar date`);
  }
  return date;
}

export function validateBookingDates(checkInStr: string, checkOutStr: string) {
  const checkIn = parseDateOnly(checkInStr, 'checkIn');
  const checkOut = parseDateOnly(checkOutStr, 'checkOut');

  if (checkOut <= checkIn) {
    throw new ApiError(400, 'checkOut must be after checkIn');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (checkIn < today) {
    throw new ApiError(400, 'checkIn date cannot be in the past');
  }

  return { checkIn, checkOut };
}

function getPagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

/**
 * Creates a hotel booking with atomic transaction and room inventory concurrency protection.
 * Client-provided pricing, status, and customerId are strictly ignored.
 */
export async function createBooking(customerId: string, input: CreateBookingInput) {
  const prisma = getPrismaClient();

  // 1. Idempotency Check: Return existing booking if idempotencyKey was previously processed
  if (input.idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: bookingDetailSelect,
    });
    if (existing) {
      if (existing.customerId !== customerId) {
        throw new ApiError(403, 'Idempotency key belongs to another user');
      }
      return existing;
    }
  }

  // 2. Validate booking dates
  const { checkIn, checkOut } = validateBookingDates(input.checkIn, input.checkOut);

  // 3. Validate capacity rule: ceil(guests / rooms) <= room.maxGuests
  const requiredCapacity = Math.ceil(input.guestsCount / input.roomsCount);

  // 4. Transactional booking creation with concurrency protection
  const createdBooking = await prisma.$transaction(async (tx) => {
    // A. Verify hotel
    const hotel = await tx.hotel.findFirst({
      where: { id: input.hotelId, isActive: true },
      select: { id: true, name: true },
    });
    if (!hotel) {
      throw new ApiError(404, 'Hotel not found or is currently inactive');
    }

    // B. Verify room belongs to hotel and is AVAILABLE
    const room = await tx.room.findFirst({
      where: { id: input.roomId, hotelId: input.hotelId },
      select: {
        id: true,
        roomType: true,
        pricePerNight: true,
        maxGuests: true,
        totalRooms: true,
        availableRooms: true,
        blockedRooms: true,
        status: true,
      },
    });
    if (!room) {
      throw new ApiError(404, 'Room not found for this hotel');
    }
    if (room.status !== 'AVAILABLE') {
      throw new ApiError(400, 'Room is currently unavailable');
    }
    if (requiredCapacity > room.maxGuests) {
      throw new ApiError(
        400,
        `Room accommodates up to ${room.maxGuests} guests per room. Please book additional rooms or select another room type.`,
      );
    }

    // C. Re-check overlapping active bookings inside transaction
    // Check-out is exclusive: existingCheckIn < requestedCheckOut AND existingCheckOut > requestedCheckIn
    const overlappingBookings = await tx.booking.findMany({
      where: {
        roomId: input.roomId,
        bookingStatus: { in: ['PENDING', 'CONFIRMED'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { checkIn: true, checkOut: true, roomsCount: true },
    });

    // D. Calculate sellable capacity & peak booked rooms across requested interval
    const physicalCapacity = Math.max(0, room.totalRooms - room.blockedRooms);
    const sellableCapacity = Math.min(room.availableRooms, physicalCapacity);
    const bookedPeak = calculatePeakBookedRooms(overlappingBookings, { start: checkIn, end: checkOut });
    const remainingRooms = Math.max(0, sellableCapacity - bookedPeak);

    if (remainingRooms < input.roomsCount) {
      throw new ApiError(409, 'The selected room is no longer available for these dates.');
    }

    // E. Calculate server-side pricing & validate coupon
    const numberOfNights = calculateNumberOfNights(checkIn, checkOut);
    const roomPriceNum = typeof room.pricePerNight === 'object' && room.pricePerNight !== null
      ? Number(room.pricePerNight)
      : Number(room.pricePerNight);
    const baseStayAmount = Math.round(roomPriceNum * numberOfNights * input.roomsCount * 100) / 100;

    let appliedCoupon: {
      id: string;
      code: string;
      discountType: CouponDiscountType | 'FIXED_AMOUNT';
      discountValue: number | Prisma.Decimal;
      minimumBookingAmount: number | Prisma.Decimal;
      maximumDiscount: number | Prisma.Decimal | null;
      usageLimit: number | null;
      usedCount: number;
      perUserLimit: number | null;
    } | null = null;

    if (input.couponCode) {
      const normalizedCode = input.couponCode.trim().toUpperCase();
      const coupon = await tx.coupon.findUnique({
        where: { code: normalizedCode },
      });

      if (!coupon) {
        throw new ApiError(404, 'Invalid coupon code');
      }

      if (!coupon.isActive) {
        throw new ApiError(400, 'This coupon is currently inactive');
      }

      const now = new Date();
      if (coupon.validFrom > now) {
        throw new ApiError(400, 'This coupon is not yet valid');
      }

      if (coupon.validUntil < now) {
        throw new ApiError(400, 'This coupon has expired');
      }

      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new ApiError(400, 'This coupon has reached its maximum global usage limit');
      }

      if (coupon.perUserLimit !== null && coupon.perUserLimit > 0) {
        const userUsageCount = await tx.booking.count({
          where: {
            customerId,
            couponId: coupon.id,
            bookingStatus: { not: 'CANCELLED' },
          },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          throw new ApiError(
            400,
            `You have already reached the maximum usage limit (${coupon.perUserLimit}) for this coupon`,
          );
        }
      }

      const minAmount = Number(coupon.minimumBookingAmount);
      if (baseStayAmount < minAmount) {
        throw new ApiError(
          400,
          `Minimum booking amount of $${minAmount.toFixed(2)} required for coupon ${coupon.code}`,
        );
      }

      appliedCoupon = coupon;
    }

    const pricing = calculateBookingPricing(room.pricePerNight, numberOfNights, input.roomsCount, appliedCoupon);

    // F. Generate collision-safe human-readable bookingId
    let bookingReference = generateBookingId();
    let attempts = 0;
    while (
      (await tx.booking.findUnique({ where: { bookingId: bookingReference }, select: { id: true } })) &&
      attempts < 5
    ) {
      bookingReference = generateBookingId();
      attempts++;
    }

    // G. Create booking record
    try {
      const created = await tx.booking.create({
        data: {
          bookingId: bookingReference,
          idempotencyKey: input.idempotencyKey ?? null,
          customerId,
          hotelId: input.hotelId,
          roomId: input.roomId,
          checkIn,
          checkOut,
          roomsCount: input.roomsCount,
          guestsCount: input.guestsCount,
          guestDetails: {
            fullName: input.guestDetails.fullName.trim(),
            email: input.guestDetails.email.trim().toLowerCase(),
            phone: input.guestDetails.phone.trim(),
          },
          specialRequests: input.specialRequests?.trim() || null,
          numberOfNights,
          roomPrice: pricing.roomPrice,
          taxAmount: pricing.taxAmount,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.totalAmount,
          couponId: appliedCoupon ? appliedCoupon.id : null,
          bookingStatus: 'PENDING',
          paymentStatus: 'PENDING',
        },
        select: bookingDetailSelect,
      });

      if (appliedCoupon) {
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return created;
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === 'P2002' &&
        input.idempotencyKey
      ) {
        // Race condition: another concurrent request completed with this idempotency key
        const existing = await tx.booking.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: bookingDetailSelect,
        });
        if (existing) return existing;
      }
      throw createError;
    }
  });

  // Post-transaction notifications (fail-safe and non-blocking)
  const hotelInfo = await prisma.hotel.findUnique({
    where: { id: createdBooking.hotelId },
    select: { name: true, partner: { select: { userId: true } } },
  });

  void safeNotify({
    userId: createdBooking.customerId,
    title: 'Booking Created',
    message: `Your booking #${createdBooking.bookingId} for ${hotelInfo?.name || 'hotel'} has been received.`,
    type: 'BOOKING',
    dedupKey: `BOOKING_CREATED:${createdBooking.id}`,
    actionUrl: `/(customer)/booking/${createdBooking.id}`,
    data: { bookingId: createdBooking.id },
  });

  if (hotelInfo?.partner?.userId) {
    void safeNotify({
      userId: hotelInfo.partner.userId,
      title: 'New Booking Received',
      message: `New booking #${createdBooking.bookingId} received for ${hotelInfo.name}.`,
      type: 'BOOKING',
      dedupKey: `PARTNER_BOOKING:${createdBooking.id}`,
      actionUrl: `/(partner)/bookings/${createdBooking.id}`,
      data: { bookingId: createdBooking.id },
    });
  }

  return createdBooking;
}

/**
 * List bookings for authenticated customer with pagination, search, and time-based filtering.
 */
export async function listCustomerBookings(customerId: string, query: BookingQuery) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 10, 50);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let statusFilter: Prisma.BookingWhereInput['bookingStatus'] = query.status ? query.status : undefined;
  let dateFilter: Prisma.BookingWhereInput = {};

  if (query.timeFilter === 'upcoming') {
    statusFilter = { in: ['PENDING', 'CONFIRMED'] };
    dateFilter = { checkIn: { gte: today } };
  } else if (query.timeFilter === 'past') {
    dateFilter = {
      OR: [{ checkOut: { lt: today } }, { bookingStatus: 'COMPLETED' }],
    };
  } else if (query.timeFilter === 'cancelled') {
    statusFilter = 'CANCELLED';
  }

  if (query.startDate) {
    dateFilter = { ...dateFilter, checkIn: { gte: parseDateOnly(query.startDate, 'startDate') } };
  }
  if (query.endDate) {
    dateFilter = { ...dateFilter, checkOut: { lte: parseDateOnly(query.endDate, 'endDate') } };
  }

  const searchFilter: Prisma.BookingWhereInput = query.search
    ? {
        OR: [
          { bookingId: { contains: query.search, mode: 'insensitive' } },
          { hotel: { name: { contains: query.search, mode: 'insensitive' } } },
          { hotel: { city: { contains: query.search, mode: 'insensitive' } } },
        ],
      }
    : {};

  const where: Prisma.BookingWhereInput = {
    customerId,
    ...(statusFilter ? { bookingStatus: statusFilter } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...dateFilter,
    ...searchFilter,
  };

  const prisma = getPrismaClient();
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      select: bookingDetailSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, pagination: getPagination(page, limit, total) };
}

/**
 * Find customer booking by primary UUID or readable bookingId.
 */
export async function findCustomerBookingById(customerId: string, idOrReference: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const booking = await getPrismaClient().booking.findFirst({
    where: {
      customerId,
      ...(isUuid ? { id: idOrReference } : { bookingId: idOrReference }),
    },
    select: bookingDetailSelect,
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  return booking;
}

/**
 * Cancel customer booking.
 */
export async function cancelCustomerBooking(customerId: string, idOrReference: string, reason?: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const prisma = getPrismaClient();

  const booking = await prisma.booking.findFirst({
    where: {
      customerId,
      ...(isUuid ? { id: idOrReference } : { bookingId: idOrReference }),
    },
    select: { id: true, bookingStatus: true, couponId: true },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.bookingStatus === 'CANCELLED') {
    throw new ApiError(400, 'This booking has already been cancelled');
  }

  if (booking.bookingStatus === 'COMPLETED') {
    throw new ApiError(400, 'Completed bookings cannot be cancelled');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.booking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason?.trim() || null,
      },
      select: bookingDetailSelect,
    });

    if (booking.couponId) {
      await tx.coupon.update({
        where: { id: booking.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    await voidPendingPayoutsForBooking(booking.id, reason?.trim() || 'Cancelled by customer', tx);

    return updatedRecord;
  });

  const hotel = await prisma.hotel.findUnique({
    where: { id: updated.hotelId },
    select: { name: true, partner: { select: { userId: true } } },
  });

  void safeNotify({
    userId: updated.customerId,
    title: 'Booking Cancelled',
    message: `Your booking #${updated.bookingId} for ${hotel?.name || 'hotel'} has been cancelled.`,
    type: 'BOOKING',
    dedupKey: `BOOKING_CANCELLED:${updated.id}`,
    actionUrl: `/(customer)/booking/${updated.id}`,
    data: { bookingId: updated.id },
  });

  if (hotel?.partner?.userId) {
    void safeNotify({
      userId: hotel.partner.userId,
      title: 'Booking Cancelled',
      message: `Booking #${updated.bookingId} for ${hotel.name} was cancelled by guest.`,
      type: 'BOOKING',
      dedupKey: `PARTNER_BOOKING_CANCELLED:${updated.id}`,
      actionUrl: `/(partner)/bookings/${updated.id}`,
      data: { bookingId: updated.id },
    });
  }

  return updated;
}

/**
 * List bookings for hotels owned by the authenticated partner.
 */
export async function listPartnerBookings(userId: string, query: BookingQuery) {
  const prisma = getPrismaClient();
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });

  if (!partnerProfile || partnerProfile.status !== 'APPROVED') {
    throw new ApiError(403, 'An approved partner profile is required to view partner bookings');
  }

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 10, 50);

  const searchFilter: Prisma.BookingWhereInput = query.search
    ? {
        OR: [
          { bookingId: { contains: query.search, mode: 'insensitive' } },
          { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
          { customer: { email: { contains: query.search, mode: 'insensitive' } } },
          { hotel: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }
    : {};

  const where: Prisma.BookingWhereInput = {
    hotel: { partnerId: partnerProfile.id },
    ...(query.status ? { bookingStatus: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.hotelId ? { hotelId: query.hotelId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.startDate ? { checkIn: { gte: parseDateOnly(query.startDate, 'startDate') } } : {}),
    ...(query.endDate ? { checkOut: { lte: parseDateOnly(query.endDate, 'endDate') } } : {}),
    ...searchFilter,
  };

  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      select: bookingDetailSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, pagination: getPagination(page, limit, total) };
}

/**
 * Find booking by ID for authenticated partner with ownership scoping.
 */
export async function findPartnerBookingById(userId: string, idOrReference: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });

  if (!partnerProfile || partnerProfile.status !== 'APPROVED') {
    throw new ApiError(403, 'An approved partner profile is required to view partner bookings');
  }

  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: idOrReference } : { bookingId: idOrReference },
    select: {
      ...bookingDetailSelect,
      hotel: {
        select: {
          ...bookingDetailSelect.hotel.select,
          partnerId: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.hotel.partnerId !== partnerProfile.id) {
    throw new ApiError(403, 'You do not have permission to view this booking');
  }

  const { hotel, ...rest } = booking;
  const { partnerId: _partnerId, ...safeHotel } = hotel;
  void _partnerId;

  return { ...rest, hotel: safeHotel };
}

/**
 * Update booking status by authenticated partner with validation and ownership scoping.
 */
export async function updatePartnerBookingStatus(
  userId: string,
  idOrReference: string,
  targetStatus: BookingStatus,
  reason?: string,
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });

  if (!partnerProfile || partnerProfile.status !== 'APPROVED') {
    throw new ApiError(403, 'An approved partner profile is required to manage partner bookings');
  }

  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: idOrReference } : { bookingId: idOrReference },
    select: {
      id: true,
      bookingStatus: true,
      couponId: true,
      hotel: { select: { partnerId: true } },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.hotel.partnerId !== partnerProfile.id) {
    throw new ApiError(403, 'You do not have permission to update this booking');
  }

  if (booking.bookingStatus === targetStatus) {
    return findPartnerBookingById(userId, booking.id);
  }

  const allowedTransitions = VALID_BOOKING_STATUS_TRANSITIONS[booking.bookingStatus] || [];
  if (!allowedTransitions.includes(targetStatus)) {
    throw new ApiError(
      400,
      `Cannot transition booking status from ${booking.bookingStatus} to ${targetStatus}`,
    );
  }

  const updateData: Prisma.BookingUpdateInput = {
    bookingStatus: targetStatus,
    ...(targetStatus === 'CANCELLED'
      ? {
          cancelledAt: new Date(),
          cancellationReason: reason?.trim() || 'Cancelled by partner',
        }
      : {}),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.booking.update({
      where: { id: booking.id },
      data: updateData,
      select: bookingDetailSelect,
    });

    if (targetStatus === 'CANCELLED' && booking.couponId) {
      await tx.coupon.update({
        where: { id: booking.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    if (targetStatus === 'CANCELLED') {
      await voidPendingPayoutsForBooking(booking.id, reason?.trim() || 'Cancelled by partner', tx);
    }

    return updatedRecord;
  });

  void safeNotify({
    userId: updated.customerId,
    title: targetStatus === 'CONFIRMED' ? 'Booking Confirmed' : targetStatus === 'CANCELLED' ? 'Booking Cancelled' : `Booking ${targetStatus}`,
    message: `Your booking #${updated.bookingId} status is now ${targetStatus}.`,
    type: 'BOOKING',
    dedupKey: `BOOKING_STATUS_${targetStatus}:${updated.id}`,
    actionUrl: `/(customer)/booking/${updated.id}`,
    data: { bookingId: updated.id, status: targetStatus },
  });

  return updated;
}

/**
 * List all bookings across hotels for system admin with filtering, search, and pagination.
 */
export async function listAdminBookings(query: BookingQuery) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 10, 50);

  const searchFilter: Prisma.BookingWhereInput = query.search
    ? {
        OR: [
          { bookingId: { contains: query.search, mode: 'insensitive' } },
          { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
          { customer: { email: { contains: query.search, mode: 'insensitive' } } },
          { hotel: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }
    : {};

  const where: Prisma.BookingWhereInput = {
    ...(query.status ? { bookingStatus: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.hotelId ? { hotelId: query.hotelId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.startDate ? { checkIn: { gte: parseDateOnly(query.startDate, 'startDate') } } : {}),
    ...(query.endDate ? { checkOut: { lte: parseDateOnly(query.endDate, 'endDate') } } : {}),
    ...searchFilter,
  };

  const prisma = getPrismaClient();
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      select: bookingDetailSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, pagination: getPagination(page, limit, total) };
}

/**
 * Find booking by ID for system admin.
 */
export async function findAdminBookingById(idOrReference: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const prisma = getPrismaClient();

  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: idOrReference } : { bookingId: idOrReference },
    select: bookingDetailSelect,
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  return booking;
}

/**
 * Update booking status by system admin with transition validation.
 */
export async function updateAdminBookingStatus(
  idOrReference: string,
  targetStatus: BookingStatus,
  reason?: string,
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
  const prisma = getPrismaClient();

  const booking = await prisma.booking.findFirst({
    where: isUuid ? { id: idOrReference } : { bookingId: idOrReference },
    select: { id: true, bookingStatus: true, couponId: true },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.bookingStatus === targetStatus) {
    return findAdminBookingById(booking.id);
  }

  const allowedTransitions = VALID_BOOKING_STATUS_TRANSITIONS[booking.bookingStatus] || [];
  if (!allowedTransitions.includes(targetStatus)) {
    throw new ApiError(
      400,
      `Cannot transition booking status from ${booking.bookingStatus} to ${targetStatus}`,
    );
  }

  const updateData: Prisma.BookingUpdateInput = {
    bookingStatus: targetStatus,
    ...(targetStatus === 'CANCELLED'
      ? {
          cancelledAt: new Date(),
          cancellationReason: reason?.trim() || 'Cancelled by admin',
        }
      : {}),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRecord = await tx.booking.update({
      where: { id: booking.id },
      data: updateData,
      select: bookingDetailSelect,
    });

    if (targetStatus === 'CANCELLED' && booking.couponId) {
      await tx.coupon.update({
        where: { id: booking.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    if (targetStatus === 'CANCELLED') {
      await voidPendingPayoutsForBooking(booking.id, reason?.trim() || 'Cancelled by admin', tx);
    }

    return updatedRecord;
  });

  if (targetStatus === 'CANCELLED') {
    void safeNotify({
      userId: updated.customerId,
      title: 'Booking Cancelled by Admin',
      message: `Your booking #${updated.bookingId} was cancelled by administration.`,
      type: 'BOOKING',
      dedupKey: `ADMIN_CANCELLED:${updated.id}`,
      actionUrl: `/(customer)/booking/${updated.id}`,
      data: { bookingId: updated.id },
    });
  }

  return updated;
}
