-- AlterEnum
ALTER TYPE "CouponDiscountType" ADD VALUE 'FIXED_AMOUNT';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "perUserLimit" INTEGER;
