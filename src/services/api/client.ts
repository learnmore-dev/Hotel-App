import { API_BASE_URL } from '@/constants/config';
import {
  clearAllTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/services/storage/secureStorage';
import type { ApiErrorDetail } from '@/types/auth';
import { notifyTokenRefreshed, notifyUnauthorized } from './authEvents';

type ApiErrorEnvelope = {
  success?: false;
  message?: string;
  detail?: string;
  error?: string;
  errors?: ApiErrorDetail[];
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly errors: ApiErrorDetail[];

  constructor(message: string, status: number, errors: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = errors;
  }
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
  authenticated?: boolean;
  _isRetry?: boolean;
};

function getBaseUrl(): string {
  const baseUrl = API_BASE_URL.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('API URL is not configured. Set EXPO_PUBLIC_API_URL in the mobile environment.');
  return baseUrl;
}

function isAuthEndpoint(path: string): boolean {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/logout')
  );
}

let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearAllTokens().catch(() => undefined);
    notifyUnauthorized();
    return null;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await clearAllTokens().catch(() => undefined);
      notifyUnauthorized();
      return null;
    }

    const payload = await response.json();
    const newAccessToken = payload?.data?.accessToken;
    const newRefreshToken = payload?.data?.refreshToken;

    if (!newAccessToken) {
      await clearAllTokens().catch(() => undefined);
      notifyUnauthorized();
      return null;
    }

    await saveTokens({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    notifyTokenRefreshed(newAccessToken);
    return newAccessToken;
  } catch {
    return null;
  }
}

async function getRefreshedToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { authenticated = true, _isRetry = false, headers: requestHeaders, ...requestOptions } = options;
  const token = authenticated ? await getAccessToken() : null;
  const headers = new Headers(requestHeaders);
  if (
  requestOptions.body &&
  !headers.has('Content-Type') &&
  !(requestOptions.body instanceof FormData)
) {
  headers.set('Content-Type', 'application/json');
}  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, { ...requestOptions, headers });
  } catch {
    throw new ApiRequestError('Unable to reach TrumiTrip. Check your connection and API URL.', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as ApiErrorEnvelope;

    // Handle expired access token automatically: refresh and retry transparently
    if (response.status === 401 && authenticated && !_isRetry && !isAuthEndpoint(path)) {
      const refreshedToken = await getRefreshedToken();
      if (refreshedToken) {
        return apiRequest<TResponse>(path, { ...options, _isRetry: true });
      }
    }

    // If refresh failed, or if already retried and still 401, clear tokens and notify
    if (response.status === 401 && authenticated && (isAuthEndpoint(path) || _isRetry)) {
      if (path.includes('/auth/refresh') || _isRetry) {
        await clearAllTokens().catch(() => undefined);
        notifyUnauthorized();
      }
    }

    throw new ApiRequestError(
      envelope.message || envelope.detail || envelope.error || `Request failed (${response.status})`,
      response.status,
      Array.isArray(envelope.errors) ? envelope.errors : [],
    );
  }

  return payload as TResponse;
}
