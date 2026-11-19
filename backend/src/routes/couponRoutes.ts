import { Router } from 'express';

import * as couponController from '../controllers/coupon.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateCouponValidation } from '../validators/coupon.validators.js';

const couponRouter = Router();

// Customer coupon validation endpoint (Step 4: Authenticated CUSTOMER only)
couponRouter.post(
  '/validate',
  authenticate,
  requireRole('CUSTOMER'),
  validateCouponValidation,
  validateRequest,
  couponController.validateCoupon,
);

// Active offers endpoint (Step 11)
couponRouter.get('/offers', couponController.getActiveOffers);

export default couponRouter;
