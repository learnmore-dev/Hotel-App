import 'dotenv/config';
import { getPrismaClient } from '../config/prisma.js';

const BASE_URL = process.env.API_TEST_URL || 'http://127.0.0.1:5000/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
}

interface UserAuth {
  user: { id: string; fullName: string; email: string; role: string };
  accessToken: string;
}

interface BookingRecord {
  id: string;
  bookingId: string;
  numberOfNights: number;
  roomsCount: number;
  guestsCount: number;
  roomPrice: number | string;
  totalAmount: number | string;
  bookingStatus: string;
  paymentStatus: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  hotel: { id: string; name: string };
  customer: { id: string; fullName: string; email: string };
}

async function request<T = unknown>(
  path: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<{ status: number; body: ApiResponse<T> }> {
  const { method = 'GET', token, headers = {}, body } = options;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const resBody = (await res.json()) as ApiResponse<T>;
  return { status: res.status, body: resBody };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function runPhase10Verification() {
  console.log('======================================================================');
  console.log('        TRUMITRIP PHASE 10: BOOKING MANAGEMENT VERIFICATION          ');
  console.log(`        Target API: ${BASE_URL}`);
  console.log('======================================================================\n');

  // STEP 1: Authentication for Customer, Partner, Admin
  console.log('[1/12] Authenticating Roles (Customer, Partner, Admin)...');
  const custRes = await request<UserAuth>('/auth/login', {
    method: 'POST',
    body: { email: 'customer@trumitrip.dev', password: 'CustomerPass123!' },
  });
  assert(custRes.status === 200, 'Customer login failed');
  const custToken = custRes.body.data.accessToken;

  const partnerRes = await request<UserAuth>('/auth/login', {
    method: 'POST',
    body: { email: 'partner@trumitrip.dev', password: 'PartnerPass123!' },
  });
  assert(partnerRes.status === 200, 'Partner login failed');
  const partnerToken = partnerRes.body.data.accessToken;

  const adminRes = await request<UserAuth>('/auth/login', {
    method: 'POST',
    body: { email: 'admin@trumitrip.dev', password: 'AdminPass123!' },
  });
  assert(adminRes.status === 200, 'Admin login failed');
  const adminToken = adminRes.body.data.accessToken;

  console.log('  ✔ Customer, Partner, and Admin authenticated successfully.\n');

  // STEP 2: Role Authorization Checks
  console.log('[2/12] Verifying Role Guard Authorization...');
  const unauthorizedAdminAccess = await request('/admin/bookings', { token: custToken });
  assert(unauthorizedAdminAccess.status === 403, `Customer accessing admin routes should return 403, got ${unauthorizedAdminAccess.status}`);
  console.log('  ✔ Customer blocked from admin endpoints (HTTP 403).');

  const unauthorizedPartnerAccess = await request('/partner/bookings', { token: custToken });
  assert(unauthorizedPartnerAccess.status === 403, `Customer accessing partner routes should return 403, got ${unauthorizedPartnerAccess.status}`);
  console.log('  ✔ Customer blocked from partner endpoints (HTTP 403).\n');

  // STEP 3: Setup Fresh Customer Booking
  console.log('[3/12] Creating Booking for Management Testing...');
  const hotelsRes = await request<{ items: Array<{ id: string; rooms: Array<{ id: string }> }> }>('/hotels');
  const hotel = hotelsRes.body.data.items[0];
  const hotelDetail = await request<{ id: string; rooms: Array<{ id: string }> }>(`/hotels/${hotel.id}`);
  const targetRoom = hotelDetail.body.data.rooms[0];

  const bookingRes = await request<BookingRecord>('/bookings', {
    method: 'POST',
    token: custToken,
    body: {
      hotelId: hotel.id,
      roomId: targetRoom.id,
      checkIn: '2028-11-20',
      checkOut: '2028-11-22',
      roomsCount: 1,
      guestsCount: 2,
      guestDetails: {
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        phone: '+1-555-0200',
      },
      specialRequests: 'Testing Phase 10 management flow',
    },
  });
  assert(bookingRes.status === 201, `Failed to create booking: ${JSON.stringify(bookingRes.body)}`);
  const booking = bookingRes.body.data;
  console.log(`  ✔ Created Booking ${booking.bookingId} (Initial Status: ${booking.bookingStatus})\n`);

  // STEP 4: Customer Tab / Time Filtering
  console.log('[4/12] Verifying Customer Time & Status Filtering...');
  const upcomingRes = await request<{ items: BookingRecord[] }>('/bookings?timeFilter=upcoming', { token: custToken });
  assert(upcomingRes.status === 200, 'GET /bookings?timeFilter=upcoming failed');
  const hasUpcoming = upcomingRes.body.data.items.some((b) => b.bookingId === booking.bookingId);
  assert(hasUpcoming, 'Booking not found in upcoming filter');
  console.log('  ✔ Booking correctly matches "upcoming" filter.');

  const cancelledFilterRes = await request<{ items: BookingRecord[] }>('/bookings?timeFilter=cancelled', { token: custToken });
  assert(cancelledFilterRes.status === 200, 'GET /bookings?timeFilter=cancelled failed');
  const inCancelled = cancelledFilterRes.body.data.items.some((b) => b.bookingId === booking.bookingId);
  assert(!inCancelled, 'Active booking should not appear in cancelled filter');
  console.log('  ✔ Active booking correctly excluded from "cancelled" filter.\n');

  // STEP 5: Partner Booking Management & Details
  console.log('[5/12] Verifying Partner Booking Visibility & Details...');
  const partnerBookingsRes = await request<{ items: BookingRecord[] }>('/partner/bookings', { token: partnerToken });
  assert(partnerBookingsRes.status === 200, 'GET /partner/bookings failed');
  const partnerFound = partnerBookingsRes.body.data.items.some((b) => b.bookingId === booking.bookingId);
  assert(partnerFound, 'Partner cannot view booking for their hotel');
  console.log(`  ✔ Partner can view booking ${booking.bookingId} in property list.`);

  const partnerDetailRes = await request<BookingRecord>(`/partner/bookings/${booking.bookingId}`, { token: partnerToken });
  assert(partnerDetailRes.status === 200, `GET /partner/bookings/:id failed with status ${partnerDetailRes.status}`);
  assert(partnerDetailRes.body.data.bookingId === booking.bookingId, 'Partner detail reference mismatch');
  console.log(`  ✔ Partner can retrieve single booking details via /partner/bookings/:id\n`);

  // STEP 6: Partner Valid Status Transition: PENDING -> CONFIRMED
  console.log('[6/12] Testing Partner Status Transition: PENDING → CONFIRMED...');
  const confirmRes = await request<BookingRecord>(`/partner/bookings/${booking.bookingId}/status`, {
    method: 'PATCH',
    token: partnerToken,
    body: { status: 'CONFIRMED' },
  });
  assert(confirmRes.status === 200, `Partner confirm failed with status ${confirmRes.status}: ${JSON.stringify(confirmRes.body)}`);
  assert(confirmRes.body.data.bookingStatus === 'CONFIRMED', `Expected CONFIRMED, got ${confirmRes.body.data.bookingStatus}`);
  console.log('  ✔ Partner successfully transitioned booking status to CONFIRMED.\n');

  // STEP 7: Partner Valid Status Transition: CONFIRMED -> COMPLETED
  console.log('[7/12] Testing Partner Status Transition: CONFIRMED → COMPLETED...');
  const completeRes = await request<BookingRecord>(`/partner/bookings/${booking.bookingId}/status`, {
    method: 'PATCH',
    token: partnerToken,
    body: { status: 'COMPLETED' },
  });
  assert(completeRes.status === 200, `Partner complete failed with status ${completeRes.status}: ${JSON.stringify(completeRes.body)}`);
  assert(completeRes.body.data.bookingStatus === 'COMPLETED', `Expected COMPLETED, got ${completeRes.body.data.bookingStatus}`);
  console.log('  ✔ Partner successfully transitioned booking status to COMPLETED.\n');

  // STEP 8: Partner Invalid Transition: COMPLETED -> CANCELLED (Terminal)
  console.log('[8/12] Testing Partner Rejection on Terminal Status Transition...');
  const invalidTransitionRes = await request<BookingRecord>(`/partner/bookings/${booking.bookingId}/status`, {
    method: 'PATCH',
    token: partnerToken,
    body: { status: 'CANCELLED', reason: 'Attempting invalid transition' },
  });
  assert(invalidTransitionRes.status === 400, `Expected 400 for terminal state transition, got ${invalidTransitionRes.status}`);
  console.log(`  ✔ Partner invalid transition correctly rejected with HTTP 400: "${invalidTransitionRes.body.message}"\n`);

  // STEP 9: Admin Booking Management & Search
  console.log('[9/12] Verifying Admin Booking List, Filtering & Search...');
  const adminSearchRes = await request<{ items: BookingRecord[]; pagination: { total: number } }>(
    `/admin/bookings?search=${booking.bookingId}`,
    { token: adminToken }
  );
  assert(adminSearchRes.status === 200, 'GET /admin/bookings with search failed');
  assert(adminSearchRes.body.data.items.length === 1, `Expected 1 match for reference ${booking.bookingId}, got ${adminSearchRes.body.data.items.length}`);
  console.log(`  ✔ Admin search by reference "${booking.bookingId}" matched 1 record.`);

  const adminDetailRes = await request<BookingRecord>(`/admin/bookings/${booking.bookingId}`, { token: adminToken });
  assert(adminDetailRes.status === 200, 'GET /admin/bookings/:id failed');
  assert(adminDetailRes.body.data.bookingId === booking.bookingId, 'Admin detail reference mismatch');
  console.log(`  ✔ Admin can retrieve single booking details via /admin/bookings/:id\n`);

  // STEP 10: Admin Status Management & Cancellation
  console.log('[10/12] Creating Second Booking for Admin Cancellation & Inventory Restoration...');
  const booking2Res = await request<BookingRecord>('/bookings', {
    method: 'POST',
    token: custToken,
    body: {
      hotelId: hotel.id,
      roomId: targetRoom.id,
      checkIn: '2028-11-25',
      checkOut: '2028-11-28',
      roomsCount: 1,
      guestsCount: 2,
      guestDetails: {
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        phone: '+1-555-0200',
      },
      specialRequests: 'Admin cancellation test',
    },
  });
  assert(booking2Res.status === 201, 'Failed to create second booking');
  const booking2 = booking2Res.body.data;
  console.log(`  ✔ Created second booking ${booking2.bookingId}`);

  const adminCancelRes = await request<BookingRecord>(`/admin/bookings/${booking2.bookingId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'CANCELLED', reason: 'Admin operational adjustment' },
  });
  assert(adminCancelRes.status === 200, `Admin cancel failed with status ${adminCancelRes.status}`);
  assert(adminCancelRes.body.data.bookingStatus === 'CANCELLED', 'Expected CANCELLED status');
  assert(Boolean(adminCancelRes.body.data.cancelledAt), 'cancelledAt timestamp missing');
  console.log(`  ✔ Admin successfully cancelled booking ${booking2.bookingId}.\n`);

  // STEP 11: Admin Invalid Transition: CANCELLED -> CONFIRMED (Terminal)
  console.log('[11/12] Testing Admin Rejection on Terminal Status Transition...');
  const adminInvalidRes = await request<BookingRecord>(`/admin/bookings/${booking2.bookingId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'CONFIRMED' },
  });
  assert(adminInvalidRes.status === 400, `Expected 400 for CANCELLED -> CONFIRMED, got ${adminInvalidRes.status}`);
  console.log(`  ✔ Admin invalid transition correctly rejected with HTTP 400: "${adminInvalidRes.body.message}"\n`);

  // STEP 12: Customer Cancellation Guard: Cancelled Booking Cannot Be Cancelled Again
  console.log('[12/12] Testing Customer Double-Cancellation Guard...');
  const doubleCancelRes = await request(`/bookings/${booking2.bookingId}/cancel`, {
    method: 'PATCH',
    token: custToken,
    body: { cancellationReason: 'Trying to cancel again' },
  });
  assert(doubleCancelRes.status === 400, `Expected 400 for already cancelled booking, got ${doubleCancelRes.status}`);
  console.log(`  ✔ Customer double cancellation blocked with HTTP 400: "${doubleCancelRes.body.message}"\n`);

  console.log('======================================================================');
  console.log('       ALL 12 PHASE 10 E2E VERIFICATION STEPS PASSED 100%!           ');
  console.log('======================================================================\n');
}

runPhase10Verification()
  .catch((err) => {
    console.error('\n❌ PHASE 10 VERIFICATION FAILED:');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });
