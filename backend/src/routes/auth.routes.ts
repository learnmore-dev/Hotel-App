import { Router } from 'express';

import { getMe, login, logout, refresh, register } from '../controllers/auth.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authRateLimiter, tokenRefreshLimiter } from '../middleware/rateLimit.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginValidation, refreshTokenValidation, registerValidation } from '../validators/auth.validators.js';

const authRouter = Router();

authRouter.post('/register', authRateLimiter, registerValidation, validateRequest, register);
authRouter.post('/login', authRateLimiter, loginValidation, validateRequest, login);
authRouter.post('/refresh', tokenRefreshLimiter, refreshTokenValidation, validateRequest, refresh);
authRouter.get('/me', authenticate, getMe);
authRouter.post('/logout', optionalAuthenticate, logout);

export default authRouter;
