export type CouponDiscountType = 'PERCENTAGE' | 'FIXED' | 'FIXED_AMOUNT';

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumBookingAmount: number;
  maximumDiscount?: number | null;
  validFrom: string;
  validUntil: string;
  usageLimit?: number | null;
  usedCount?: number;
  perUserLimit?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidatedCouponResult {
  valid: boolean;
  coupon: {
    id: string;
    code: string;
    description?: string | null;
    discountType: CouponDiscountType;
    discountValue: number;
    minimumBookingAmount: number;
    maximumDiscount?: number | null;
    validFrom: string;
    validUntil: string;
    discountAmount: number;
  };
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumBookingAmount: number;
  maximumDiscount?: number | null;
  validFrom: string;
  validUntil: string;
}

export interface AdminCouponQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  discountType?: CouponDiscountType;
}

export interface AdminCouponListResponse {
  items: Coupon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
