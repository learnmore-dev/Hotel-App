import 'dotenv/config';
import { getPrismaClient } from '../config/prisma.js';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
}

interface UserAuthResponse {
  user: { id: string; fullName: string; email: string; role: string };
  accessToken: string;
}

interface RoomItem {
  id: string;
  roomType: string;
  pricePerNight: number | string;
  availableRooms: number;
}

interface HotelItem {
  id: string;
  name: string;
  city: string;
  rooms?: RoomItem[];
}

interface BookingItem {
  id: string;
  bookingId: string;
  numberOfNights: number;
  roomsCount: number;
  guestsCount: number;
  roomPrice: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  bookingStatus: string;
  paymentStatus: string;
  cancelledAt?: string | null;
  hotel: { name: string };
}

const BASE_URL = process.env.API_TEST_URL || 'http://127.0.0.1:5000/api';

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
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const resBody = (await response.json()) as ApiResponse<T>;
  return { status: response.status, body: resBody };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log(' TRUMITRIP PHASE 9: END-TO-END VERIFICATION SUITE');
  console.log(` Target API: ${BASE_URL}`);
  console.log('====================================================\n');

  // Clean any previous test bookings for repeatable suite
  const prisma = getPrismaClient();
  const deleted = await prisma.booking.deleteMany({
    where: { customer: { email: 'customer@trumitrip.dev' } },
  });
  if (deleted.count > 0) {
    console.log(`🧹 Cleaned ${deleted.count} previous test booking(s) for customer@trumitrip.dev\n`);
  }

  // STEP 1: API Health Check
  console.log('[1/10] Checking API Health...');
  const healthRes = await request('/health');
  assert(healthRes.status === 200, `Health check returned status ${healthRes.status}`);
  assert(healthRes.body.success === true, 'Health check success is not true');
  console.log('  ✔ API is online and PostgreSQL database is connected.\n');

  // STEP 2: Authentication
  console.log('[2/10] Authenticating Test Customer & Partner...');
  const customerLogin = await request<UserAuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      email: 'customer@trumitrip.dev',
      password: 'CustomerPass123!',
    },
  });
  assert(customerLogin.status === 200, `Customer login failed with status ${customerLogin.status}`);
  const customerToken = customerLogin.body.data.accessToken;
  const customerUser = customerLogin.body.data.user;
  assert(Boolean(customerToken), 'Customer access token is missing');
  console.log(`  ✔ Customer logged in: ${customerUser.fullName} (${customerUser.email})`);

  const partnerLogin = await request<UserAuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      email: 'partner@trumitrip.dev',
      password: 'PartnerPass123!',
    },
  });
  assert(partnerLogin.status === 200, `Partner login failed with status ${partnerLogin.status}`);
  const partnerToken = partnerLogin.body.data.accessToken;
  assert(Boolean(partnerToken), 'Partner access token is missing');
  console.log(`  ✔ Partner logged in: ${partnerLogin.body.data.user.fullName}\n`);

  // STEP 3: Customer Hotel Visibility (Task 3)
  console.log('[3/10] Verifying Hotel Listings & Search (Customer View)...');
  const hotelsRes = await request<{ items: HotelItem[] }>('/hotels');
  assert(hotelsRes.status === 200, 'GET /hotels failed');
  const hotelList = hotelsRes.body.data.items;
  assert(hotelList.length >= 3, `Expected at least 3 hotels, got ${hotelList.length}`);
  console.log(`  ✔ GET /hotels returned ${hotelList.length} hotels`);

  const featuredRes = await request<{ items: HotelItem[] }>('/hotels/featured');
  assert(featuredRes.status === 200, 'GET /hotels/featured failed');
  const featuredHotels = featuredRes.body.data.items;
  assert(featuredHotels.length >= 1, 'Expected at least 1 featured hotel');
  console.log(`  ✔ GET /hotels/featured returned ${featuredHotels.length} featured stays`);

  const destRes = await request<string[]>('/hotels/destinations');
  assert(destRes.status === 200, 'GET /hotels/destinations failed');
  const destinations = destRes.body.data;
  assert(destinations.includes('Miami') || destinations.includes('Aspen') || destinations.includes('New York'), 'Expected destinations not found');
  console.log(`  ✔ GET /hotels/destinations returned: ${destinations.join(', ')}`);

  const searchRes = await request<{ items: HotelItem[] }>('/hotels?city=Miami');
  assert(searchRes.status === 200, 'GET /hotels?city=Miami failed');
  assert(searchRes.body.data.items.length >= 1, 'Expected at least 1 Miami hotel');
  console.log(`  ✔ Filter GET /hotels?city=Miami returned: "${searchRes.body.data.items[0].name}"\n`);

  // STEP 4: Hotel Details & Room Display (Task 4)
  console.log('[4/10] Verifying Hotel Details & Room Inventory...');
  const targetHotel = hotelList.find((h) => h.city === 'Miami') || hotelList[0];
  const hotelDetailRes = await request<HotelItem>(`/hotels/${targetHotel.id}`);
  assert(hotelDetailRes.status === 200, `GET /hotels/${targetHotel.id} failed`);
  const hotelDetail = hotelDetailRes.body.data;
  assert(Boolean(hotelDetail.rooms && hotelDetail.rooms.length >= 2), 'Hotel must have at least 2 room types');
  const availableRoomTypes = hotelDetail.rooms || [];
  console.log(`  ✔ Hotel details verified: "${hotelDetail.name}" in ${hotelDetail.city}`);
  console.log(`  ✔ Room types available: ${availableRoomTypes.map((r) => `${r.roomType} ($${r.pricePerNight})`).join(', ')}`);

  const targetRoom = availableRoomTypes[0];
  const checkInDate = '2028-12-10';
  const checkOutDate = '2028-12-13'; // 3 nights

  const availRes1 = await request<{ rooms: RoomItem[] }>(`/hotels/${targetHotel.id}/rooms/availability?checkIn=${checkInDate}&checkOut=${checkOutDate}&rooms=1&guests=2`);
  assert(availRes1.status === 200, 'GET room availability failed');
  const availRoom1 = availRes1.body.data.rooms.find((r) => r.id === targetRoom.id);
  assert(Boolean(availRoom1), 'Target room not in availability response');
  const initialAvailable = availRoom1 ? availRoom1.availableRooms : 0;
  console.log(`  ✔ Initial availability for "${availRoom1?.roomType}" (${checkInDate} to ${checkOutDate}): ${initialAvailable} rooms\n`);

  // STEP 5: Create Booking (Task 5)
  console.log('[5/10] Submitting Transactional Booking (2 rooms, 4 guests, 3 nights)...');
  const idempotencyKey = `e2e-verify-${Date.now()}`;
  const bookingRes = await request<BookingItem>('/bookings', {
    method: 'POST',
    token: customerToken,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      hotelId: targetHotel.id,
      roomId: targetRoom.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomsCount: 2,
      guestsCount: 4,
      guestDetails: {
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        phone: '+1-555-0200',
      },
      specialRequests: 'Quiet room near elevator, please.',
    },
  });

  assert(bookingRes.status === 201, `POST /bookings failed with status ${bookingRes.status}: ${JSON.stringify(bookingRes.body)}`);
  const createdBooking = bookingRes.body.data;
  assert(createdBooking.bookingId.startsWith('TRM-'), `Invalid booking ID format: ${createdBooking.bookingId}`);
  assert(createdBooking.numberOfNights === 3, `Expected 3 nights, got ${createdBooking.numberOfNights}`);
  assert(createdBooking.roomsCount === 2, `Expected 2 rooms, got ${createdBooking.roomsCount}`);
  assert(createdBooking.guestsCount === 4, `Expected 4 guests, got ${createdBooking.guestsCount}`);
  assert(createdBooking.bookingStatus === 'PENDING', `Expected status PENDING, got ${createdBooking.bookingStatus}`);
  assert(createdBooking.paymentStatus === 'PENDING', `Expected paymentStatus PENDING, got ${createdBooking.paymentStatus}`);

  // Verify server-side pricing:
  // roomPrice is room's price per night snapshot
  // base = roomPrice * nights * rooms = targetRoom.pricePerNight * 3 * 2
  const expectedRoomPrice = Number(targetRoom.pricePerNight);
  const expectedBase = expectedRoomPrice * 3 * 2;
  const expectedTotal = expectedBase + Number(createdBooking.taxAmount) - Number(createdBooking.discountAmount);
  assert(Number(createdBooking.roomPrice) === expectedRoomPrice, `Room price mismatch: expected ${expectedRoomPrice}, got ${createdBooking.roomPrice}`);
  assert(Number(createdBooking.totalAmount) === expectedTotal, `Total mismatch: expected ${expectedTotal}, got ${createdBooking.totalAmount}`);

  console.log(`  ✔ Booking created successfully:`);
  console.log(`     - Reference ID: ${createdBooking.bookingId}`);
  console.log(`     - Database UUID: ${createdBooking.id}`);
  console.log(`     - Nights: ${createdBooking.numberOfNights} (${checkInDate} to ${checkOutDate})`);
  console.log(`     - Rooms: ${createdBooking.roomsCount}, Guests: ${createdBooking.guestsCount}`);
  console.log(`     - Room Nightly Rate: $${createdBooking.roomPrice}/night`);
  console.log(`     - Server-side Calculated Total: $${createdBooking.totalAmount} (Base: $${expectedBase} + Tax: $${createdBooking.taxAmount})`);
  console.log(`     - Status: ${createdBooking.bookingStatus} / Payment: ${createdBooking.paymentStatus}\n`);

  // STEP 6: Inventory Decrement Verification (Task 5 & 8)
  console.log('[6/10] Verifying Room Inventory Decrement...');
  const availRes2 = await request<{ rooms: RoomItem[] }>(`/hotels/${targetHotel.id}/rooms/availability?checkIn=${checkInDate}&checkOut=${checkOutDate}&rooms=1&guests=2`);
  assert(availRes2.status === 200, 'GET room availability check 2 failed');
  const availRoom2 = availRes2.body.data.rooms.find((r) => r.id === targetRoom.id);
  const newAvailable = availRoom2 ? availRoom2.availableRooms : 0;
  assert(newAvailable === initialAvailable - 2, `Expected ${initialAvailable - 2} available rooms, got ${newAvailable}`);
  console.log(`  ✔ Inventory accurately decremented from ${initialAvailable} to ${newAvailable} for requested dates.\n`);

  // STEP 7: Overbooking & Capacity Protection (Task 8)
  console.log('[7/10] Verifying Overbooking & Concurrency Protection...');
  // Try to book remaining available + 1 rooms
  const overbookRoomsCount = newAvailable + 1;
  const overbookRes = await request('/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      hotelId: targetHotel.id,
      roomId: targetRoom.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomsCount: overbookRoomsCount,
      guestsCount: overbookRoomsCount * 2,
      guestDetails: {
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        phone: '+1-555-0200',
      },
    },
  });
  assert(overbookRes.status === 409 || overbookRes.status === 400, `Expected overbooking rejection (409/400), got ${overbookRes.status}`);
  console.log(`  ✔ Overbooking correctly blocked with HTTP ${overbookRes.status}: "${overbookRes.body.message}"\n`);

  // STEP 8: Idempotency Protection
  console.log('[8/10] Verifying Duplicate Submission Protection (Idempotency Key)...');
  const duplicateRes = await request<BookingItem>('/bookings', {
    method: 'POST',
    token: customerToken,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      hotelId: targetHotel.id,
      roomId: targetRoom.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomsCount: 2,
      guestsCount: 4,
      guestDetails: {
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        phone: '+1-555-0200',
      },
    },
  });
  assert(duplicateRes.status === 200 || duplicateRes.status === 201, 'Duplicate request failed');
  assert(duplicateRes.body.data.bookingId === createdBooking.bookingId, 'Idempotent request did not return same booking');
  console.log(`  ✔ Idempotent replay returned existing booking ${duplicateRes.body.data.bookingId} without duplicate record.\n`);

  // STEP 9: Booking History & Partner Visibility (Task 6)
  console.log('[9/10] Verifying Customer History & Partner Visibility...');
  const customerBookingsRes = await request<{ items: BookingItem[] }>('/bookings', { token: customerToken });
  assert(customerBookingsRes.status === 200, 'GET /bookings failed');
  const foundInCustomer = customerBookingsRes.body.data.items.some((b) => b.bookingId === createdBooking.bookingId);
  assert(foundInCustomer, 'Created booking not found in customer booking history');
  console.log(`  ✔ Booking appears in customer history (Total customer bookings: ${customerBookingsRes.body.data.items.length})`);

  const detailRes = await request<BookingItem>(`/bookings/${createdBooking.bookingId}`, { token: customerToken });
  assert(detailRes.status === 200, 'GET /bookings/:id failed');
  assert(detailRes.body.data.hotel.name === targetHotel.name, 'Hotel mismatch in booking details');
  console.log(`  ✔ Booking detail endpoint verified for reference ${createdBooking.bookingId}`);

  const partnerBookingsRes = await request<{ items: BookingItem[] }>('/partner/bookings', { token: partnerToken });
  assert(partnerBookingsRes.status === 200, 'GET /partner/bookings failed');
  const foundInPartner = partnerBookingsRes.body.data.items.some((b) => b.bookingId === createdBooking.bookingId);
  assert(foundInPartner, 'Created booking not found in partner portal');
  console.log(`  ✔ Booking visible to Partner in /partner/bookings\n`);

  // STEP 10: Cancellation Flow & Inventory Restoration (Task 7)
  console.log('[10/10] Verifying Cancellation & Inventory Restoration...');
  const cancelRes = await request<BookingItem>(`/bookings/${createdBooking.bookingId}/cancel`, {
    method: 'PATCH',
    token: customerToken,
    body: { cancellationReason: 'Testing cancellation & inventory restoration' },
  });
  assert(cancelRes.status === 200, `PATCH /bookings/:id/cancel failed with status ${cancelRes.status}`);
  assert(cancelRes.body.data.bookingStatus === 'CANCELLED', `Expected status CANCELLED, got ${cancelRes.body.data.bookingStatus}`);
  assert(Boolean(cancelRes.body.data.cancelledAt), 'cancelledAt timestamp is missing');
  console.log(`  ✔ Booking cancelled successfully (cancelledAt: ${cancelRes.body.data.cancelledAt})`);

  // Verify inventory restored
  const availRes3 = await request<{ rooms: RoomItem[] }>(`/hotels/${targetHotel.id}/rooms/availability?checkIn=${checkInDate}&checkOut=${checkOutDate}&rooms=1&guests=2`);
  assert(availRes3.status === 200, 'GET room availability check 3 failed');
  const availRoom3 = availRes3.body.data.rooms.find((r) => r.id === targetRoom.id);
  assert(Boolean(availRoom3 && availRoom3.availableRooms === initialAvailable), `Expected inventory restored to ${initialAvailable}, got ${availRoom3?.availableRooms}`);
  console.log(`  ✔ Room inventory restored to ${initialAvailable} rooms after cancellation.\n`);

  console.log('====================================================');
  console.log(' ALL 10 E2E VERIFICATION STEPS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runVerification()
  .catch((err) => {
    console.error('\n❌ E2E VERIFICATION FAILED:');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });
