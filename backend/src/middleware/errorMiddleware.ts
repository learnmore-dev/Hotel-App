import type { ErrorRequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

import { ApiError } from '../utils/ApiError.js';
import type { ApiErrorResponse } from '../types/api.js';

export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  void _next;
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: ApiErrorResponse['errors'] = [];

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this value already exists';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    statusCode = 404;
    message = 'Requested record was not found';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    statusCode = 400;
    message = 'A related record is invalid';
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid request data';
  } else if (error instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    message = 'Session expired';
  } else if (error instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (statusCode >= 500) {
    console.error('[api] Request failed:', error instanceof Error ? error.name : 'Unknown error');
  }

  const response: ApiErrorResponse = { success: false, message, errors };
  res.status(statusCode).json(response);
};
