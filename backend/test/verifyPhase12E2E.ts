import 'dotenv/config';

import assert from 'node:assert/strict';

import { getPrismaClient } from '../src/config/prisma.js';
import * as bookingService from '../src/services/booking.service.js';
import * as paymentService from '../src/services/payment.service.js';
import { ApiError } from '../src/utils/ApiError.js';

async function runPhase12E2E() {
  console.log('====================================================');
  console.log('TRUMITRIP — PHASE 12 LIVE DB E2E & PAYMENT FLOW VERIFICATION');
  console.log('====================================================\n');

  const prisma = getPrismaClient();

  // Step 1: Verify Seed Data
  console.log('[Step 1] Verifying seed accounts, hotel, and room in database...');
  const customer = await prisma.user.findUnique({
    where: { email: 'customer@trumitrip.dev' },
  });
  assert(customer, 'Customer user must exist');

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@trumitrip.dev' },
  });
  assert(admin, 'Admin user must exist');

  const partner = await prisma.user.findUnique({
    where: { email: 'partner@trumitrip.dev' },
    include: { partnerProfile: true },
  });
  assert(partner, 'Partner user must exist');

  const hotel = await prisma.hotel.findFirst({
    where: { isActive: true },
    include: { rooms: { where: { status: 'AVAILABLE' } } },
  });
  assert(hotel && hotel.rooms.length > 0, 'At least one active hotel with available rooms must exist');
  const room = hotel.rooms[0];

  console.log(`  ✓ Customer: ${customer.email} (${customer.id})`);
  console.log(`  ✓ Admin:    ${admin.email} (${admin.id})`);
  console.log(`  ✓ Hotel:    ${hotel.name} (${hotel.id})`);
  console.log(`  ✓ Room:     ${room.roomType} ($${room.pricePerNight}/night)\n`);

  // Step 2: Create a fresh booking for Customer 1
  console.log('[Step 2] Creating a booking for payment testing...');
  const checkIn = '2029-06-10';
  const checkOut = '2029-06-12'; // 2 nights

  const booking1 = await bookingService.createBooking(customer.id, {
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
    specialRequests: 'High floor preferred',
  });

  console.log(`  ✓ Booking created: ${booking1.bookingId} (ID: ${booking1.id})`);
  console.log(`  ✓ Total Amount: $${booking1.totalAmount}`);
  console.log(`  ✓ Booking Status: ${booking1.bookingStatus}, Payment Status: ${booking1.paymentStatus}\n`);

  // Step 3: Test Payment Failure Simulation
  console.log('[Step 3] Testing simulated payment failure (CARD with simulateFailure: true)...');
  const failedPayment = await paymentService.createPayment(customer.id, {
    bookingId: booking1.id,
    paymentMethod: 'CARD',
    simulateFailure: true,
  });

  assert.equal(failedPayment.status, 'FAILED', 'Payment status must be FAILED');
  assert.equal(failedPayment.paymentMethod, 'CARD');
  assert(failedPayment.transactionId && failedPayment.transactionId.startsWith('FAIL-'), 'Transaction ID must start with FAIL-');

  // Verify Booking reflects FAILED
  const bookingAfterFail = await prisma.booking.findUniqueOrThrow({ where: { id: booking1.id } });
  assert.equal(bookingAfterFail.paymentStatus, 'FAILED', 'Booking paymentStatus must be FAILED');
  console.log(`  ✓ Payment record: ${failedPayment.id} marked FAILED`);
  console.log(`  ✓ Transaction ID: ${failedPayment.transactionId}`);
  console.log(`  ✓ Booking paymentStatus: ${bookingAfterFail.paymentStatus}\n`);

  // Step 4: Test Retry Payment with UPI (Success)
  console.log('[Step 4] Retrying payment with UPI (Successful simulation)...');
  const successPayment = await paymentService.createPayment(customer.id, {
    bookingId: booking1.id,
    paymentMethod: 'UPI',
    simulateFailure: false,
  });

  assert.equal(successPayment.status, 'SUCCESS', 'Payment status must be SUCCESS');
  assert.equal(successPayment.paymentMethod, 'UPI');
  assert(successPayment.transactionId && successPayment.transactionId.startsWith('TXN-'), 'Transaction ID must start with TXN-');
  assert.equal(Number(successPayment.amount), Number(booking1.totalAmount), 'Amount must equal booking totalAmount');

  const bookingAfterSuccess = await prisma.booking.findUniqueOrThrow({ where: { id: booking1.id } });
  assert.equal(bookingAfterSuccess.paymentStatus, 'PAID', 'Booking paymentStatus must be PAID');
  assert.equal(bookingAfterSuccess.bookingStatus, 'CONFIRMED', 'Booking status must be CONFIRMED');
  console.log(`  ✓ Payment record: ${successPayment.id} updated to SUCCESS`);
  console.log(`  ✓ Transaction ID: ${successPayment.transactionId}`);
  console.log(`  ✓ Booking paymentStatus: ${bookingAfterSuccess.paymentStatus}`);
  console.log(`  ✓ Booking status: ${bookingAfterSuccess.bookingStatus}\n`);

  // Step 5: Test Paying an Already Paid Booking Rejection
  console.log('[Step 5] Verifying rejection of duplicate payment for paid booking...');
  let duplicateRejected = false;
  try {
    await paymentService.createPayment(customer.id, {
      bookingId: booking1.id,
      paymentMethod: 'UPI',
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === 400) {
      duplicateRejected = true;
    }
  }
  assert.equal(duplicateRejected, true, 'Must reject paying an already paid booking with 400');
  console.log('  ✓ Duplicate payment rejected with 400 as expected\n');

  // Step 6: Test Customer 2 cannot pay for Customer 1's booking
  console.log("[Step 6] Testing customer ownership check (cannot pay for another user's booking)...");
  let crossCustomerRejected = false;
  try {
    await paymentService.createPayment(admin.id, {
      bookingId: booking1.id,
      paymentMethod: 'UPI',
    });
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === 403) {
      crossCustomerRejected = true;
    }
  }
  assert.equal(crossCustomerRejected, true, "Must reject paying for another user's booking with 403");
  console.log("  ✓ Cross-customer payment rejected with 403 as expected\n");

  // Step 7: Test PAY_AT_HOTEL Payment Mode
  console.log('[Step 7] Testing PAY_AT_HOTEL payment mode for a new reservation...');
  const booking2 = await bookingService.createBooking(customer.id, {
    hotelId: hotel.id,
    roomId: room.id,
    checkIn: '2029-06-20',
    checkOut: '2029-06-22',
    roomsCount: 1,
    guestsCount: 2,
    guestDetails: {
      fullName: 'Alex Morgan',
      email: 'customer@trumitrip.dev',
      phone: '+1-555-0200',
    },
  });

  const payAtHotelPayment = await paymentService.createPayment(customer.id, {
    bookingId: booking2.id,
    paymentMethod: 'PAY_AT_HOTEL',
  });

  assert.equal(payAtHotelPayment.status, 'PENDING', 'PAY_AT_HOTEL payment status must be PENDING');
  assert(payAtHotelPayment.transactionId && payAtHotelPayment.transactionId.startsWith('HOTEL-'), 'PAY_AT_HOTEL txn ID must start with HOTEL-');

  const booking2Db = await prisma.booking.findUniqueOrThrow({ where: { id: booking2.id } });
  assert.equal(booking2Db.paymentStatus, 'PENDING', 'PAY_AT_HOTEL booking paymentStatus must be PENDING');
  console.log(`  ✓ PAY_AT_HOTEL Payment: ${payAtHotelPayment.id} (Status: ${payAtHotelPayment.status})`);
  console.log(`  ✓ Transaction ID: ${payAtHotelPayment.transactionId}`);
  console.log(`  ✓ Booking paymentStatus: ${booking2Db.paymentStatus} (Must NOT be SUCCESS)\n`);

  // Step 8: Test Admin Status Update & Refund Architecture
  console.log('[Step 8] Testing Admin refund transition (SUCCESS -> REFUNDED)...');
  const refundedPayment = await paymentService.updatePaymentStatus(
    admin.id,
    successPayment.id,
    'REFUNDED',
    'Customer cancelled with eligible policy',
  );

  assert.equal(refundedPayment.status, 'REFUNDED', 'Payment status must be REFUNDED');
  const booking1Refunded = await prisma.booking.findUniqueOrThrow({ where: { id: booking1.id } });
  assert.equal(booking1Refunded.paymentStatus, 'REFUNDED', 'Booking paymentStatus must be REFUNDED');
  console.log(`  ✓ Payment ${refundedPayment.id} successfully transitioned to REFUNDED`);
  console.log(`  ✓ Booking ${booking1Refunded.bookingId} paymentStatus: ${booking1Refunded.paymentStatus}\n`);

  // Step 9: Test Invalid Transition Rejection (REFUNDED -> SUCCESS)
  console.log('[Step 9] Verifying invalid transition rejection (REFUNDED -> SUCCESS)...');
  let invalidTransitionRejected = false;
  try {
    await paymentService.updatePaymentStatus(admin.id, successPayment.id, 'SUCCESS');
  } catch (err: unknown) {
    if (err instanceof ApiError && err.statusCode === 400) {
      invalidTransitionRejected = true;
    }
  }
  assert.equal(invalidTransitionRejected, true, 'Must reject invalid transition from REFUNDED to SUCCESS');
  console.log('  ✓ Invalid transition rejected with 400 as expected\n');

  // Step 10: Verify Role-based Payment Retrieval
  console.log('[Step 10] Testing role-based payment access (Customer own, Admin all, Partner hotel)...');
  const customerView = await paymentService.getPaymentById(customer.id, 'CUSTOMER', successPayment.id);
  assert.equal(customerView.id, successPayment.id);

  const adminView = await paymentService.getPaymentById(admin.id, 'ADMIN', successPayment.id);
  assert.equal(adminView.id, successPayment.id);

  const byBookingRef = await paymentService.getBookingPayment(customer.id, 'CUSTOMER', booking1.bookingId);
  assert.equal(byBookingRef.id, successPayment.id);
  console.log('  ✓ Customer can retrieve payment by ID and by bookingId');
  console.log('  ✓ Admin can retrieve any payment across platform\n');

  console.log('====================================================');
  console.log('✅ ALL PHASE 12 LIVE DB CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runPhase12E2E()
  .catch((err) => {
    console.error('❌ PHASE 12 E2E VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
