import { type CouponDiscountType, type Prisma } from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { calculateCouponDiscount } from './pricing.service.js';

export type CreateCouponInput = {
  code: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumBookingAmount?: number;
  maximumDiscount?: number | null;
  validFrom: Date | string;
  validUntil: Date | string;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  isActive?: boolean;
};

export type UpdateCouponInput = Partial<CreateCouponInput>;

export type AdminCouponQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  discountType?: CouponDiscountType;
};

export const couponSelect = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  minimumBookingAmount: true,
  maximumDiscount: true,
  validFrom: true,
  validUntil: true,
  usageLimit: true,
  usedCount: true,
  perUserLimit: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CouponSelect;

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseDateInput(value: Date | string, fieldName: string): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid date`);
  }
  return d;
}

/**
 * Validates a coupon for customer checkout and computes current discount.
 * Never trusts client discount amount.
 */
export async function validateCouponForCustomer(
  customerId: string,
  rawCode: string,
  bookingAmount?: number,
) {
  const prisma = getPrismaClient();
  const normalized = normalizeCouponCode(rawCode);

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalized },
    select: couponSelect,
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
    const userUsageCount = await prisma.booking.count({
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

  const baseAmount = bookingAmount !== undefined && bookingAmount > 0 ? bookingAmount : 0;
  const minBookingAmount = Number(coupon.minimumBookingAmount);

  if (baseAmount > 0 && baseAmount < minBookingAmount) {
    throw new ApiError(
      400,
      `Minimum booking amount of $${minBookingAmount.toFixed(2)} required for coupon ${coupon.code}`,
    );
  }

  const discountAmount = baseAmount > 0 ? calculateCouponDiscount(coupon, baseAmount) : 0;

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minimumBookingAmount: minBookingAmount,
      maximumDiscount: coupon.maximumDiscount !== null ? Number(coupon.maximumDiscount) : null,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      discountAmount,
    },
  };
}

/**
 * Lists active and valid offers for customers.
 */
export async function listActiveOffers() {
  const prisma = getPrismaClient();
  const now = new Date();

  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minimumBookingAmount: true,
      maximumDiscount: true,
      validFrom: true,
      validUntil: true,
      usageLimit: true,
      usedCount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter out any coupon whose usage limit has already been exhausted
  return coupons
    .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
    .map((c) => ({
      id: c.id,
      code: c.code,
      title: c.code,
      description: c.description || `${c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `$${c.discountValue}`} off on your stay`,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minimumBookingAmount: Number(c.minimumBookingAmount),
      maximumDiscount: c.maximumDiscount ? Number(c.maximumDiscount) : null,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
    }));
}

/**
 * Lists all coupons for system administrator with search, filter, and pagination.
 */
export async function listAdminCoupons(query: AdminCouponQuery) {
  const prisma = getPrismaClient();
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 10, 50);

  const searchFilter: Prisma.CouponWhereInput = query.search
    ? {
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const where: Prisma.CouponWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.discountType ? { discountType: query.discountType } : {}),
    ...searchFilter,
  };

  const [items, total] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      select: couponSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a coupon by ID or code for administrator.
 */
export async function getAdminCouponById(idOrCode: string) {
  const prisma = getPrismaClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

  const coupon = await prisma.coupon.findFirst({
    where: isUuid ? { id: idOrCode } : { code: normalizeCouponCode(idOrCode) },
    select: {
      ...couponSelect,
      _count: { select: { bookings: true } },
    },
  });

  if (!coupon) {
    throw new ApiError(404, 'Coupon not found');
  }

  return coupon;
}

/**
 * Validates coupon discount rules and constraints.
 */
function validateCouponRules(
  discountType: CouponDiscountType,
  discountValue: number,
  validFrom: Date,
  validUntil: Date,
  usageLimit?: number | null,
  perUserLimit?: number | null,
  minimumBookingAmount?: number,
  maximumDiscount?: number | null,
) {
  if (discountType === 'PERCENTAGE') {
    if (discountValue <= 0 || discountValue > 100) {
      throw new ApiError(400, 'Percentage discount must be greater than 0 and less than or equal to 100');
    }
  } else {
    // FIXED or FIXED_AMOUNT
    if (discountValue <= 0) {
      throw new ApiError(400, 'Fixed discount amount must be greater than 0');
    }
  }

  if (validUntil <= validFrom) {
    throw new ApiError(400, 'validUntil must be after validFrom');
  }

  if (usageLimit !== undefined && usageLimit !== null && usageLimit <= 0) {
    throw new ApiError(400, 'usageLimit must be a positive integer');
  }

  if (perUserLimit !== undefined && perUserLimit !== null && perUserLimit <= 0) {
    throw new ApiError(400, 'perUserLimit must be a positive integer');
  }

  if (minimumBookingAmount !== undefined && minimumBookingAmount < 0) {
    throw new ApiError(400, 'minimumBookingAmount cannot be negative');
  }

  if (maximumDiscount !== undefined && maximumDiscount !== null && maximumDiscount < 0) {
    throw new ApiError(400, 'maximumDiscount cannot be negative');
  }
}

/**
 * Creates a coupon by administrator.
 */
export async function createAdminCoupon(input: CreateCouponInput) {
  const prisma = getPrismaClient();
  const normalizedCode = normalizeCouponCode(input.code);

  const existing = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(400, 'A coupon with this code already exists');
  }

  const validFrom = parseDateInput(input.validFrom, 'validFrom');
  const validUntil = parseDateInput(input.validUntil, 'validUntil');

  validateCouponRules(
    input.discountType,
    Number(input.discountValue),
    validFrom,
    validUntil,
    input.usageLimit,
    input.perUserLimit,
    input.minimumBookingAmount,
    input.maximumDiscount,
  );

  const coupon = await prisma.coupon.create({
    data: {
      code: normalizedCode,
      description: input.description?.trim() || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumBookingAmount: input.minimumBookingAmount ?? 0,
      maximumDiscount: input.maximumDiscount ?? null,
      validFrom,
      validUntil,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      isActive: input.isActive ?? true,
    },
    select: couponSelect,
  });

  return coupon;
}

/**
 * Updates a coupon by administrator.
 */
export async function updateAdminCoupon(id: string, input: UpdateCouponInput) {
  const prisma = getPrismaClient();
  const existing = await prisma.coupon.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError(404, 'Coupon not found');
  }

  let normalizedCode = existing.code;
  if (input.code && normalizeCouponCode(input.code) !== existing.code) {
    normalizedCode = normalizeCouponCode(input.code);
    const codeTaken = await prisma.coupon.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    });
    if (codeTaken) {
      throw new ApiError(400, 'A coupon with this code already exists');
    }
  }

  const discountType = input.discountType ?? existing.discountType;
  const discountValue = input.discountValue !== undefined ? Number(input.discountValue) : Number(existing.discountValue);
  const validFrom = input.validFrom !== undefined ? parseDateInput(input.validFrom, 'validFrom') : existing.validFrom;
  const validUntil = input.validUntil !== undefined ? parseDateInput(input.validUntil, 'validUntil') : existing.validUntil;
  const usageLimit = input.usageLimit !== undefined ? input.usageLimit : existing.usageLimit;
  const perUserLimit = input.perUserLimit !== undefined ? input.perUserLimit : existing.perUserLimit;
  const minimumBookingAmount = input.minimumBookingAmount !== undefined ? input.minimumBookingAmount : Number(existing.minimumBookingAmount);
  const maximumDiscount = input.maximumDiscount !== undefined ? input.maximumDiscount : (existing.maximumDiscount ? Number(existing.maximumDiscount) : null);

  validateCouponRules(
    discountType,
    discountValue,
    validFrom,
    validUntil,
    usageLimit,
    perUserLimit,
    minimumBookingAmount,
    maximumDiscount,
  );

  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      code: normalizedCode,
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
      ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
      ...(input.minimumBookingAmount !== undefined ? { minimumBookingAmount: input.minimumBookingAmount } : {}),
      ...(input.maximumDiscount !== undefined ? { maximumDiscount: input.maximumDiscount } : {}),
      ...(input.validFrom !== undefined ? { validFrom } : {}),
      ...(input.validUntil !== undefined ? { validUntil } : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
      ...(input.perUserLimit !== undefined ? { perUserLimit: input.perUserLimit } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: couponSelect,
  });

  return updated;
}

/**
 * Deletes a coupon if unused, or rejects deletion if attached to existing bookings.
 */
export async function deleteAdminCoupon(id: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { bookings: true } },
    },
  });

  if (!existing) {
    throw new ApiError(404, 'Coupon not found');
  }

  if (existing._count.bookings > 0) {
    throw new ApiError(
      400,
      'Cannot delete coupon that has been used in bookings. Deactivate it instead.',
    );
  }

  await prisma.coupon.delete({ where: { id } });

  return { success: true, message: 'Coupon deleted successfully' };
}
