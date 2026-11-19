import { Router } from 'express';

import * as controller from '../controllers/booking.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  bookingQueryValidation,
  cancelBookingValidation,
  createBookingValidation,
} from '../validators/booking.validators.js';

const bookingRouter = Router();

// Customer endpoints
bookingRouter.post('/', authenticate, createBookingValidation, validateRequest, controller.createBooking);
bookingRouter.get('/', authenticate, bookingQueryValidation, validateRequest, controller.getMyBookings);
bookingRouter.get('/:id/payment', authenticate, paymentController.getBookingPayment);
bookingRouter.get('/:id', authenticate, controller.getBookingById);
bookingRouter.patch('/:id/cancel', authenticate, cancelBookingValidation, validateRequest, controller.cancelBooking);

export default bookingRouter;
