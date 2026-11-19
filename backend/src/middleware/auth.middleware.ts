import type { RequestHandler } from 'express';

import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  try {
    req.auth = verifyAccessToken(match[1]);
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (match) {
    try {
      req.auth = verifyAccessToken(match[1]);
    } catch {
      // Ignore invalid token for optional routes
    }
  }
  next();
};
