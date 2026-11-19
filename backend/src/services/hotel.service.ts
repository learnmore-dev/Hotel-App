import type { Prisma } from '@prisma/client';

import { getPrismaClient } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export type HotelSort = 'price_asc' | 'price_desc' | 'rating' | 'popular' | 'newest';

export type HotelQuery = {
  search?: string;
  city?: string;
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  starRating?: number;
  featured?: boolean;
  amenities?: string;
  page?: number;
  limit?: number;
  sort?: HotelSort;
};

export type HotelWriteInput = {
  name?: string;
  description?: string;
  city?: string;
  destination?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  starRating?: number;
  pricePerNight?: number;
  originalPrice?: number;
  mainImage?: string | null;
  galleryImages?: string[];
  amenities?: string[];
  checkInTime?: string;
  checkOutTime?: string;
};

const hotelSummarySelect = {
  id: true,
  name: true,
  description: true,
  city: true,
  destination: true,
  address: true,
  latitude: true,
  longitude: true,
  starRating: true,
  ratingScore: true,
  reviewCount: true,
  pricePerNight: true,
  originalPrice: true,
  mainImage: true,
  galleryImages: true,
  amenities: true,
  checkInTime: true,
  checkOutTime: true,
  isFeatured: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  partner: { select: { businessName: true } },
} satisfies Prisma.HotelSelect;

const roomSelect = {
  id: true,
  roomType: true,
  description: true,
  pricePerNight: true,
  maxGuests: true,
  bedType: true,
  amenities: true,
  inclusions: true,
  images: true,
  availableRooms: true,
} satisfies Prisma.RoomSelect;

type Page<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

function normalizeQuery(query: HotelQuery) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 10, 50);
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    throw new ApiError(400, 'minPrice cannot be greater than maxPrice');
  }

  const where: Prisma.HotelWhereInput = {};
  if (query.search) {
    where.OR = ['name', 'city', 'destination', 'address'].map((field) => ({
      [field]: { contains: query.search, mode: 'insensitive' },
    }));
  }
  if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
  if (query.destination) where.destination = { contains: query.destination, mode: 'insensitive' };
  if (query.starRating !== undefined) where.starRating = query.starRating;
  if (query.featured !== undefined) where.isFeatured = query.featured;

  const price: Prisma.DecimalFilter<'Hotel'> = {};
  if (query.minPrice !== undefined) price.gte = query.minPrice;
  if (query.maxPrice !== undefined) price.lte = query.maxPrice;
  if (Object.keys(price).length) where.pricePerNight = price;

  const amenities = query.amenities
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (amenities?.length) {
    if (amenities.length > 20 || amenities.some((value) => value.length > 80)) {
      throw new ApiError(400, 'Use up to 20 amenity filters of 80 characters or fewer');
    }
    where.amenities = { hasEvery: amenities };
  }

  const orderBy: Prisma.HotelOrderByWithRelationInput[] = (() => {
    switch (query.sort) {
      case 'price_asc':
        return [{ pricePerNight: 'asc' }, { createdAt: 'desc' }];
      case 'price_desc':
        return [{ pricePerNight: 'desc' }, { createdAt: 'desc' }];
      case 'rating':
        return [{ ratingScore: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'desc' }];
      case 'popular':
        return [{ reviewCount: 'desc' }, { ratingScore: 'desc' }, { createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }];
    }
  })();

  return { page, limit, where, orderBy };
}

function getPagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function listHotels(where: Prisma.HotelWhereInput, query: HotelQuery): Promise<Page<unknown>> {
  const { page, limit, orderBy, where: queryWhere } = normalizeQuery(query);
  const prisma = getPrismaClient();
  const fullWhere: Prisma.HotelWhereInput = { ...where, ...queryWhere };
  const [items, total] = await prisma.$transaction([
    prisma.hotel.findMany({
      where: fullWhere,
      select: hotelSummarySelect,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.hotel.count({ where: fullWhere }),
  ]);
  return { items, pagination: getPagination(page, limit, total) };
}

export async function searchActiveHotels(query: HotelQuery) {
  return listHotels({ isActive: true }, query);
}

export async function listFeaturedHotels(query: HotelQuery) {
  return listHotels({ isActive: true, isFeatured: true }, query);
}

export async function listDestinations(): Promise<string[]> {
  const where: Prisma.HotelWhereInput = { isActive: true };
  const [cities, destinations] = await Promise.all([
    getPrismaClient().hotel.groupBy({ by: ['city'], where, orderBy: { city: 'asc' } }),
    getPrismaClient().hotel.groupBy({
      by: ['destination'],
      where: { ...where, destination: { not: null } },
      orderBy: { destination: 'asc' },
    }),
  ]);
  return [...new Set([...cities.map(({ city }) => city), ...destinations.map(({ destination }) => destination).filter((value): value is string => value !== null)])]
    .sort((left, right) => left.localeCompare(right));
}

export async function findActiveHotelById(id: string) {
  const hotel = await getPrismaClient().hotel.findFirst({
    where: { id, isActive: true },
    select: {
      ...hotelSummarySelect,
      rooms: {
        where: { status: 'AVAILABLE', availableRooms: { gt: 0 } },
        select: roomSelect,
        orderBy: { pricePerNight: 'asc' },
      },
    },
  });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  return hotel;
}

async function getApprovedPartnerProfile(userId: string) {
  const profile = await getPrismaClient().partnerProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile || profile.status !== 'APPROVED') {
    throw new ApiError(403, 'An approved partner profile is required to manage hotels');
  }
  return profile;
}

async function getOwnedHotel(id: string, partnerId: string) {
  const hotel = await getPrismaClient().hotel.findUnique({ where: { id }, select: { id: true, partnerId: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  if (hotel.partnerId !== partnerId) throw new ApiError(403, 'You do not have permission to manage this hotel');
  return hotel;
}

export async function listPartnerHotels(userId: string, query: HotelQuery) {
  const partner = await getApprovedPartnerProfile(userId);
  return listHotels({ partnerId: partner.id }, query);
}

function toCreateData(input: HotelWriteInput, partnerId: string): Prisma.HotelUncheckedCreateInput {
  if (
    input.name === undefined || input.city === undefined || input.destination === undefined || input.address === undefined ||
    input.pricePerNight === undefined
  ) {
    throw new ApiError(400, 'Name, city, destination, address, and pricePerNight are required');
  }
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    city: input.city.trim(),
    destination: input.destination.trim(),
    address: input.address.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    starRating: input.starRating,
    pricePerNight: input.pricePerNight,
    originalPrice: input.originalPrice,
    mainImage: input.mainImage?.trim() || null,
    galleryImages: input.galleryImages?.map((image) => image.trim()) ?? [],
    amenities: input.amenities?.map((amenity) => amenity.trim()) ?? [],
    checkInTime: input.checkInTime,
    checkOutTime: input.checkOutTime,
    partnerId,
    isActive: false,
    isFeatured: false,
  };
}

export async function createPartnerHotel(userId: string, input: HotelWriteInput) {
  const partner = await getApprovedPartnerProfile(userId);
  return getPrismaClient().hotel.create({ data: toCreateData(input, partner.id), select: hotelSummarySelect });
}

export async function findPartnerHotelById(userId: string, id: string) {
  const partner = await getApprovedPartnerProfile(userId);
  await getOwnedHotel(id, partner.id);
  return getPrismaClient().hotel.findUniqueOrThrow({
    where: { id },
    select: {
      ...hotelSummarySelect,
      rooms: { select: roomSelect, orderBy: { pricePerNight: 'asc' } },
    },
  });
}

export async function updatePartnerHotel(userId: string, id: string, input: HotelWriteInput) {
  const partner = await getApprovedPartnerProfile(userId);
  await getOwnedHotel(id, partner.id);

  const data: Prisma.HotelUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.city !== undefined) data.city = input.city.trim();
  if (input.destination !== undefined) data.destination = input.destination.trim();
  if (input.address !== undefined) data.address = input.address.trim();
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  if (input.starRating !== undefined) data.starRating = input.starRating;
  if (input.pricePerNight !== undefined) data.pricePerNight = input.pricePerNight;
  if (input.originalPrice !== undefined) data.originalPrice = input.originalPrice;
  if (input.mainImage !== undefined) data.mainImage = input.mainImage?.trim() || null;
  if (input.galleryImages !== undefined) data.galleryImages = input.galleryImages.map((image) => image.trim());
  if (input.amenities !== undefined) data.amenities = input.amenities.map((amenity) => amenity.trim());
  if (input.checkInTime !== undefined) data.checkInTime = input.checkInTime;
  if (input.checkOutTime !== undefined) data.checkOutTime = input.checkOutTime;

  return getPrismaClient().hotel.update({ where: { id }, data, select: hotelSummarySelect });
}

export async function updatePartnerHotelStatus(userId: string, id: string, isActive: boolean) {
  const partner = await getApprovedPartnerProfile(userId);
  await getOwnedHotel(id, partner.id);
  if (isActive) {
    throw new ApiError(403, 'Only an administrator can activate a hotel');
  }
  return getPrismaClient().hotel.update({
    where: { id },
    data: { isActive: false },
    select: hotelSummarySelect,
  });
}

export async function listAdminHotels(query: HotelQuery) {
  return listHotels({}, query);
}

export async function findAdminHotelById(id: string) {
  const hotel = await getPrismaClient().hotel.findUnique({
    where: { id },
    select: {
      ...hotelSummarySelect,
      rooms: { select: roomSelect, orderBy: { pricePerNight: 'asc' } },
    },
  });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  return hotel;
}

export async function updateAdminHotelStatus(id: string, isActive: boolean) {
  const hotel = await getPrismaClient().hotel.findUnique({ where: { id }, select: { id: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  return getPrismaClient().hotel.update({
    where: { id },
    data: { isActive, ...(isActive ? {} : { isFeatured: false }) },
    select: hotelSummarySelect,
  });
}

export async function updateAdminHotelFeatured(id: string, isFeatured: boolean) {
  const hotel = await getPrismaClient().hotel.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  if (isFeatured && !hotel.isActive) throw new ApiError(400, 'Only active hotels can be featured');
  return getPrismaClient().hotel.update({ where: { id }, data: { isFeatured }, select: hotelSummarySelect });
}

