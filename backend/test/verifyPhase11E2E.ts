import 'dotenv/config';

import assert from 'node:assert/strict';

import { getPrismaClient } from '../src/config/prisma.js';
import * as bookingService from '../src/services/booking.service.js';
import * as couponService from '../src/services/coupon.service.js';

async function runPhase11E2E() {
  console.log('====================================================');
  console.log('TRUMITRIP — PHASE 11 E2E & REGRESSION VERIFICATION');
  console.log('====================================================\n');

  const prisma = getPrismaClient();

  // Step 1: Verify Seed Data
  console.log('[Step 1] Verifying seed accounts, hotel, room, and promotional coupons...');
  const customer = await prisma.user.findUnique({
    where: { email: 'customer@trumitrip.dev' },
  });
  assert(customer, 'Customer user must exist');

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@trumitrip.dev' },
  });
  assert(admin, 'Admin user must exist');

  const hotel = await prisma.hotel.findFirst({
    where: { isActive: true },
    include: { rooms: { where: { status: 'AVAILABLE' } } },
  });
  assert(hotel && hotel.rooms.length > 0, 'At least one active hotel with available rooms must exist');
  const room = hotel.rooms[0];

  const welcomeCoupon = await prisma.coupon.findUnique({
    where: { code: 'WELCOME10' },
  });
  assert(welcomeCoupon, 'WELCOME10 coupon must exist');

  console.log(`  ✓ Customer: ${customer.email} (${customer.id})`);
  console.log(`  ✓ Hotel: ${hotel.name} (${hotel.id})`);
  console.log(`  ✓ Room: ${room.roomType} ($${room.pricePerNight}/night)`);
  console.log(`  ✓ Coupon: ${welcomeCoupon.code} (${welcomeCoupon.discountValue}% off)\n`);

  // Step 2: Regular Booking Regression (Phase 9/10 Flow without Coupon)
  console.log('[Step 2] Executing standard booking flow without coupon (Regression)...');
  const checkIn = '2029-04-10';
  const checkOut = '2029-04-13'; // 3 nights

  const standardBooking = await bookingService.createBooking(customer.id, {
    hotelId: hotel.id,
    roomId: room.id,
    checkIn,
    checkOut,
    roomsCount: 1,
    guestsCount: 2,
    guestDetails: {
      fullName: 'Alex Morgan',
      email: 'customer@trumitrip.dev',
      phone: '+1-555-0200',
    },
    specialRequests: 'High floor quiet room please',
  });

  const expectedBase = Number(room.pricePerNight) * 3;
  assert.equal(Number(standardBooking.discountAmount), 0, 'Discount must be 0 without coupon');
  assert.equal(Number(standardBooking.totalAmount), expectedBase, 'Total must equal base amount');
  assert.equal(standardBooking.bookingStatus, 'PENDING');
  console.log(`  ✓ Created standard booking: ${standardBooking.bookingId} ($${standardBooking.totalAmount})`);

  // Cancel standard booking
  const cancelledStandard = await bookingService.cancelCustomerBooking(customer.id, standardBooking.id, 'Changed travel dates');
  assert.equal(cancelledStandard.bookingStatus, 'CANCELLED');
  console.log(`  ✓ Cancelled standard booking: ${cancelledStandard.bookingId} (Inventory restored)\n`);

  // Step 3: Coupon Validation Endpoint Logic
  console.log('[Step 3] Testing customer coupon validation rules...');
  const testBaseAmount = 300;

  // Valid WELCOME10 validation
  const validCheck = await couponService.validateCouponForCustomer(customer.id, 'welcome10', testBaseAmount);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.coupon.code, 'WELCOME10');
  assert.equal(validCheck.coupon.discountAmount, 30); // 10% of 300 = 30
  console.log(`  ✓ WELCOME10 validation: 10% of $${testBaseAmount} = -$${validCheck.coupon.discountAmount}`);

  // Invalid coupon rejection
  let caught404 = false;
  try {
    await couponService.validateCouponForCustomer(customer.id, 'BOGUS99', testBaseAmount);
  } catch (err: any) {
    if (err.statusCode === 404) caught404 = true;
  }
  assert(caught404, 'Non-existent coupon must throw 404');
  console.log('  ✓ Non-existent coupon code correctly rejected with 404');

  // Minimum amount rejection
  let caughtMinAmount = false;
  try {
    // LUXURY100 requires $500 min spend
    await couponService.validateCouponForCustomer(customer.id, 'LUXURY100', 200);
  } catch (err: any) {
    if (err.statusCode === 400) caughtMinAmount = true;
  }
  assert(caughtMinAmount, 'Coupon below minimum spend must throw 400');
  console.log('  ✓ Spend below minimum threshold correctly rejected with 400\n');

  // Step 4: Active Offers Listing
  console.log('[Step 4] Testing active promotional offers listing (GET /api/offers)...');
  const activeOffers = await couponService.listActiveOffers();
  assert(activeOffers.length >= 3, 'Must return active promotional offers');
  console.log(`  ✓ Retrieved ${activeOffers.length} active promotional offers:`);
  for (const o of activeOffers) {
    console.log(`    - ${o.code}: ${o.description} (Min spend: $${o.minimumBookingAmount})`);
  }
  console.log();

  // Step 5: Booking Creation with Validated Coupon
  console.log('[Step 5] Creating hotel booking with coupon WELCOME10...');
  const initialUsedCount = welcomeCoupon.usedCount;

  const couponBooking = await bookingService.createBooking(customer.id, {
    hotelId: hotel.id,
    roomId: room.id,
    checkIn: '2029-05-01',
    checkOut: '2029-05-04', // 3 nights
    roomsCount: 1,
    guestsCount: 2,
    guestDetails: {
      fullName: 'Alex Morgan',
      email: 'customer@trumitrip.dev',
      phone: '+1-555-0200',
    },
    couponCode: 'WELCOME10',
  });

  const basePrice = Number(room.pricePerNight) * 3;
  const expectedDiscount = Math.min(Math.round(basePrice * 0.1 * 100) / 100, 50); // 10% capped at max $50
  const expectedFinal = Math.max(0, basePrice - expectedDiscount);

  assert.equal(Number(couponBooking.discountAmount), expectedDiscount, 'Discount must match server calculation');
  assert.equal(Number(couponBooking.totalAmount), expectedFinal, 'Final total must be discounted');
  assert.equal(couponBooking.coupon?.code, 'WELCOME10', 'Booking must be linked to coupon');

  // Verify coupon usedCount incremented in database
  const updatedWelcomeCoupon = await prisma.coupon.findUnique({ where: { id: welcomeCoupon.id } });
  assert.equal(updatedWelcomeCoupon?.usedCount, initialUsedCount + 1, 'Coupon usedCount must increment by 1');

  console.log(`  ✓ Booking created: ${couponBooking.bookingId}`);
  console.log(`    Base Price:     $${basePrice.toFixed(2)}`);
  console.log(`    Coupon Applied: ${couponBooking.coupon?.code} (-$${couponBooking.discountAmount})`);
  console.log(`    Final Total:    $${couponBooking.totalAmount}`);
  console.log(`    Coupon usedCount incremented: ${initialUsedCount} -> ${updatedWelcomeCoupon?.usedCount}\n`);

  // Step 6: Customer Booking Cancellation Restores Coupon Usage
  console.log('[Step 6] Cancelling coupon booking and verifying coupon usage restoration...');
  const cancelledCouponBooking = await bookingService.cancelCustomerBooking(customer.id, couponBooking.id, 'Trip cancelled');
  assert.equal(cancelledCouponBooking.bookingStatus, 'CANCELLED');

  const restoredWelcomeCoupon = await prisma.coupon.findUnique({ where: { id: welcomeCoupon.id } });
  assert.equal(restoredWelcomeCoupon?.usedCount, initialUsedCount, 'Coupon usedCount must decrement back upon cancellation');
  console.log(`  ✓ Booking cancelled: ${cancelledCouponBooking.bookingId}`);
  console.log(`  ✓ Coupon usedCount restored: ${updatedWelcomeCoupon?.usedCount} -> ${restoredWelcomeCoupon?.usedCount}\n`);

  // Step 7: Admin Coupon Lifecycle Operations
  console.log('[Step 7] Testing Admin coupon CRUD lifecycle...');
  const testAdminCode = 'E2ETEST' + Date.now().toString().slice(-4);
  const now = new Date();
  const validUntil = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  // A. Create
  const createdAdminCoupon = await couponService.createAdminCoupon({
    code: testAdminCode,
    description: 'E2E Testing Promo Code',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minimumBookingAmount: 150,
    maximumDiscount: 60,
    validFrom: now,
    validUntil,
    usageLimit: 200,
    perUserLimit: 1,
    isActive: true,
  });
  assert.equal(createdAdminCoupon.code, testAdminCode);
  console.log(`  ✓ Admin created coupon: ${createdAdminCoupon.code}`);

  // B. Update
  const updatedAdminCoupon = await couponService.updateAdminCoupon(createdAdminCoupon.id, {
    description: 'Updated E2E Testing Promo Code',
    discountValue: 20,
  });
  assert.equal(Number(updatedAdminCoupon.discountValue), 20);
  console.log(`  ✓ Admin updated coupon: ${updatedAdminCoupon.code} (Discount updated to 20%)`);

  // C. Deactivate
  const deactivatedAdminCoupon = await couponService.updateAdminCoupon(createdAdminCoupon.id, {
    isActive: false,
  });
  assert.equal(deactivatedAdminCoupon.isActive, false);
  console.log(`  ✓ Admin deactivated coupon: ${deactivatedAdminCoupon.code}`);

  // D. Delete
  await couponService.deleteAdminCoupon(createdAdminCoupon.id);
  const checkDeleted = await prisma.coupon.findUnique({ where: { id: createdAdminCoupon.id } });
  assert.equal(checkDeleted, null, 'Coupon should be deleted');
  console.log(`  ✓ Admin deleted coupon: ${testAdminCode}\n`);

  console.log('====================================================');
  console.log('ALL PHASE 11 VERIFICATION CHECKS PASSED (100%)');
  console.log('====================================================');
  await prisma.$disconnect();
}

runPhase11E2E().catch((err) => {
  console.error('Phase 11 E2E Verification failed:', err);
  process.exit(1);
});
