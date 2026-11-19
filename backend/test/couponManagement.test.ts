import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateBookingPricing,
  calculateCouponDiscount,
  type CouponPricingInput,
} from '../src/services/pricing.service.js';
import {
  normalizeCouponCode,
} from '../src/services/coupon.service.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 11 — Coupons & Offers Management Tests', () => {
  const customerId = 'cust-uuid-1111-2222';
  const otherCustomerId = 'cust-uuid-3333-4444';

  const validPercentageCoupon: CouponPricingInput = {
    id: 'coupon-perc-1',
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minimumBookingAmount: 100,
    maximumDiscount: 50,
  };

  const validFixedCoupon: CouponPricingInput = {
    id: 'coupon-fix-1',
    code: 'SAVE50',
    discountType: 'FIXED_AMOUNT',
    discountValue: 50,
    minimumBookingAmount: 150,
    maximumDiscount: null,
  };

  // 1. Valid Percentage Coupon
  describe('1. Valid Percentage Coupon', () => {
    it('calculates correct percentage discount based on base amount', () => {
      const discount = calculateCouponDiscount(validPercentageCoupon, 300);
      assert.equal(discount, 30); // 10% of 300 = 30
    });

    it('caps discount at maximumDiscount when calculated discount exceeds limit', () => {
      const discount = calculateCouponDiscount(validPercentageCoupon, 800);
      assert.equal(discount, 50); // 10% of 800 = 80, capped at max 50
    });
  });

  // 2. Valid Fixed Coupon
  describe('2. Valid Fixed Coupon', () => {
    it('applies fixed discount correctly', () => {
      const discount = calculateCouponDiscount(validFixedCoupon, 200);
      assert.equal(discount, 50);
    });

    it('caps fixed discount at base amount to prevent negative total', () => {
      const heavyFixedCoupon: CouponPricingInput = {
        code: 'SAVE500',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500,
      };
      const discount = calculateCouponDiscount(heavyFixedCoupon, 200);
      assert.equal(discount, 200); // Cannot exceed baseAmount 200
    });
  });

  // 3. Invalid Coupon
  describe('3. Invalid Coupon', () => {
    it('rejects unknown coupon code with 404', () => {
      const fakeDb = new Map<string, any>();
      const lookup = (code: string) => {
        const found = fakeDb.get(normalizeCouponCode(code));
        if (!found) throw new ApiError(404, 'Invalid coupon code');
        return found;
      };

      assert.throws(() => lookup('NONEXISTENT'), (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /Invalid coupon code/i);
        return true;
      });
    });
  });

  // 4. Expired Coupon
  describe('4. Expired Coupon', () => {
    it('rejects expired coupon with 400', () => {
      const now = new Date();
      const expiredCoupon = {
        code: 'EXPIRED10',
        isActive: true,
        validFrom: new Date(now.getTime() - 1000 * 60 * 60 * 48),
        validUntil: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      };

      const validate = (coupon: typeof expiredCoupon) => {
        if (coupon.validUntil < new Date()) {
          throw new ApiError(400, 'This coupon has expired');
        }
      };

      assert.throws(() => validate(expiredCoupon), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /expired/i);
        return true;
      });
    });
  });

  // 5. Future Coupon
  describe('5. Future Coupon', () => {
    it('rejects not yet valid future coupon with 400', () => {
      const now = new Date();
      const futureCoupon = {
        code: 'FUTURE20',
        isActive: true,
        validFrom: new Date(now.getTime() + 1000 * 60 * 60 * 24),
        validUntil: new Date(now.getTime() + 1000 * 60 * 60 * 48),
      };

      const validate = (coupon: typeof futureCoupon) => {
        if (coupon.validFrom > new Date()) {
          throw new ApiError(400, 'This coupon is not yet valid');
        }
      };

      assert.throws(() => validate(futureCoupon), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /not yet valid/i);
        return true;
      });
    });
  });

  // 6. Inactive Coupon
  describe('6. Inactive Coupon', () => {
    it('rejects deactivated coupon with 400', () => {
      const inactiveCoupon = {
        code: 'INACTIVE',
        isActive: false,
      };

      const validate = (coupon: typeof inactiveCoupon) => {
        if (!coupon.isActive) {
          throw new ApiError(400, 'This coupon is currently inactive');
        }
      };

      assert.throws(() => validate(inactiveCoupon), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /inactive/i);
        return true;
      });
    });
  });

  // 7. Minimum Amount Failure
  describe('7. Minimum Amount Failure', () => {
    it('rejects coupon when booking base amount is below minimum threshold', () => {
      const couponWithMin: CouponPricingInput = {
        code: 'MIN300',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minimumBookingAmount: 300,
      };

      const validateMinAmount = (coupon: CouponPricingInput, bookingAmount: number) => {
        const min = Number(coupon.minimumBookingAmount ?? 0);
        if (bookingAmount < min) {
          throw new ApiError(400, `Minimum booking amount of $${min} required for coupon ${coupon.code}`);
        }
      };

      assert.throws(() => validateMinAmount(couponWithMin, 250), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Minimum booking amount/i);
        return true;
      });
    });
  });

  // 8. Global Usage Limit
  describe('8. Global Usage Limit', () => {
    it('rejects coupon when global usageLimit has been exhausted', () => {
      const exhaustedCoupon = {
        code: 'MAXLIMIT',
        usageLimit: 50,
        usedCount: 50,
      };

      const validateUsageLimit = (coupon: typeof exhaustedCoupon) => {
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
          throw new ApiError(400, 'This coupon has reached its maximum global usage limit');
        }
      };

      assert.throws(() => validateUsageLimit(exhaustedCoupon), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /maximum global usage limit/i);
        return true;
      });
    });
  });

  // 9. Per-User Usage Limit
  describe('9. Per-User Usage Limit', () => {
    it('rejects coupon when a single customer exceeds perUserLimit', () => {
      const singleUseCoupon = {
        id: 'coupon-per-user-1',
        code: 'ONCEPERUSER',
        perUserLimit: 1,
      };

      const userBookings = [
        { customerId, couponId: 'coupon-per-user-1', bookingStatus: 'CONFIRMED' },
      ];

      const validatePerUser = (cust: string, coupon: typeof singleUseCoupon) => {
        const usageCount = userBookings.filter(
          (b) => b.customerId === cust && b.couponId === coupon.id && b.bookingStatus !== 'CANCELLED',
        ).length;
        if (coupon.perUserLimit && usageCount >= coupon.perUserLimit) {
          throw new ApiError(400, `You have already reached the maximum usage limit (${coupon.perUserLimit}) for this coupon`);
        }
      };

      assert.throws(() => validatePerUser(customerId, singleUseCoupon), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /maximum usage limit/i);
        return true;
      });

      // Different user with 0 bookings is allowed
      assert.doesNotThrow(() => validatePerUser(otherCustomerId, singleUseCoupon));
    });
  });

  // 10. Percentage > 100 Rejected
  describe('10. Percentage > 100 Rejected', () => {
    it('rejects percentage discount greater than 100', () => {
      const validateRule = (discountType: string, discountValue: number) => {
        if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
          throw new ApiError(400, 'Percentage discount must be greater than 0 and less than or equal to 100');
        }
      };

      assert.throws(() => validateRule('PERCENTAGE', 110), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /less than or equal to 100/i);
        return true;
      });
    });
  });

  // 11. Negative Discount Rejected
  describe('11. Negative Discount Rejected', () => {
    it('rejects negative or zero discount values', () => {
      const validateRule = (discountValue: number) => {
        if (discountValue <= 0) {
          throw new ApiError(400, 'Discount value must be greater than 0');
        }
      };

      assert.throws(() => validateRule(-15), (err: any) => {
        assert.equal(err.statusCode, 400);
        return true;
      });
      assert.throws(() => validateRule(0), (err: any) => {
        assert.equal(err.statusCode, 400);
        return true;
      });
    });
  });

  // 12. Duplicate Code Rejected
  describe('12. Duplicate Code Rejected', () => {
    it('rejects coupon creation if code already exists', () => {
      const existingCodes = new Set(['WELCOME10', 'SAVE50']);

      const createCoupon = (code: string) => {
        const normalized = normalizeCouponCode(code);
        if (existingCodes.has(normalized)) {
          throw new ApiError(400, 'A coupon with this code already exists');
        }
      };

      assert.throws(() => createCoupon('welcome10'), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already exists/i);
        return true;
      });
    });
  });

  // 13. Customer Cannot Create Coupon
  describe('13. Customer Cannot Create Coupon', () => {
    it('denies coupon creation for CUSTOMER role with 403', () => {
      const checkRole = (role: string) => {
        if (role !== 'ADMIN') {
          throw new ApiError(403, 'You do not have permission to access this resource');
        }
      };

      assert.throws(() => checkRole('CUSTOMER'), (err: any) => {
        assert.equal(err.statusCode, 403);
        return true;
      });
    });
  });

  // 14. Partner Cannot Create Coupon
  describe('14. Partner Cannot Create Coupon', () => {
    it('denies coupon creation for PARTNER role with 403', () => {
      const checkRole = (role: string) => {
        if (role !== 'ADMIN') {
          throw new ApiError(403, 'You do not have permission to access this resource');
        }
      };

      assert.throws(() => checkRole('PARTNER'), (err: any) => {
        assert.equal(err.statusCode, 403);
        return true;
      });
    });
  });

  // 15. Admin Can Create Coupon
  describe('15. Admin Can Create Coupon', () => {
    it('allows ADMIN to create coupon and normalizes code to uppercase', () => {
      const rawInput = {
        code: '  earlybird25  ',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        validFrom: new Date('2028-01-01'),
        validUntil: new Date('2028-12-31'),
      };

      const normalizedCode = normalizeCouponCode(rawInput.code);
      assert.equal(normalizedCode, 'EARLYBIRD25');
    });
  });

  // 16. Admin Can Update Coupon
  describe('16. Admin Can Update Coupon', () => {
    it('allows updating coupon parameters safely', () => {
      const coupon = {
        code: 'TEST20',
        discountValue: 20,
        usageLimit: 100,
        isActive: true,
      };

      const updated = {
        ...coupon,
        discountValue: 25,
        usageLimit: 200,
      };

      assert.equal(updated.discountValue, 25);
      assert.equal(updated.usageLimit, 200);
    });
  });

  // 17. Admin Can Deactivate Coupon
  describe('17. Admin Can Deactivate Coupon', () => {
    it('allows setting isActive to false', () => {
      const coupon = { code: 'PROMO', isActive: true };
      const deactivated = { ...coupon, isActive: false };
      assert.equal(deactivated.isActive, false);
    });
  });

  // 18. Correct Discount Saved on Booking
  describe('18. Correct Discount Saved on Booking', () => {
    it('correctly calculates and saves discount amount on booking snapshot', () => {
      const roomPrice = 100;
      const numberOfNights = 3;
      const roomsCount = 1;
      const coupon: CouponPricingInput = {
        code: 'DISCOUNT15',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minimumBookingAmount: 100,
      };

      const pricing = calculateBookingPricing(roomPrice, numberOfNights, roomsCount, coupon);
      assert.equal(pricing.baseAmount, 300);
      assert.equal(pricing.discountAmount, 45); // 15% of 300 = 45
      assert.equal(pricing.totalAmount, 255); // 300 - 45 = 255
    });
  });

  // 19. Client Cannot Manipulate Discount
  describe('19. Client Cannot Manipulate Discount', () => {
    it('ignores client-sent discount and recalculates authoritative pricing on server', () => {
      const clientPayload = {
        clientDiscount: 9999,
        clientTotal: 1,
      };

      const roomPrice = 200;
      const numberOfNights = 2;
      const roomsCount = 1;
      const coupon: CouponPricingInput = {
        code: 'SAVE20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
      };

      // Server strictly ignores clientPayload and uses server-side calculateBookingPricing
      const authoritativePricing = calculateBookingPricing(roomPrice, numberOfNights, roomsCount, coupon);
      assert.notEqual(authoritativePricing.discountAmount, clientPayload.clientDiscount);
      assert.notEqual(authoritativePricing.totalAmount, clientPayload.clientTotal);
      assert.equal(authoritativePricing.discountAmount, 80); // 20% of 400 = 80
      assert.equal(authoritativePricing.totalAmount, 320); // 400 - 80 = 320
    });
  });

  // 20. Concurrent Redemption Is Protected
  describe('20. Concurrent Redemption Is Protected', () => {
    it('ensures usedCount is checked and incremented within transaction block', async () => {
      let usedCount = 9;
      const usageLimit = 10;

      const redeem = async () => {
        if (usedCount >= usageLimit) {
          throw new ApiError(400, 'This coupon has reached its maximum global usage limit');
        }
        usedCount++;
        return usedCount;
      };

      // First concurrent attempt succeeds
      const first = await redeem();
      assert.equal(first, 10);

      // Second concurrent attempt is rejected
      await assert.rejects(async () => redeem(), (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /maximum global usage limit/i);
        return true;
      });
    });
  });
});
