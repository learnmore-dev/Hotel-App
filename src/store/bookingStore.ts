import { create } from 'zustand';

import * as bookingApi from '@/services/api/bookingApi';
import * as couponApi from '@/services/api/couponApi';
import type { Booking, CreateBookingPayload, GuestDetails } from '@/types/booking';
import type { ValidatedCouponResult } from '@/types/coupon';
import type { Hotel, HotelRoom } from '@/types/hotel';

function getInitialDates() {
  const today = new Date();
  const checkInDate = new Date(today);
  checkInDate.setDate(today.getDate() + 1);
  const checkOutDate = new Date(today);
  checkOutDate.setDate(today.getDate() + 2);

  const format = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    checkIn: format(checkInDate),
    checkOut: format(checkOutDate),
  };
}

function generateRandomKey(): string {
  return 'idem-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

type BookingState = {
  selectedHotel: Hotel | null;
  selectedRoom: HotelRoom | null;
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  guestsCount: number;
  guestDetails: GuestDetails;
  specialRequests: string;
  idempotencyKey: string | null;
  isSubmitting: boolean;
  lastBooking: Booking | null;
  error: string | null;

  // Coupon state
  couponCode: string | null;
  appliedCoupon: ValidatedCouponResult['coupon'] | null;
  discountAmount: number;
  couponError: string | null;
  isApplyingCoupon: boolean;

  setDates: (checkIn: string, checkOut: string) => void;
  setCounts: (roomsCount: number, guestsCount: number) => void;
  setSelectedRoom: (hotel: Hotel, room: HotelRoom) => void;
  setGuestDetail: (field: keyof GuestDetails, value: string) => void;
  setSpecialRequests: (requests: string) => void;
  initGuestDetailsFromUser: (user: { fullName?: string; email?: string; phone?: string | null } | null) => void;
  ensureIdempotencyKey: () => string;
  applyCoupon: (code: string, baseAmount: number) => Promise<boolean>;
  removeCoupon: () => void;
  submitBooking: () => Promise<Booking>;
  resetDraft: () => void;
};

const initialDates = getInitialDates();

export const useBookingStore = create<BookingState>((set, get) => ({
  selectedHotel: null,
  selectedRoom: null,
  checkIn: initialDates.checkIn,
  checkOut: initialDates.checkOut,
  roomsCount: 1,
  guestsCount: 2,
  guestDetails: { fullName: '', email: '', phone: '' },
  specialRequests: '',
  idempotencyKey: null,
  isSubmitting: false,
  lastBooking: null,
  error: null,

  couponCode: null,
  appliedCoupon: null,
  discountAmount: 0,
  couponError: null,
  isApplyingCoupon: false,

  setDates: (checkIn, checkOut) => set({ checkIn, checkOut }),

  setCounts: (roomsCount, guestsCount) => set({ roomsCount, guestsCount }),

  setSelectedRoom: (hotel, room) =>
    set({
      selectedHotel: hotel,
      selectedRoom: room,
      idempotencyKey: get().idempotencyKey || generateRandomKey(),
      error: null,
    }),

  setGuestDetail: (field, value) =>
    set((state) => ({
      guestDetails: { ...state.guestDetails, [field]: value },
    })),

  setSpecialRequests: (specialRequests) => set({ specialRequests }),

  initGuestDetailsFromUser: (user) => {
    if (!user) return;
    set((state) => ({
      guestDetails: {
        fullName: state.guestDetails.fullName || user.fullName || '',
        email: state.guestDetails.email || user.email || '',
        phone: state.guestDetails.phone || user.phone || '',
      },
    }));
  },

  ensureIdempotencyKey: () => {
    let key = get().idempotencyKey;
    if (!key) {
      key = generateRandomKey();
      set({ idempotencyKey: key });
    }
    return key;
  },

  applyCoupon: async (code: string, baseAmount: number) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      set({ couponError: 'Please enter a coupon code', appliedCoupon: null, discountAmount: 0, couponCode: null });
      return false;
    }

    set({ isApplyingCoupon: true, couponError: null });

    try {
      const result = await couponApi.validateCoupon(trimmed, baseAmount);
      set({
        appliedCoupon: result.coupon,
        couponCode: result.coupon.code,
        discountAmount: result.coupon.discountAmount,
        couponError: null,
        isApplyingCoupon: false,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid coupon code';
      set({
        appliedCoupon: null,
        couponCode: null,
        discountAmount: 0,
        couponError: message,
        isApplyingCoupon: false,
      });
      return false;
    }
  },

  removeCoupon: () => {
    set({
      couponCode: null,
      appliedCoupon: null,
      discountAmount: 0,
      couponError: null,
    });
  },

  submitBooking: async () => {
    const {
      selectedHotel,
      selectedRoom,
      checkIn,
      checkOut,
      roomsCount,
      guestsCount,
      guestDetails,
      specialRequests,
      appliedCoupon,
      isSubmitting,
      ensureIdempotencyKey,
    } = get();

    if (isSubmitting) {
      throw new Error('A booking request is already in progress.');
    }

    if (!selectedHotel || !selectedRoom) {
      throw new Error('Please select a hotel and room first.');
    }

    const idempotencyKey = ensureIdempotencyKey();

    set({ isSubmitting: true, error: null });

    const payload: CreateBookingPayload = {
      hotelId: selectedHotel.id,
      roomId: selectedRoom.id,
      checkIn,
      checkOut,
      roomsCount,
      guestsCount,
      guestDetails,
      specialRequests: specialRequests.trim() || undefined,
      idempotencyKey,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
    };

    try {
      const booking = await bookingApi.createBooking(payload);
      set({ lastBooking: booking, isSubmitting: false });
      return booking;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to create your booking right now. Please try again.';
      set({ isSubmitting: false, error: message });
      throw err;
    }
  },

  resetDraft: () => {
  const freshDates = getInitialDates();
  set({
    selectedHotel: null,
    selectedRoom: null,
    checkIn: freshDates.checkIn,
    checkOut: freshDates.checkOut,
    roomsCount: 1,
    guestsCount: 2,
    guestDetails: { fullName: '', email: '', phone: '' },
    specialRequests: '',
    idempotencyKey: null,
    isSubmitting: false,
    lastBooking: null,
    error: null,
    couponCode: null,
    appliedCoupon: null,
    discountAmount: 0,
    couponError: null,
    isApplyingCoupon: false,
  });
},
}));
