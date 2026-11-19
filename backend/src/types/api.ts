export type ApiSuccess<TData> = {
  success: true;
  message: string;
  data: TData;
};

export type ApiErrorDetail = {
  field?: string;
  message: string;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors: ApiErrorDetail[];
};

export type UserRole = 'CUSTOMER' | 'PARTNER' | 'ADMIN';

export type AuthContext = {
  userId: string;
  role: UserRole;
};
