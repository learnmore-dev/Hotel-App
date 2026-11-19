import { validationResult } from 'express-validator';
import type { RequestHandler } from 'express';

import { ApiError } from '../utils/ApiError.js';

export const validateRequest: RequestHandler = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }

  const errors = result.array().map((error) => ({
    field: 'path' in error ? error.path : undefined,
    message: error.msg instanceof Error ? error.msg.message : String(error.msg),
  }));

  next(new ApiError(400, 'Validation failed', errors));
};
