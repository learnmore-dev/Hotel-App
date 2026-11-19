import type { ApiErrorDetail } from '../types/api.js';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errors: ApiErrorDetail[];

  constructor(statusCode: number, message: string, errors: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
