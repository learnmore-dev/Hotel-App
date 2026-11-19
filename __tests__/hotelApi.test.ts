import { getMe } from '@/services/api/authApi';
import * as client from '@/services/api/client';
import { uploadPartnerHotelImages } from '@/services/api/hotelApi';
import type { AuthUser } from '@/types/auth';

const mockBytes = jest.fn(async () => new Uint8Array([1, 2, 3]));
const mockFileCtor = jest.fn((uri: string) => ({
  uri,
  name: uri.split('/').pop() ?? 'fallback.png',
  type: 'image/png',
  bytes: mockBytes,
}));

jest.mock('expo-file-system', () => ({
  File: function File(uri: string) {
    return mockFileCtor(uri);
  },
}));

describe('hotelApi & authApi compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds Expo Fetch compatible FormData parts when uploading hotel images on native', async () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    const apiSpy = jest.spyOn(client, 'apiRequest').mockResolvedValueOnce({
      success: true,
      data: {
        images: [
          {
            name: 'lobby.jpg',
            path: 'hotel_images/lobby.jpg',
            url: 'http://10.0.2.2:5000/media/hotel_images/lobby.jpg',
          },
          {
            name: 'photo',
            path: 'hotel_images/photo.png',
            url: 'http://10.0.2.2:5000/media/hotel_images/photo.png',
          },
        ],
      },
    });

    const result = await uploadPartnerHotelImages([
      {
        uri: 'file:///cache/ImagePicker/picked.tmp',
        fileName: 'lobby.jpg',
        mimeType: 'image/jpg',
      },
      {
        uri: 'content://media/picker/0/com.android.providers.media.photopicker/media/100',
        fileName: 'photo',
        mimeType: 'image/png',
      },
    ]);

    expect(mockFileCtor).toHaveBeenNthCalledWith(1, 'file:///cache/ImagePicker/picked.tmp');
    expect(mockFileCtor).toHaveBeenNthCalledWith(
      2,
      'content://media/picker/0/com.android.providers.media.photopicker/media/100',
    );
    expect(apiSpy).toHaveBeenCalledWith(
      '/partner/hotels/images',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const part1 = appendSpy.mock.calls[0]?.[1] as unknown as {
      name: string;
      type: string;
      bytes: () => Promise<Uint8Array>;
      uri?: string;
    };
    const part2 = appendSpy.mock.calls[1]?.[1] as unknown as {
      name: string;
      type: string;
      bytes: () => Promise<Uint8Array>;
      uri?: string;
    };

    expect(appendSpy.mock.calls[0]?.[0]).toBe('images');
    expect(part1.uri).toBeUndefined();
    expect(part1.name).toBe('lobby.jpg');
    expect(part1.type).toBe('image/jpeg');
    await expect(part1.bytes()).resolves.toEqual(new Uint8Array([1, 2, 3]));

    expect(appendSpy.mock.calls[1]?.[0]).toBe('images');
    expect(part2.uri).toBeUndefined();
    expect(part2.name).toBe('photo.png');
    expect(part2.type).toBe('image/png');
    expect(mockBytes).toHaveBeenCalledTimes(1);

    expect(result).toHaveLength(2);
    expect(result[0].url).toContain('/media/hotel_images/lobby.jpg');

    appendSpy.mockRestore();
    apiSpy.mockRestore();
  });

  it('unwraps both wrapped and direct user payloads in authApi.getMe', async () => {
    const partnerUser: AuthUser = {
      id: 'partner-1',
      fullName: 'Partner User',
      email: 'partner@trumitrip.dev',
      phone: null,
      role: 'PARTNER',
      avatar: null,
      isActive: true,
      isEmailVerified: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const apiSpy = jest
      .spyOn(client, 'apiRequest')
      .mockResolvedValueOnce({ success: true, data: { user: partnerUser } })
      .mockResolvedValueOnce({ success: true, data: partnerUser });

    await expect(getMe()).resolves.toEqual(partnerUser);
    await expect(getMe()).resolves.toEqual(partnerUser);

    apiSpy.mockRestore();
  });
});
