import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { apiRequest } from './client';
import type { ApiEnvelope, Hotel, HotelInput, HotelPage, HotelQuery } from '@/types/hotel';

function queryString(query: HotelQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function getHotels(query?: HotelQuery) {
  return (await apiRequest<ApiEnvelope<HotelPage>>(`/hotels${queryString(query)}`, { authenticated: false })).data;
}
export async function getFeaturedHotels(query?: HotelQuery) {
  return (await apiRequest<ApiEnvelope<HotelPage>>(`/hotels/featured${queryString(query)}`, { authenticated: false })).data;
}
export async function getDestinations() {
  return (await apiRequest<ApiEnvelope<string[]>>('/hotels/destinations', { authenticated: false })).data;
}
export async function getHotelById(id: string) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/hotels/${encodeURIComponent(id)}`, { authenticated: false })).data;
}
export async function getPartnerHotels(query?: HotelQuery) {
  return (await apiRequest<ApiEnvelope<HotelPage>>(`/partner/hotels${queryString(query)}`)).data;
}
export async function getPartnerHotel(id: string) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/partner/hotels/${encodeURIComponent(id)}`)).data;
}
export async function createPartnerHotel(input: HotelInput) {
  return (await apiRequest<ApiEnvelope<Hotel>>('/partner/hotels', { method: 'POST', body: JSON.stringify(input) })).data;
}
export async function updatePartnerHotel(id: string, input: Partial<HotelInput>) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/partner/hotels/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })).data;
}
export async function updatePartnerHotelStatus(id: string, isActive: boolean) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/partner/hotels/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) })).data;
}
export async function getAdminHotels(query?: HotelQuery) {
  return (await apiRequest<ApiEnvelope<HotelPage>>(`/admin/hotels${queryString(query)}`)).data;
}
export async function getAdminHotel(id: string) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/admin/hotels/${encodeURIComponent(id)}`)).data;
}
export async function updateAdminHotelStatus(id: string, isActive: boolean) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/admin/hotels/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) })).data;
}
export async function updateAdminHotelFeatured(id: string, isFeatured: boolean) {
  return (await apiRequest<ApiEnvelope<Hotel>>(`/admin/hotels/${encodeURIComponent(id)}/featured`, { method: 'PATCH', body: JSON.stringify({ isFeatured }) })).data;
}

export type HotelImageUploadAsset = {
  uri: string;
  name?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  file?: Blob | null;
};

type HotelImageUploadResponse = {
  images: {
    name: string;
    path: string;
    url: string;
  }[];
};

const VALID_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function normalizeImageMimeType(mimeType?: string | null): string {
  const normalized = mimeType?.trim().toLowerCase();
  if (!normalized) return 'image/jpeg';
  if (normalized === 'image/jpg') return 'image/jpeg';
  return normalized;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function resolveImageFilename(
  asset: HotelImageUploadAsset,
  index: number,
  fallbackName: string | undefined,
  mimeType: string,
): string {
  const candidate = asset.name?.trim() || asset.fileName?.trim() || fallbackName?.trim();
  const baseName = candidate || `hotel-image-${index}`;
  const dotIndex = baseName.lastIndexOf('.');
  const ext = dotIndex >= 0 ? baseName.slice(dotIndex).toLowerCase() : '';
  if (VALID_IMAGE_EXTENSIONS.has(ext)) {
    return baseName;
  }
  return `${baseName}${extensionForMimeType(mimeType)}`;
}

/** Uploads hotel image assets as multipart FormData parts compatible with Expo Fetch. */
export async function uploadPartnerHotelImages(
  assets: HotelImageUploadAsset[],
) {
  const formData = new FormData();

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];

    if (Platform.OS === 'web') {
      const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
      const mimeType = normalizeImageMimeType(asset.mimeType ?? blob.type);
      const filename = resolveImageFilename(asset, index, undefined, mimeType);
      formData.append('images', blob, filename);
      continue;
    }

    const file = new File(asset.uri);
    const mimeType = normalizeImageMimeType(asset.mimeType ?? file.type);
    const filename = resolveImageFilename(asset, index, file.name, mimeType);

    formData.append(
      'images',
      {
        name: filename,
        type: mimeType,
        bytes: () => file.bytes(),
      } as unknown as Blob,
    );
  }

  const response = await apiRequest<ApiEnvelope<HotelImageUploadResponse>>(
    '/partner/hotels/images',
    {
      method: 'POST',
      body: formData,
    },
  );

  return response.data.images;
}
