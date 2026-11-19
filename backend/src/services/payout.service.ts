import {
  type PayoutStatus,
  Prisma,
} from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { safeNotify } from './notification.service.js';

export type PayoutAmounts = {
  amount: number;
  commissionAmount: number;
  netAmount: number;
};

/**
 * Calculates platform commission and net payable amounts safely to 2 decimal places.
 */
export function calculatePayoutAmounts(grossAmount: number, commissionRate: number): PayoutAmounts {
  const gross = Math.round(Number(grossAmount) * 100) / 100;
  const rate = Number(commissionRate);
  const commission = Math.round(gross * (rate / 100) * 100) / 100;
  const net = Math.round((gross - commission) * 100) / 100;

  return {
    amount: Number(gross.toFixed(2)),
    commissionAmount: Number(commission.toFixed(2)),
    netAmount: Number(net.toFixed(2)),
  };
}

export type PartnerEarningsSummary = {
  partner: {
    id: string;
    businessName: string;
    commissionRate: number;
    status: string;
  };
  metrics: {
    availableBalance: number;
    pendingBalance: number;
    processingBalance: number;
    paidBalance: number;
    lifetimeGross: number;
    lifetimeCommission: number;
    lifetimeNet: number;
    eligibleBookingsCount: number;
  };
  payAtHotel: {
    totalBookings: number;
    totalCollectedByHotel: number;
    platformCommissionReceivable: number;
    notice: string;
  };
};

export type PartnerEarningsHistoryQuery = {
  status?: 'AVAILABLE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED' | 'PAY_AT_HOTEL' | 'ALL';
  hotelId?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export type PartnerPayoutsQuery = {
  status?: PayoutStatus | 'ALL';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export type AdminPayoutsQuery = {
  status?: PayoutStatus | 'ALL';
  partnerId?: string;
  hotelId?: string;
  batchReference?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export type RequestPayoutInput = {
  bookingIds?: string[];
  notes?: string | null;
};

export type UpdatePayoutStatusInput = {
  action: 'APPROVE' | 'REJECT' | 'MARK_PAID';
  transactionReference?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
};

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

/**
 * Retrieves the comprehensive earnings summary for a partner.
 */
export async function getPartnerEarningsSummary(partnerUserId: string): Promise<PartnerEarningsSummary> {
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
    select: {
      id: true,
      businessName: true,
      commissionRate: true,
      status: true,
      hotels: {
        select: { id: true },
      },
    },
  });

  if (!partnerProfile) {
    throw new ApiError(403, 'Partner profile not found');
  }

  const commissionRate = Number(partnerProfile.commissionRate);
  const hotelIds = partnerProfile.hotels.map((h) => h.id);

  if (hotelIds.length === 0) {
    return {
      partner: {
        id: partnerProfile.id,
        businessName: partnerProfile.businessName,
        commissionRate,
        status: partnerProfile.status,
      },
      metrics: {
        availableBalance: 0,
        pendingBalance: 0,
        processingBalance: 0,
        paidBalance: 0,
        lifetimeGross: 0,
        lifetimeCommission: 0,
        lifetimeNet: 0,
        eligibleBookingsCount: 0,
      },
      payAtHotel: {
        totalBookings: 0,
        totalCollectedByHotel: 0,
        platformCommissionReceivable: 0,
        notice: 'Pay at Hotel revenue is collected directly by your property and is not disbursed via platform payouts.',
      },
    };
  }

  const now = new Date();

  // 1. Fetch all completed/concluded bookings for this partner's hotels
  const allStays = await prisma.booking.findMany({
    where: {
      hotelId: { in: hotelIds },
      bookingStatus: { not: 'CANCELLED' },
      paymentStatus: { not: 'REFUNDED' },
      OR: [
        { bookingStatus: 'COMPLETED' },
        { bookingStatus: 'CONFIRMED', checkOut: { lte: now } },
      ],
    },
    include: {
      payment: {
        select: {
          status: true,
          paymentMethod: true,
        },
      },
      payouts: {
        select: {
          id: true,
          status: true,
          netAmount: true,
        },
      },
    },
  });

  let lifetimeGross = 0;
  let lifetimeCommission = 0;
  let lifetimeNet = 0;
  let availableBalance = 0;
  let eligibleBookingsCount = 0;

  let payAtHotelCount = 0;
  let payAtHotelGross = 0;

  for (const booking of allStays) {
    const isPayAtHotel = booking.payment?.paymentMethod === 'PAY_AT_HOTEL';
    const isOnlinePaid = booking.paymentStatus === 'PAID' && booking.payment?.status === 'SUCCESS' && !isPayAtHotel;

    if (isPayAtHotel) {
      payAtHotelCount++;
      payAtHotelGross += Number(booking.totalAmount);
      continue;
    }

    if (isOnlinePaid) {
      const { amount, commissionAmount, netAmount } = calculatePayoutAmounts(
        Number(booking.totalAmount),
        commissionRate,
      );

      lifetimeGross += amount;
      lifetimeCommission += commissionAmount;
      lifetimeNet += netAmount;

      const hasActivePayout = booking.payouts.some((po) =>
        ['PENDING', 'PROCESSING', 'PAID'].includes(po.status),
      );

      if (!hasActivePayout) {
        availableBalance += netAmount;
        eligibleBookingsCount++;
      }
    }
  }

  // 2. Aggregate payout balances by status
  const payoutAggregates = await prisma.payout.groupBy({
    by: ['status'],
    where: {
      partnerId: partnerProfile.id,
    },
    _sum: {
      netAmount: true,
    },
  });

  let pendingBalance = 0;
  let processingBalance = 0;
  let paidBalance = 0;

  for (const agg of payoutAggregates) {
    const sum = Number(agg._sum.netAmount || 0);
    if (agg.status === 'PENDING') pendingBalance = sum;
    else if (agg.status === 'PROCESSING') processingBalance = sum;
    else if (agg.status === 'PAID') paidBalance = sum;
  }

  const platformCommissionReceivable = Math.round(payAtHotelGross * (commissionRate / 100) * 100) / 100;

  return {
    partner: {
      id: partnerProfile.id,
      businessName: partnerProfile.businessName,
      commissionRate,
      status: partnerProfile.status,
    },
    metrics: {
      availableBalance: Number(availableBalance.toFixed(2)),
      pendingBalance: Number(pendingBalance.toFixed(2)),
      processingBalance: Number(processingBalance.toFixed(2)),
      paidBalance: Number(paidBalance.toFixed(2)),
      lifetimeGross: Number(lifetimeGross.toFixed(2)),
      lifetimeCommission: Number(lifetimeCommission.toFixed(2)),
      lifetimeNet: Number(lifetimeNet.toFixed(2)),
      eligibleBookingsCount,
    },
    payAtHotel: {
      totalBookings: payAtHotelCount,
      totalCollectedByHotel: Number(payAtHotelGross.toFixed(2)),
      platformCommissionReceivable: Number(platformCommissionReceivable.toFixed(2)),
      notice: 'Pay at Hotel revenue is collected directly by your property and is not disbursed via platform payouts.',
    },
  };
}

/**
 * Retrieves booking-level earnings history for the authenticated partner.
 */
export async function getPartnerEarningsHistory(
  partnerUserId: string,
  query: PartnerEarningsHistoryQuery,
) {
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
    select: {
      id: true,
      commissionRate: true,
      hotels: { select: { id: true } },
    },
  });

  if (!partnerProfile) {
    throw new ApiError(403, 'Partner profile not found');
  }

  const commissionRate = Number(partnerProfile.commissionRate);
  const partnerHotelIds = partnerProfile.hotels.map((h) => h.id);

  if (query.hotelId && !partnerHotelIds.includes(query.hotelId)) {
    throw new ApiError(403, 'You do not have access to this hotel');
  }

  const targetHotelIds = query.hotelId ? [query.hotelId] : partnerHotelIds;

  if (targetHotelIds.length === 0) {
    return {
      items: [],
      pagination: { page: 1, limit: query.limit || 10, total: 0, totalPages: 1 },
    };
  }

  const dateFilter: Prisma.BookingWhereInput = {};
  if (query.startDate) {
    dateFilter.checkIn = { gte: parseDateOnly(query.startDate, 'startDate') };
  }
  if (query.endDate) {
    dateFilter.checkOut = { lte: parseDateOnly(query.endDate, 'endDate') };
  }

  const now = new Date();

  // Find all stays for target hotels
  const allBookings = await prisma.booking.findMany({
    where: {
      hotelId: { in: targetHotelIds },
      ...dateFilter,
    },
    include: {
      hotel: { select: { id: true, name: true, city: true } },
      customer: { select: { id: true, fullName: true, email: true } },
      payment: { select: { id: true, paymentMethod: true, status: true, paidAt: true } },
      payouts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          batchReference: true,
          status: true,
          amount: true,
          commissionAmount: true,
          netAmount: true,
          transactionReference: true,
          rejectionReason: true,
          processedAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Map each booking to earnings history entry and compute status
  const mapped = allBookings.map((b) => {
    const isPayAtHotel = b.payment?.paymentMethod === 'PAY_AT_HOTEL';
    const isCancelled = b.bookingStatus === 'CANCELLED';
    const isRefunded = b.paymentStatus === 'REFUNDED';
    const isCompleted = b.bookingStatus === 'COMPLETED';
    const isStayConcluded = isCompleted || (b.bookingStatus === 'CONFIRMED' && new Date(b.checkOut) <= now);
    const isPaidOnline = b.paymentStatus === 'PAID' && b.payment?.status === 'SUCCESS';

    const latestPayout = b.payouts[0] || null;

    let computedStatus: 'AVAILABLE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REJECTED' | 'PAY_AT_HOTEL' | 'NOT_ELIGIBLE';

    if (isPayAtHotel) {
      computedStatus = 'PAY_AT_HOTEL';
    } else if (latestPayout) {
      computedStatus = latestPayout.status;
    } else if (!isCancelled && !isRefunded && isStayConcluded && isPaidOnline) {
      computedStatus = 'AVAILABLE';
    } else {
      computedStatus = 'NOT_ELIGIBLE';
    }

    const { amount, commissionAmount, netAmount } = latestPayout
      ? {
          amount: Number(latestPayout.amount),
          commissionAmount: Number(latestPayout.commissionAmount),
          netAmount: Number(latestPayout.netAmount),
        }
      : calculatePayoutAmounts(Number(b.totalAmount), commissionRate);

    return {
      id: b.id,
      bookingId: b.bookingId,
      hotel: b.hotel,
      customer: {
        fullName: b.customer.fullName,
      },
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      bookingStatus: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      paymentMethod: b.payment?.paymentMethod || 'UNKNOWN',
      amounts: {
        grossAmount: amount,
        commissionRate,
        commissionAmount,
        netAmount,
      },
      payoutStatus: computedStatus,
      payout: latestPayout,
      createdAt: b.createdAt,
    };
  });

  // Apply status filter if provided
  const filtered = query.status && query.status !== 'ALL'
    ? mapped.filter((item) => item.payoutStatus === query.status)
    : mapped;

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return {
    items: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Retrieves paginated list of payout records for the partner.
 */
export async function getPartnerPayouts(
  partnerUserId: string,
  query: PartnerPayoutsQuery,
) {
  const prisma = getPrismaClient();

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUserId },
    select: { id: true },
  });

  if (!partnerProfile) {
    throw new ApiError(403, 'Partner profile not found');
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.PayoutWhereInput = {
    partnerId: partnerProfile.id,
    ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
  };

  if (query.startDate || query.endDate) {
    whereCondition.createdAt = {};
    if (query.startDate) whereCondition.createdAt.gte = parseDateOnly(query.startDate, 'startDate');
    if (query.endDate) whereCondition.createdAt.lte = parseDateOnly(query.endDate, 'endDate');
  }

  const [items, total] = await Promise.all([
    prisma.payout.findMany({
      where: whereCondition,
      include: {
        booking: {
          select: {
            id: true,
            bookingId: true,
            checkIn: true,
            checkOut: true,
            hotel: { select: { id: true, name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payout.count({ where: whereCondition }),
  ]);

  return {
    items: items.map((po) => ({
      id: po.id,
      batchReference: po.batchReference,
      bookingId: po.bookingId,
      bookingRef: po.booking.bookingId,
      hotelName: po.booking.hotel.name,
      checkIn: po.booking.checkIn,
      checkOut: po.booking.checkOut,
      amount: Number(po.amount),
      commissionAmount: Number(po.commissionAmount),
      netAmount: Number(po.netAmount),
      status: po.status,
      transactionReference: po.transactionReference,
      rejectionReason: po.rejectionReason,
      notes: po.notes,
      processedAt: po.processedAt,
      createdAt: po.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Requests payout for eligible completed bookings with transactional concurrency protection.
 * Prevents double-counting and concurrent overdrafts via row-level locking.
 */
export async function requestPartnerPayout(
  partnerUserId: string,
  input: RequestPayoutInput = {},
) {
  const prisma = getPrismaClient();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Lock the partner profile row using SELECT FOR UPDATE to prevent concurrent requests
    const lockedPartner = await tx.$queryRaw<Array<{ id: string; commissionRate: Prisma.Decimal; status: string }>>`
      SELECT id, "commissionRate", status FROM "PartnerProfile" WHERE "userId" = ${partnerUserId}::uuid FOR UPDATE
    `;

    if (!lockedPartner || lockedPartner.length === 0) {
      throw new ApiError(404, 'Partner profile not found');
    }

    const partner = lockedPartner[0];
    if (partner.status !== 'APPROVED') {
      throw new ApiError(403, 'Partner profile must be approved to request payouts');
    }

    const commissionRate = Number(partner.commissionRate);

    // 2. Fetch all partner hotel IDs
    const partnerHotels = await tx.hotel.findMany({
      where: { partnerId: partner.id },
      select: { id: true },
    });
    const hotelIds = partnerHotels.map((h) => h.id);

    if (hotelIds.length === 0) {
      throw new ApiError(400, 'No hotels found for this partner');
    }

    const now = new Date();

    // 3. Find eligible bookings:
    // - Hotel belongs to partner
    // - Stay concluded
    // - Online payment SUCCESS (excludes PAY_AT_HOTEL)
    // - Non-cancelled & non-refunded
    // - No existing payout in PENDING, PROCESSING, or PAID
    const eligibleWhere: Prisma.BookingWhereInput = {
      hotelId: { in: hotelIds },
      paymentStatus: 'PAID',
      bookingStatus: { not: 'CANCELLED' },
      payment: {
        status: 'SUCCESS',
        paymentMethod: { not: 'PAY_AT_HOTEL' },
      },
      OR: [
        { bookingStatus: 'COMPLETED' },
        { bookingStatus: 'CONFIRMED', checkOut: { lte: now } },
      ],
      payouts: {
        none: {
          status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
        },
      },
    };

    // If specific booking IDs were requested, validate that every requested ID is eligible
    if (input.bookingIds && input.bookingIds.length > 0) {
      eligibleWhere.id = { in: input.bookingIds };
    }

    const eligibleBookings = await tx.booking.findMany({
      where: eligibleWhere,
      select: {
        id: true,
        bookingId: true,
        totalAmount: true,
        hotel: { select: { id: true, name: true } },
      },
    });

    if (input.bookingIds && input.bookingIds.length > 0) {
      if (eligibleBookings.length !== input.bookingIds.length) {
        const foundIds = new Set(eligibleBookings.map((b) => b.id));
        const missingIds = input.bookingIds.filter((id) => !foundIds.has(id));
        throw new ApiError(
          400,
          `Some requested bookings are not eligible for payout or are already in progress: ${missingIds.join(', ')}`,
        );
      }
    }

    if (eligibleBookings.length === 0) {
      throw new ApiError(400, 'No eligible completed bookings available for payout');
    }

    // 4. Generate batch reference for multi-booking grouping
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const batchReference = `PO-BATCH-${dateStr}-${randomSuffix}`;

    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;
    const createdPayouts = [];

    // 5. Create immutable payout snapshot per booking
    for (const booking of eligibleBookings) {
      const amounts = calculatePayoutAmounts(Number(booking.totalAmount), commissionRate);

      const created = await tx.payout.create({
        data: {
          partnerId: partner.id,
          bookingId: booking.id,
          batchReference,
          amount: amounts.amount,
          commissionAmount: amounts.commissionAmount,
          netAmount: amounts.netAmount,
          status: 'PENDING',
          notes: input.notes?.trim() || null,
        },
      });

      totalGross += amounts.amount;
      totalCommission += amounts.commissionAmount;
      totalNet += amounts.netAmount;
      createdPayouts.push(created);
    }

    return {
      batchReference,
      totalGross: Number(totalGross.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      totalNet: Number(totalNet.toFixed(2)),
      payoutsCount: createdPayouts.length,
      payouts: createdPayouts.map((po) => ({
        id: po.id,
        bookingId: po.bookingId,
        amount: Number(po.amount),
        commissionAmount: Number(po.commissionAmount),
        netAmount: Number(po.netAmount),
        status: po.status,
      })),
    };
  });

  void safeNotify({
    userId: partnerUserId,
    title: 'Payout Request Submitted',
    message: `Your payout batch ${result.batchReference} for $${result.totalNet} has been submitted for review.`,
    type: 'SYSTEM',
    dedupKey: `PAYOUT_REQUESTED:${result.batchReference}`,
    actionUrl: `/(partner)/payouts`,
    data: { batchReference: result.batchReference, totalNet: result.totalNet },
  });

  return result;
}

/**
 * Retrieves all payouts across partners for admin management.
 */
export async function getAdminPayouts(query: AdminPayoutsQuery) {
  const prisma = getPrismaClient();

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.PayoutWhereInput = {
    ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
    ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    ...(query.batchReference ? { batchReference: query.batchReference } : {}),
    ...(query.hotelId ? { booking: { hotelId: query.hotelId } } : {}),
  };

  if (query.startDate || query.endDate) {
    whereCondition.createdAt = {};
    if (query.startDate) whereCondition.createdAt.gte = parseDateOnly(query.startDate, 'startDate');
    if (query.endDate) whereCondition.createdAt.lte = parseDateOnly(query.endDate, 'endDate');
  }

  const [items, total] = await Promise.all([
    prisma.payout.findMany({
      where: whereCondition,
      include: {
        partner: {
          select: {
            id: true,
            businessName: true,
            businessEmail: true,
            commissionRate: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        booking: {
          select: {
            id: true,
            bookingId: true,
            checkIn: true,
            checkOut: true,
            hotel: { select: { id: true, name: true, city: true } },
            customer: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payout.count({ where: whereCondition }),
  ]);

  return {
    items: items.map((po) => ({
      id: po.id,
      batchReference: po.batchReference,
      partner: {
        id: po.partner.id,
        businessName: po.partner.businessName,
        contactEmail: po.partner.businessEmail || po.partner.user.email,
        commissionRate: Number(po.partner.commissionRate),
      },
      booking: {
        id: po.booking.id,
        bookingId: po.booking.bookingId,
        hotelName: po.booking.hotel.name,
        city: po.booking.hotel.city,
        checkIn: po.booking.checkIn,
        checkOut: po.booking.checkOut,
        customerName: po.booking.customer.fullName,
      },
      amount: Number(po.amount),
      commissionAmount: Number(po.commissionAmount),
      netAmount: Number(po.netAmount),
      status: po.status,
      transactionReference: po.transactionReference,
      rejectionReason: po.rejectionReason,
      notes: po.notes,
      processedBy: po.processedBy,
      processedAt: po.processedAt,
      createdAt: po.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Retrieves a single payout record with complete details for admin view.
 */
export async function getAdminPayoutById(payoutId: string) {
  const prisma = getPrismaClient();

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      partner: {
        select: {
          id: true,
          businessName: true,
          businessEmail: true,
          businessPhone: true,
          commissionRate: true,
          status: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      },
      booking: {
        select: {
          id: true,
          bookingId: true,
          checkIn: true,
          checkOut: true,
          numberOfNights: true,
          roomsCount: true,
          totalAmount: true,
          bookingStatus: true,
          paymentStatus: true,
          hotel: { select: { id: true, name: true, city: true, address: true } },
          customer: { select: { id: true, fullName: true, email: true } },
          payment: { select: { id: true, paymentMethod: true, status: true, paidAt: true, transactionId: true } },
        },
      },
    },
  });

  if (!payout) {
    throw new ApiError(404, 'Payout record not found');
  }

  return {
    id: payout.id,
    batchReference: payout.batchReference,
    amount: Number(payout.amount),
    commissionAmount: Number(payout.commissionAmount),
    netAmount: Number(payout.netAmount),
    status: payout.status,
    transactionReference: payout.transactionReference,
    rejectionReason: payout.rejectionReason,
    notes: payout.notes,
    processedBy: payout.processedBy,
    processedAt: payout.processedAt,
    createdAt: payout.createdAt,
    partner: {
      id: payout.partner.id,
      businessName: payout.partner.businessName,
      contactEmail: payout.partner.businessEmail || payout.partner.user.email,
      phone: payout.partner.businessPhone,
      commissionRate: Number(payout.partner.commissionRate),
    },
    booking: payout.booking,
  };
}

/**
 * Updates payout status by administrator with strict audit enforcement.
 * Enforces valid lifecycle transitions and financial immutability for PAID records.
 */
export async function updateAdminPayoutStatus(
  adminUserId: string,
  payoutId: string,
  input: UpdatePayoutStatusInput,
) {
  const prisma = getPrismaClient();

  const updated = await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new ApiError(404, 'Payout record not found');
    }

    // Completed payouts cannot be altered
    if (payout.status === 'PAID') {
      throw new ApiError(400, 'Completed payout cannot be modified or altered');
    }

    if (input.action === 'APPROVE') {
      if (payout.status !== 'PENDING') {
        throw new ApiError(400, `Cannot approve a payout with status ${payout.status}`);
      }

      return await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'PROCESSING',
          processedBy: adminUserId,
          notes: input.notes?.trim() || payout.notes,
        },
      });
    }

    if (input.action === 'REJECT') {
      if (!['PENDING', 'PROCESSING'].includes(payout.status)) {
        throw new ApiError(400, `Cannot reject a payout with status ${payout.status}`);
      }

      const reason = input.rejectionReason?.trim();
      if (!reason || reason.length < 3) {
        throw new ApiError(400, 'A valid rejection reason (minimum 3 characters) is required');
      }

      return await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          processedBy: adminUserId,
          notes: input.notes?.trim() || payout.notes,
        },
      });
    }

    if (input.action === 'MARK_PAID') {
      if (!['PENDING', 'PROCESSING'].includes(payout.status)) {
        throw new ApiError(400, `Cannot mark payout as paid from status ${payout.status}`);
      }

      const txRef = input.transactionReference?.trim();
      if (!txRef || txRef.length < 3) {
        throw new ApiError(400, 'A valid transaction reference (minimum 3 characters) is required');
      }

      // Check transactionReference uniqueness
      const existingTx = await tx.payout.findFirst({
        where: {
          transactionReference: txRef,
          id: { not: payoutId },
        },
      });

      if (existingTx) {
        throw new ApiError(409, 'Transaction reference is already used by another payout');
      }

      return await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'PAID',
          transactionReference: txRef,
          processedAt: new Date(),
          processedBy: adminUserId,
          notes: input.notes?.trim() || payout.notes,
        },
      });
    }

    throw new ApiError(400, `Unknown action: ${input.action}`);
  });

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { id: updated.partnerId },
    select: { userId: true },
  });

  if (partnerProfile) {
    let title = 'Payout Status Updated';
    let message = `Your payout batch ${updated.batchReference} status is now ${updated.status}.`;
    if (updated.status === 'PROCESSING') {
      title = 'Payout Approved';
      message = `Your payout batch ${updated.batchReference} has been approved and is now processing.`;
    } else if (updated.status === 'PAID') {
      title = 'Payout Transferred';
      message = `Your payout batch ${updated.batchReference} of $${updated.netAmount} was marked as paid. Ref: ${updated.transactionReference}.`;
    } else if (updated.status === 'REJECTED') {
      title = 'Payout Rejected';
      message = `Your payout batch ${updated.batchReference} was rejected. Reason: ${updated.rejectionReason}.`;
    }

    void safeNotify({
      userId: partnerProfile.userId,
      title,
      message,
      type: 'SYSTEM',
      dedupKey: `PAYOUT_STATUS_${updated.status}:${updated.id}`,
      actionUrl: `/(partner)/payouts`,
      data: { payoutId: updated.id, status: updated.status },
    });
  }

  return updated;
}

/**
 * Updates a partner's commission rate with admin authorization.
 * Future earnings/payouts will use the new rate; historical payouts are preserved.
 */
export async function updatePartnerCommissionRate(
  _adminUserId: string,
  partnerId: string,
  commissionRate: number,
) {
  const prisma = getPrismaClient();

  if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
    throw new ApiError(400, 'commissionRate must be a number between 0 and 100');
  }

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
  });

  if (!partnerProfile) {
    throw new ApiError(404, 'Partner profile not found');
  }

  const updated = await prisma.partnerProfile.update({
    where: { id: partnerId },
    data: {
      commissionRate: new Prisma.Decimal(commissionRate.toFixed(2)),
    },
    select: {
      id: true,
      businessName: true,
      commissionRate: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    businessName: updated.businessName,
    commissionRate: Number(updated.commissionRate),
    updatedAt: updated.updatedAt,
  };
}

/**
 * Automatically cancels or voids pending/processing payouts for a cancelled or refunded booking.
 * PAID payouts are strictly immutable and left intact for financial audit trail.
 */
export async function voidPendingPayoutsForBooking(
  bookingId: string,
  reason: string,
  tx?: Prisma.TransactionClient,
) {
  const client = tx || getPrismaClient();

  const activePayouts = await client.payout.findMany({
    where: {
      bookingId,
      status: { in: ['PENDING', 'PROCESSING'] },
    },
  });

  for (const po of activePayouts) {
    await client.payout.update({
      where: { id: po.id },
      data: {
        status: 'FAILED',
        rejectionReason: reason,
        notes: po.notes ? `${po.notes}; Automatically cancelled: ${reason}` : `Automatically cancelled: ${reason}`,
      },
    });
  }
}
