import * as authApi from '@/services/api/authApi';
import { setTokenRefreshedHandler, setUnauthorizedHandler } from '@/services/api/authEvents';
import { ApiRequestError } from '@/services/api/client';
import {
  clearAllTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/services/storage/secureStorage';
import type { AuthUser, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { create } from 'zustand';
import { useBookingStore } from './bookingStore';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  requiresReauth: boolean;
  register: (credentials: RegisterCredentials) => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  fetchCurrentUser: () => Promise<AuthUser>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  requiresReauth: false,

  register: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(credentials);
      await saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      set({ user: response.user, token: response.accessToken, isAuthenticated: true, requiresReauth: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(credentials);
      await saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      set({ user: response.user, token: response.accessToken, isAuthenticated: true, requiresReauth: false });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const refreshToken = await getRefreshToken();
      await authApi.logout(refreshToken);
    } catch {
      // Clear local session even if network fails or token was already revoked
    } finally {
      useBookingStore.getState().resetDraft();
      await clearAllTokens().catch(() => undefined);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, requiresReauth: false });
    }
  },

  restoreSession: async () => {
    set({ isLoading: false, requiresReauth: false });
    try {
      const accessToken = await getAccessToken();
      const refreshToken = await getRefreshToken();
      if (!accessToken && !refreshToken) {
        set({ user: null, token: null, isAuthenticated: false });
        return;
      }

      if (accessToken) {
        set({ token: accessToken });
      }

      // getMe() will invoke apiRequest. If accessToken has expired,
      // apiRequest transparently uses the refresh token to rotate and refresh!
      const user = await authApi.getMe();
      const currentToken = (await getAccessToken()) ?? accessToken;
      set({ user, token: currentToken, isAuthenticated: true });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        await clearAllTokens().catch(() => undefined);
        set({ user: null, token: null, isAuthenticated: false });
      } else {
        // Preserve token when API is temporarily unreachable (e.g. offline mode)
        set({ user: null, isAuthenticated: false });
      }
    } finally {
      set({ isInitialized: true, isLoading: false });
    }
  },

  fetchCurrentUser: async () => {
    const user = await authApi.getMe();
    const token = get().token;
    set({ user, isAuthenticated: Boolean(token) });
    return user;
  },
}));

setTokenRefreshedHandler((token: string) => {
  useAuthStore.setState({ token });
});

setUnauthorizedHandler(() => {
  useBookingStore.getState().resetDraft();
  void clearAllTokens().catch(() => undefined);
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false, requiresReauth: true });
});