import { Router } from 'express';

import adminRouter from './adminRoutes.js';
import authRouter from './auth.routes.js';
import bookingRouter from './bookingRoutes.js';
import couponRouter from './couponRoutes.js';
import healthRouter from './healthRoutes.js';
import hotelRouter from './hotelRoutes.js';
import notificationRouter from './notification.routes.js';
import partnerRouter from './partnerRoutes.js';
import paymentRouter from './paymentRoutes.js';
import reviewRouter from './reviewRoutes.js';
import roomRouter from './roomRoutes.js';

import * as couponController from '../controllers/coupon.controller.js';
import { bookingRateLimiter, paymentRateLimiter } from '../middleware/rateLimit.middleware.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/hotels', hotelRouter);
apiRouter.use('/rooms', roomRouter);
apiRouter.use('/bookings', bookingRateLimiter, bookingRouter);
apiRouter.use('/payments', paymentRateLimiter, paymentRouter);
apiRouter.use('/coupons', couponRouter);
apiRouter.get('/offers', couponController.getActiveOffers);
apiRouter.use('/reviews', reviewRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/partner', partnerRouter);
apiRouter.use('/admin', adminRouter);

export default apiRouter;
