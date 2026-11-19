import type { CouponDiscountType, Prisma } from '@prisma/client';

export type BookingPricing = {
  numberOfNights: number;
  roomPrice: number;
  baseAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export type CouponPricingInput = {
  id?: string;
  code?: string;
  discountType: CouponDiscountType | 'FIXED_AMOUNT';
  discountValue: number | Prisma.Decimal;
  minimumBookingAmount?: number | Prisma.Decimal;
  maximumDiscount?: number | Prisma.Decimal | null;
};

/**
 * Calculates number of nights between check-in and check-out dates using UTC calendar days.
 */
export function calculateNumberOfNights(checkIn: Date, checkOut: Date): number {
  const checkInUtc = Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate());
  const checkOutUtc = Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate());
  const diffMs = checkOutUtc - checkInUtc;
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights;
}

/**
 * Calculates discount amount based on coupon configuration and booking base amount.
 * Rules:
 * - percentage must be > 0 and <= 100
 * - fixed amount must be > 0
 * - discount cannot make total negative (capped at baseAmount)
 * - maximum discount cap is applied if set on percentage coupons
 */
export function calculateCouponDiscount(
  coupon: CouponPricingInput,
  baseAmount: number,
): number {
  const minAmount = coupon.minimumBookingAmount ? Number(coupon.minimumBookingAmount) : 0;
  if (baseAmount < minAmount) {
    return 0;
  }

  const val = Number(coupon.discountValue);
  let rawDiscount: number;

  if (coupon.discountType === 'PERCENTAGE') {
    rawDiscount = Math.round((baseAmount * (val / 100)) * 100) / 100;
    if (coupon.maximumDiscount !== null && coupon.maximumDiscount !== undefined) {
      const maxDiscount = Number(coupon.maximumDiscount);
      if (maxDiscount > 0 && rawDiscount > maxDiscount) {
        rawDiscount = maxDiscount;
      }
    }
  } else {
    // FIXED or FIXED_AMOUNT
    rawDiscount = Math.round(val * 100) / 100;
  }

  const discountAmount = Math.max(0, Math.min(rawDiscount, baseAmount));
  return Math.round(discountAmount * 100) / 100;
}

/**
 * Calculates price snapshot for booking:
 * base amount = roomPricePerNight * numberOfNights * roomsCount
 * tax = base * (BOOKING_TAX_RATE_PERCENT / 100), default 0%
 * discount = calculated from validated coupon (Phase 11)
 * total = base + tax - discount (guaranteed >= 0)
 */
export function calculateBookingPricing(
  roomPricePerNight: number | Prisma.Decimal | string,
  numberOfNights: number,
  roomsCount: number,
  coupon?: CouponPricingInput | null,
): BookingPricing {
  const price = typeof roomPricePerNight === 'object' && roomPricePerNight !== null
    ? Number(roomPricePerNight)
    : Number(roomPricePerNight);

  const baseAmount = Math.round(price * numberOfNights * roomsCount * 100) / 100;

  const taxRateEnv = process.env.BOOKING_TAX_RATE_PERCENT?.trim();
  const taxRate = taxRateEnv ? Number(taxRateEnv) : 0;
  const validTaxRate = Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0;
  const taxAmount = Math.round(baseAmount * (validTaxRate / 100) * 100) / 100;

  const discountAmount = coupon ? calculateCouponDiscount(coupon, baseAmount) : 0;
  const totalAmount = Math.max(0, Math.round((baseAmount + taxAmount - discountAmount) * 100) / 100);

  return {
    numberOfNights,
    roomPrice: price,
    baseAmount,
    taxAmount,
    discountAmount,
    totalAmount,
  };
}
