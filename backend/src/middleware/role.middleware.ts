import type { RequestHandler } from 'express';

import { getPrismaClient } from '../config/prisma.js';
import type { UserRole } from '../types/api.js';
import { ApiError } from '../utils/ApiError.js';

/** Always authorize from the current persisted backend role, never a request field. */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    const user = await getPrismaClient().user.findUnique({
      where: { id: req.auth.userId },
      select: { role: true, isActive: true },
    });

    if (!user?.isActive) {
      next(new ApiError(401, 'Authenticated user is not active'));
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      next(new ApiError(403, 'You do not have permission to access this resource'));
      return;
    }

    next();
  };
}
