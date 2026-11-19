import { apiRequest } from './client';
import type { AuthResponse, AuthUser, LoginCredentials, RegisterCredentials } from '@/types/auth';

type ApiEnvelope<TData> = { success: true; message: string; data: TData };

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await apiRequest<ApiEnvelope<AuthResponse>>('/auth/register', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify(credentials),
  });
  return response.data;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiRequest<ApiEnvelope<AuthResponse>>('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify(credentials),
  });
  return response.data;
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiRequest<ApiEnvelope<AuthUser | { user: AuthUser }>>('/auth/me');
  return 'user' in response.data ? response.data.user : response.data;
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  const response = await apiRequest<ApiEnvelope<AuthResponse>>('/auth/refresh', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ refreshToken: token }),
  });
  return response.data;
}

export async function logout(token?: string | null): Promise<void> {
  await apiRequest<ApiEnvelope<Record<string, never>>>('/auth/logout', {
    method: 'POST',
    authenticated: true,
    body: token ? JSON.stringify({ refreshToken: token }) : undefined,
  });
}
