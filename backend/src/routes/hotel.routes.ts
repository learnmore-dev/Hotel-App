import { Router } from 'express';

import * as controller from '../controllers/hotel.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { hotelReviewsQueryValidation } from '../validators/review.validators.js';
import {
  adminHotelFeaturedValidation,
  adminHotelStatusValidation,
  createHotelValidation,
  hotelIdValidation,
  hotelListQueryValidation,
  partnerHotelStatusValidation,
  updateHotelValidation,
} from '../validators/hotel.validators.js';

export const publicHotelRouter = Router();
publicHotelRouter.get('/featured', hotelListQueryValidation, validateRequest, controller.getFeaturedHotels);
publicHotelRouter.get('/destinations', controller.getDestinations);
publicHotelRouter.get('/', hotelListQueryValidation, validateRequest, controller.getHotels);
publicHotelRouter.get('/:id/rooms/availability', hotelIdValidation, validateRequest, controller.getHotelRoomAvailability);
publicHotelRouter.get('/:id/reviews', hotelIdValidation, hotelReviewsQueryValidation, validateRequest, reviewController.getHotelReviews);
publicHotelRouter.get('/:id', hotelIdValidation, validateRequest, controller.getHotelById);

export const partnerHotelRouter = Router();
partnerHotelRouter.use(authenticate, requireRole('PARTNER'));
partnerHotelRouter.get('/hotels', hotelListQueryValidation, validateRequest, controller.getPartnerHotels);
partnerHotelRouter.post('/hotels', createHotelValidation, validateRequest, controller.createPartnerHotel);
partnerHotelRouter.get('/hotels/:id', hotelIdValidation, validateRequest, controller.getPartnerHotelById);
partnerHotelRouter.put('/hotels/:id', updateHotelValidation, validateRequest, controller.updatePartnerHotel);
partnerHotelRouter.patch('/hotels/:id/status', partnerHotelStatusValidation, validateRequest, controller.updatePartnerHotelStatus);

export const adminHotelRouter = Router();
adminHotelRouter.use(authenticate, requireRole('ADMIN'));
adminHotelRouter.get('/hotels', hotelListQueryValidation, validateRequest, controller.getAdminHotels);
adminHotelRouter.get('/hotels/:id', hotelIdValidation, validateRequest, controller.getAdminHotelById);
adminHotelRouter.patch('/hotels/:id/status', adminHotelStatusValidation, validateRequest, controller.updateAdminHotelStatus);
adminHotelRouter.patch('/hotels/:id/featured', adminHotelFeaturedValidation, validateRequest, controller.updateAdminHotelFeatured);
