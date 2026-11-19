import { useAuthStore } from '@/store/authStore';
import * as authApi from '@/services/api/authApi';
import * as secureStorage from '@/services/storage/secureStorage';
import { apiRequest, ApiRequestError } from '@/services/api/client';
import type { AuthResponse, AuthUser } from '@/types/auth';

// Mock in-memory secure storage
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const mockUser: AuthUser = {
  id: 'user-uuid-123',
  fullName: 'Alex Morgan',
  email: 'customer@trumitrip.dev',
  phone: '+1-555-0200',
  role: 'CUSTOMER',
  avatar: null,
  isActive: true,
  isEmailVerified: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const mockAuthResponse: AuthResponse = {
  user: mockUser,
  accessToken: 'header.payload-access-1.signature',
  refreshToken: 'refresh-token-hex-123456',
};

describe('Mobile Authentication & Session Store Tests', () => {
  beforeEach(() => {
    mockStore.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      requiresReauth: false,
    });
    jest.clearAllMocks();
  });

  describe('1. Secure Storage for Access and Refresh Tokens', () => {
    it('saves and retrieves both access and refresh tokens securely', async () => {
      await secureStorage.saveTokens({
        accessToken: 'access-token-val',
        refreshToken: 'refresh-token-val',
      });

      expect(await secureStorage.getAccessToken()).toBe('access-token-val');
      expect(await secureStorage.getRefreshToken()).toBe('refresh-token-val');
    });

    it('clears both tokens on clearAllTokens()', async () => {
      await secureStorage.saveTokens({
        accessToken: 'access-token-val',
        refreshToken: 'refresh-token-val',
      });

      await secureStorage.clearAllTokens();
      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
    });
  });

  describe('2. Login and Registration Flows', () => {
    it('login stores both access and refresh tokens and sets authenticated user', async () => {
      jest.spyOn(authApi, 'login').mockResolvedValueOnce(mockAuthResponse);

      await useAuthStore.getState().login({
        email: 'customer@trumitrip.dev',
        password: 'CustomerPass123!',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('header.payload-access-1.signature');

      // Verify tokens in secure storage
      expect(await secureStorage.getAccessToken()).toBe('header.payload-access-1.signature');
      expect(await secureStorage.getRefreshToken()).toBe('refresh-token-hex-123456');
    });

    it('register stores both tokens and sets authenticated user', async () => {
      jest.spyOn(authApi, 'register').mockResolvedValueOnce(mockAuthResponse);

      await useAuthStore.getState().register({
        fullName: 'Alex Morgan',
        email: 'customer@trumitrip.dev',
        password: 'CustomerPass123!',
        confirmPassword: 'CustomerPass123!',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(await secureStorage.getRefreshToken()).toBe('refresh-token-hex-123456');
    });
  });

  describe('3. Logout & Token Revocation', () => {
    it('logout passes refresh token to API and wipes local secure storage', async () => {
      await secureStorage.saveTokens({
        accessToken: 'access-to-revoke',
        refreshToken: 'refresh-to-revoke',
      });
      useAuthStore.setState({
        user: mockUser,
        token: 'access-to-revoke',
        isAuthenticated: true,
      });

      const logoutSpy = jest.spyOn(authApi, 'logout').mockResolvedValueOnce();

      await useAuthStore.getState().logout();

      expect(logoutSpy).toHaveBeenCalledWith('refresh-to-revoke');
      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe('4. Session Restoration & Transparent Token Refresh', () => {
    it('restores existing valid session successfully', async () => {
      await secureStorage.saveTokens({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
      });

      jest.spyOn(authApi, 'getMe').mockResolvedValueOnce(mockUser);

      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.isInitialized).toBe(true);
    });

    it('clears session when access token and refresh token are both revoked or invalid (401)', async () => {
      await secureStorage.saveTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'revoked-refresh-token',
      });

      jest.spyOn(authApi, 'getMe').mockRejectedValueOnce(
        new ApiRequestError('Session expired', 401)
      );

      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(await secureStorage.getAccessToken()).toBeNull();
      expect(await secureStorage.getRefreshToken()).toBeNull();
    });
  });

  describe('5. API Client Silent Refresh & Infinite Loop Prevention', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('silently refreshes expired access token on 401 and transparently retries request', async () => {
      await secureStorage.saveTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
      });

      let callCount = 0;
      global.fetch = jest.fn(async (url: any, opts: any) => {
        const urlStr = String(url);
        callCount++;

        // Initial protected request with expired access token -> returns 401
        if (urlStr.includes('/api/bookings') && callCount === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ success: false, message: 'Session expired' }),
          } as Response;
        }

        // Silent refresh request -> returns new tokens
        if (urlStr.includes('/auth/refresh')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                accessToken: 'fresh-rotated-access-token',
                refreshToken: 'fresh-rotated-refresh-token',
              },
            }),
          } as Response;
        }

        // Retried protected request with fresh access token -> succeeds!
        if (urlStr.includes('/api/bookings') && callCount === 3) {
          expect(opts.headers.get('Authorization')).toBe('Bearer fresh-rotated-access-token');
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: [{ id: 'booking-1' }] }),
          } as Response;
        }

        return { ok: false, status: 500 } as Response;
      });

      const result = await apiRequest<{ success: true; data: any[] }>('/api/bookings');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 'booking-1' }]);

      // Verify tokens were rotated in secure storage
      expect(await secureStorage.getAccessToken()).toBe('fresh-rotated-access-token');
      expect(await secureStorage.getRefreshToken()).toBe('fresh-rotated-refresh-token');
    });

    it('does NOT attempt refresh on 401 from /auth/refresh (prevents infinite loops)', async () => {
      await secureStorage.saveTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'dead-refresh-token',
      });

      let refreshAttempts = 0;
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshAttempts++;
          return {
            ok: false,
            status: 401,
            json: async () => ({ success: false, message: 'Refresh token has expired' }),
          } as Response;
        }
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      });

      await expect(
        authApi.refreshToken('dead-refresh-token')
      ).rejects.toThrow();

      // Ensure /auth/refresh 401 was called exactly once and never recursed into an infinite loop
      expect(refreshAttempts).toBe(1);
    });
  });
});
