export type UserRole = 'CUSTOMER' | 'PARTNER' | 'ADMIN';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoginCredentials = { email: string; password: string };

export type RegisterCredentials = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

export type AuthResponse = { user: AuthUser; accessToken: string; refreshToken?: string };

export type ApiErrorDetail = { field?: string; message: string };
