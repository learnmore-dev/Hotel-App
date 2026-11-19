import type { Prisma, RoomStatus } from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import type { UserRole } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';
import { calculatePeakBookedRooms } from '../utils/roomAvailability.js';

const activeBookingStatuses = ['PENDING', 'CONFIRMED'] as const;

export type RoomAvailabilityQuery = {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

export type RoomInput = {
  roomType?: string;
  description?: string;
  pricePerNight?: number;
  maxGuests?: number;
  bedType?: string;
  amenities?: string[];
  inclusions?: string[];
  images?: string[];
  totalRooms?: number;
  availableRooms?: number;
  blockedRooms?: number;
  status?: RoomStatus;
};

const publicRoomSelect = {
  id: true,
  hotelId: true,
  roomType: true,
  description: true,
  pricePerNight: true,
  maxGuests: true,
  bedType: true,
  amenities: true,
  inclusions: true,
  images: true,
  availableRooms: true,
  status: true,
} satisfies Prisma.RoomSelect;

const managementRoomSelect = {
  ...publicRoomSelect,
  totalRooms: true,
  blockedRooms: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true, city: true, isActive: true } },
} satisfies Prisma.RoomSelect;

type BookingInterval = { checkIn: Date; checkOut: Date; roomsCount: number };

function parseDateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${label} must be a valid calendar date`);
  }
  return date;
}

function parseAvailability(query: RoomAvailabilityQuery) {
  const checkIn = parseDateOnly(query.checkIn, 'checkIn');
  const checkOut = parseDateOnly(query.checkOut, 'checkOut');
  if (checkOut <= checkIn) throw new ApiError(400, 'checkOut must be after checkIn');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (checkIn < today) throw new ApiError(400, 'checkIn cannot be in the past');
  if (!Number.isInteger(query.guests) || query.guests < 1) throw new ApiError(400, 'guests must be a positive integer');
  if (!Number.isInteger(query.rooms) || query.rooms < 1) throw new ApiError(400, 'rooms must be a positive integer');
  return { checkIn, checkOut };
}

function normalizeInventory(input: RoomInput, required: boolean) {
  const totalRooms = input.totalRooms;
  const availableRooms = input.availableRooms;
  const blockedRooms = input.blockedRooms ?? 0;
  if (required && (totalRooms === undefined || availableRooms === undefined)) {
    throw new ApiError(400, 'totalRooms and availableRooms are required');
  }
  if (totalRooms === undefined && availableRooms === undefined && input.blockedRooms === undefined) return undefined;
  if (totalRooms === undefined || availableRooms === undefined) {
    throw new ApiError(400, 'totalRooms and availableRooms must be updated together');
  }
  if (availableRooms + blockedRooms > totalRooms) {
    throw new ApiError(400, 'availableRooms plus blockedRooms cannot exceed totalRooms');
  }
  return { totalRooms, availableRooms, blockedRooms };
}

function toRoomCreateData(input: RoomInput, hotelId: string): Prisma.RoomUncheckedCreateInput {
  if (!input.roomType?.trim() || input.pricePerNight === undefined || input.maxGuests === undefined) {
    throw new ApiError(400, 'roomType, pricePerNight, and maxGuests are required');
  }
  const inventory = normalizeInventory(input, true)!;
  return {
    hotelId,
    roomType: input.roomType.trim(),
    description: input.description?.trim() || null,
    pricePerNight: input.pricePerNight,
    maxGuests: input.maxGuests,
    bedType: input.bedType?.trim() || null,
    amenities: input.amenities?.map((value) => value.trim()) ?? [],
    inclusions: input.inclusions?.map((value) => value.trim()) ?? [],
    images: input.images?.map((value) => value.trim()) ?? [],
    ...inventory,
    status: input.status ?? 'AVAILABLE',
  };
}

async function ensureActiveHotel(hotelId: string) {
  const hotel = await getPrismaClient().hotel.findFirst({ where: { id: hotelId, isActive: true }, select: { id: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
}

async function getApprovedPartner(userId: string) {
  const profile = await getPrismaClient().partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile || profile.status !== 'APPROVED') throw new ApiError(403, 'An approved partner profile is required to manage rooms');
  return profile;
}

async function ensureOwnedHotel(hotelId: string, partnerId: string) {
  const hotel = await getPrismaClient().hotel.findUnique({ where: { id: hotelId }, select: { id: true, partnerId: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  if (hotel.partnerId !== partnerId) throw new ApiError(403, 'You do not have permission to manage rooms for this hotel');
  return hotel;
}

async function getOwnedRoom(roomId: string, partnerId: string) {
  const room = await getPrismaClient().room.findUnique({
    where: { id: roomId },
    select: { ...managementRoomSelect, hotel: { select: { id: true, partnerId: true, name: true, city: true, isActive: true } } },
  });
  if (!room) throw new ApiError(404, 'Room not found');
  if (room.hotel.partnerId !== partnerId) throw new ApiError(403, 'You do not have permission to manage this room');
  return room;
}

async function getRoomBookings(roomId: string, checkIn?: Date, checkOut?: Date): Promise<BookingInterval[]> {
  return getPrismaClient().booking.findMany({
    where: {
      roomId,
      bookingStatus: { in: [...activeBookingStatuses] },
      ...(checkIn && checkOut ? { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } : {}),
    },
    select: { checkIn: true, checkOut: true, roomsCount: true },
  });
}

export async function listCustomerHotelRooms(hotelId: string) {
  await ensureActiveHotel(hotelId);
  return getPrismaClient().room.findMany({
    where: { hotelId, status: 'AVAILABLE', availableRooms: { gt: 0 } },
    select: publicRoomSelect,
    orderBy: [{ pricePerNight: 'asc' }, { roomType: 'asc' }],
  });
}

export async function findCustomerRoomById(id: string) {
  const room = await getPrismaClient().room.findFirst({
    where: { id, status: 'AVAILABLE', availableRooms: { gt: 0 }, hotel: { isActive: true } },
    select: publicRoomSelect,
  });
  if (!room) throw new ApiError(404, 'Room not found');
  return room;
}

export async function findAvailableRooms(hotelId: string, query: RoomAvailabilityQuery) {
  const { checkIn, checkOut } = parseAvailability(query);
  await ensureActiveHotel(hotelId);
  const minRoomCapacity = Math.ceil(query.guests / query.rooms);
  const candidateRooms = await getPrismaClient().room.findMany({
    where: {
      hotelId,
      status: 'AVAILABLE',
      maxGuests: { gte: minRoomCapacity },
      availableRooms: { gt: 0 },
    },
    select: {
      id: true,
      hotelId: true,
      roomType: true,
      description: true,
      pricePerNight: true,
      maxGuests: true,
      bedType: true,
      amenities: true,
      inclusions: true,
      images: true,
      totalRooms: true,
      availableRooms: true,
      blockedRooms: true,
      status: true,
      bookings: {
        where: {
          bookingStatus: { in: [...activeBookingStatuses] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        select: { checkIn: true, checkOut: true, roomsCount: true },
      },
    },
    orderBy: [{ pricePerNight: 'asc' }, { roomType: 'asc' }],
  });

  const rooms = candidateRooms.flatMap((room) => {
    const physicalCapacity = Math.max(0, room.totalRooms - room.blockedRooms);
    // availableRooms is the partner-managed sellable cap. Booking intervals further constrain it for this stay.
    const sellableCapacity = Math.min(room.availableRooms, physicalCapacity);
    const bookedPeak = calculatePeakBookedRooms(room.bookings, { start: checkIn, end: checkOut });
    const availableRooms = Math.max(0, sellableCapacity - bookedPeak);
    if (availableRooms < query.rooms) return [];
    const publicFields = {
      id: room.id,
      hotelId: room.hotelId,
      roomType: room.roomType,
      description: room.description,
      pricePerNight: room.pricePerNight,
      maxGuests: room.maxGuests,
      bedType: room.bedType,
      amenities: room.amenities,
      inclusions: room.inclusions,
      images: room.images,
      status: room.status,
    };
    return [{ ...publicFields, availableRooms, requestedRooms: query.rooms }];
  });

  return { hotelId, checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests, rooms: rooms };
}

export async function listPartnerHotelRooms(userId: string, hotelId: string) {
  const partner = await getApprovedPartner(userId);
  await ensureOwnedHotel(hotelId, partner.id);
  return getPrismaClient().room.findMany({
    where: { hotelId },
    select: managementRoomSelect,
    orderBy: [{ pricePerNight: 'asc' }, { roomType: 'asc' }],
  });
}

export async function createPartnerRoom(userId: string, hotelId: string, input: RoomInput) {
  const partner = await getApprovedPartner(userId);
  await ensureOwnedHotel(hotelId, partner.id);
  return getPrismaClient().room.create({ data: toRoomCreateData(input, hotelId), select: managementRoomSelect });
}

export async function findPartnerRoom(userId: string, id: string) {
  const partner = await getApprovedPartner(userId);
  const room = await getOwnedRoom(id, partner.id);
  const { hotel, ...roomData } = room;
  return { ...roomData, hotel: { id: hotel.id, name: hotel.name, city: hotel.city, isActive: hotel.isActive } };
}

export async function updatePartnerRoom(userId: string, id: string, input: RoomInput) {
  const partner = await getApprovedPartner(userId);
  const room = await getOwnedRoom(id, partner.id);
  const inventoryWasChanged = input.totalRooms !== undefined || input.availableRooms !== undefined || input.blockedRooms !== undefined;
  const inventory = normalizeInventory({
    totalRooms: input.totalRooms ?? room.totalRooms,
    availableRooms: input.availableRooms ?? room.availableRooms,
    blockedRooms: input.blockedRooms ?? room.blockedRooms,
  }, true)!;

  if (inventoryWasChanged) {
    const futureBookings = await getRoomBookings(id);
    const committedPeak = calculatePeakBookedRooms(futureBookings);
    const sellableCapacity = Math.min(inventory.availableRooms, inventory.totalRooms - inventory.blockedRooms);
    if (sellableCapacity < committedPeak) {
      throw new ApiError(400, `Inventory cannot be reduced below ${committedPeak} rooms already committed at the busiest future time`);
    }
  }

  const data: Prisma.RoomUpdateInput = {};
  if (input.roomType !== undefined) data.roomType = input.roomType.trim();
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.pricePerNight !== undefined) data.pricePerNight = input.pricePerNight;
  if (input.maxGuests !== undefined) data.maxGuests = input.maxGuests;
  if (input.bedType !== undefined) data.bedType = input.bedType.trim() || null;
  if (input.amenities !== undefined) data.amenities = input.amenities.map((value) => value.trim());
  if (input.inclusions !== undefined) data.inclusions = input.inclusions.map((value) => value.trim());
  if (input.images !== undefined) data.images = input.images.map((value) => value.trim());
  if (inventoryWasChanged) Object.assign(data, inventory);
  if (input.status !== undefined) data.status = input.status;
  return getPrismaClient().room.update({ where: { id }, data, select: managementRoomSelect });
}

export async function updatePartnerRoomStatus(userId: string, id: string, status: RoomStatus) {
  const partner = await getApprovedPartner(userId);
  await getOwnedRoom(id, partner.id);
  return getPrismaClient().room.update({ where: { id }, data: { status }, select: managementRoomSelect });
}

export async function listAdminHotelRooms(hotelId: string) {
  const hotel = await getPrismaClient().hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  return getPrismaClient().room.findMany({
    where: { hotelId },
    select: managementRoomSelect,
    orderBy: [{ pricePerNight: 'asc' }, { roomType: 'asc' }],
  });
}

export async function findAdminRoom(id: string) {
  const room = await getPrismaClient().room.findUnique({ where: { id }, select: managementRoomSelect });
  if (!room) throw new ApiError(404, 'Room not found');
  return room;
}

export async function updateAdminRoomStatus(id: string, status: RoomStatus) {
  const exists = await getPrismaClient().room.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new ApiError(404, 'Room not found');
  return getPrismaClient().room.update({ where: { id }, data: { status }, select: managementRoomSelect });
}

export function isRoomRole(role: UserRole): boolean {
  return role === 'PARTNER' || role === 'ADMIN';
}
