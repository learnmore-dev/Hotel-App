import type { RequestHandler } from 'express';

import type { ApiSuccess } from '../types/api.js';
import * as hotelService from '../services/hotel.service.js';
import * as roomService from '../services/room.service.js';

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function queryFromRequest(query: Record<string, unknown>): hotelService.HotelQuery {
  const text = (key: string): string | undefined => typeof query[key] === 'string' ? query[key] as string : undefined;
  const number = (key: string): number | undefined => {
    const value = text(key);
    return value === undefined ? undefined : Number(value);
  };
  const featuredValue = text('featured');
  const sortValue = text('sort');
  const allowedSorts: hotelService.HotelSort[] = ['price_asc', 'price_desc', 'rating', 'popular', 'newest'];
  return {
    search: text('search'),
    city: text('city'),
    destination: text('destination'),
    minPrice: number('minPrice'),
    maxPrice: number('maxPrice'),
    starRating: number('starRating'),
    featured: featuredValue === undefined ? undefined : featuredValue === 'true',
    amenities: text('amenities'),
    page: number('page'),
    limit: number('limit'),
    sort: allowedSorts.find((value) => value === sortValue),
  };
}

function hotelId(req: Parameters<RequestHandler>[0]): string {
  const value = req.params.id;
  if (Array.isArray(value)) throw new Error('Invalid hotel ID');
  return value;
}

function hotelInput(body: unknown): hotelService.HotelWriteInput {
  return body as hotelService.HotelWriteInput;
}

function userId(req: Parameters<RequestHandler>[0]): string {
  return req.auth!.userId;
}

export const getHotels = asyncHandler(async (req, res) => {
  const data = await hotelService.searchActiveHotels(queryFromRequest(req.query as Record<string, unknown>));
  const response: ApiSuccess<typeof data> = { success: true, message: 'Hotels retrieved', data };
  res.json(response);
});

export const getFeaturedHotels = asyncHandler(async (req, res) => {
  const data = await hotelService.listFeaturedHotels(queryFromRequest(req.query as Record<string, unknown>));
  res.json({ success: true, message: 'Featured hotels retrieved', data });
});

export const getDestinations = asyncHandler(async (_req, res) => {
  const data = await hotelService.listDestinations();
  res.json({ success: true, message: 'Destinations retrieved', data });
});

export const getHotelById = asyncHandler(async (req, res) => {
  const data = await hotelService.findActiveHotelById(hotelId(req));
  res.json({ success: true, message: 'Hotel retrieved', data });
});

export const getPartnerHotels = asyncHandler(async (req, res) => {
  const data = await hotelService.listPartnerHotels(userId(req), queryFromRequest(req.query as Record<string, unknown>));
  res.json({ success: true, message: 'Partner hotels retrieved', data });
});

export const createPartnerHotel = asyncHandler(async (req, res) => {
  const data = await hotelService.createPartnerHotel(userId(req), hotelInput(req.body));
  res.status(201).json({ success: true, message: 'Hotel created and awaiting activation', data });
});

export const getPartnerHotelById = asyncHandler(async (req, res) => {
  const data = await hotelService.findPartnerHotelById(userId(req), hotelId(req));
  res.json({ success: true, message: 'Hotel retrieved', data });
});

export const updatePartnerHotel = asyncHandler(async (req, res) => {
  const data = await hotelService.updatePartnerHotel(userId(req), hotelId(req), hotelInput(req.body));
  res.json({ success: true, message: 'Hotel updated', data });
});

export const updatePartnerHotelStatus = asyncHandler(async (req, res) => {
  const data = await hotelService.updatePartnerHotelStatus(userId(req), hotelId(req), req.body.isActive as boolean);
  res.json({ success: true, message: 'Hotel status updated', data });
});

export const getAdminHotels = asyncHandler(async (req, res) => {
  const data = await hotelService.listAdminHotels(queryFromRequest(req.query as Record<string, unknown>));
  res.json({ success: true, message: 'Hotels retrieved', data });
});

export const getAdminHotelById = asyncHandler(async (req, res) => {
  const data = await hotelService.findAdminHotelById(hotelId(req));
  res.json({ success: true, message: 'Hotel retrieved', data });
});

export const updateAdminHotelStatus = asyncHandler(async (req, res) => {
  const data = await hotelService.updateAdminHotelStatus(hotelId(req), req.body.isActive as boolean);
  res.json({ success: true, message: 'Hotel status updated', data });
});

export const updateAdminHotelFeatured = asyncHandler(async (req, res) => {
  const data = await hotelService.updateAdminHotelFeatured(hotelId(req), req.body.isFeatured as boolean);
  res.json({ success: true, message: 'Hotel featured status updated', data });
});

export const getHotelRoomAvailability = asyncHandler(async (req, res) => {
  const checkIn = typeof req.query.checkIn === 'string' ? req.query.checkIn : '';
  const checkOut = typeof req.query.checkOut === 'string' ? req.query.checkOut : '';
  const guests = req.query.guests !== undefined ? Number(req.query.guests) : 1;
  const rooms = req.query.rooms !== undefined ? Number(req.query.rooms) : 1;

  const data = await roomService.findAvailableRooms(hotelId(req), {
    checkIn,
    checkOut,
    guests,
    rooms,
  });

  res.json({ success: true, message: 'Available rooms retrieved', data });
});
