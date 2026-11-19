export type Money = string | number;

export type HotelRoom = {
  id: string;
  roomType: string;
  description: string | null;
  pricePerNight: Money;
  maxGuests: number;
  bedType: string | null;
  amenities: string[];
  inclusions: string[];
  images: string[];
  availableRooms?: number;
};

export type Hotel = {
  id: string;
  name: string;
  description: string | null;
  city: string;
  destination: string | null;
  address: string;
  latitude: Money | null;
  longitude: Money | null;
  starRating: number | null;
  ratingScore: Money | null;
  reviewCount: number;
  pricePerNight: Money;
  originalPrice: Money | null;
  mainImage: string | null;
  galleryImages: string[];
  amenities: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  partner: { businessName: string };
  rooms?: HotelRoom[];
};

export type HotelPage = {
  items: Hotel[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type HotelQuery = {
  search?: string;
  city?: string;
  destination?: string;
  minPrice?: number;
  maxPrice?: number;
  starRating?: number;
  featured?: boolean;
  amenities?: string[];
  page?: number;
  limit?: number;
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'popular' | 'newest';
};

export type HotelInput = {
  name: string;
  description?: string;
  city: string;
  destination: string;
  address: string;
  latitude?: number;
  longitude?: number;
  starRating?: number;
  pricePerNight: number;
  originalPrice?: number;
  mainImage?: string | null;
  galleryImages?: string[];
  amenities?: string[];
  checkInTime?: string;
  checkOutTime?: string;
};

export type ApiEnvelope<T> = { success: true; message: string; data: T };
