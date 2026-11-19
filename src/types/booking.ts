export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type BookingPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type GuestDetails = {
  fullName: string;
  email: string;
  phone: string;
};

export type BookingHotel = {
  id: string;
  name: string;
  city: string;
  destination?: string | null;
  address: string;
  mainImage?: string | null;
  starRating?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  partner?: { businessName: string };
};

export type BookingRoom = {
  id: string;
  roomType: string;
  pricePerNight: number | string;
  maxGuests: number;
  bedType?: string | null;
  images?: string[];
  amenities?: string[];
};

export type Booking = {
  id: string;
  bookingId: string;
  idempotencyKey?: string | null;
  customerId: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  guestsCount: number;
  guestDetails: GuestDetails;
  specialRequests?: string | null;
  numberOfNights: number;
  roomPrice: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  currency?: string;
  bookingStatus: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  hotel?: BookingHotel;
  room?: BookingRoom;
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    description?: string | null;
  } | null;
  customer?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
};

export type CreateBookingPayload = {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  guestsCount: number;
  guestDetails: GuestDetails;
  specialRequests?: string;
  idempotencyKey?: string;
  couponCode?: string;
};

export type BookingQuery = {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  hotelId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  timeFilter?: 'upcoming' | 'past' | 'cancelled';
};

export type BookingPage = {
  items: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AvailableRoom = {
  id: string;
  hotelId: string;
  roomType: string;
  description: string | null;
  pricePerNight: number | string;
  maxGuests: number;
  bedType: string | null;
  amenities: string[];
  inclusions: string[];
  images: string[];
  availableRooms: number;
  requestedRooms?: number;
  status: string;
};

export type AvailableRoomsData = {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: AvailableRoom[];
};
