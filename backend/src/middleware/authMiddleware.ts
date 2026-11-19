import type { RequestHandler } from 'express';

import { authenticate } from './auth.middleware.js';

/** Backwards-compatible name retained for existing route imports. */
export const authMiddleware: RequestHandler = authenticate;
