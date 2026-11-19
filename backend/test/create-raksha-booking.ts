import 'dotenv/config';
import { getPrismaClient } from '../src/config/prisma.js';

async function main() {
  const prisma = getPrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: 'rakshamanjula1@gmail.com' },
  });
  console.log('User found:', user?.id, user?.fullName, user?.email);

  if (!user) {
    console.log('User not found');
    return;
  }

  const room = await prisma.room.findFirst({
    where: { status: 'AVAILABLE' },
    include: { hotel: true },
  });

  if (!room) {
    console.log('No available room');
    return;
  }

  const today = new Date();
  const checkIn = new Date(today.getTime() + 5 * 86400000);
  const checkOut = new Date(today.getTime() + 8 * 86400000);
  const totalAmount = Number(room.pricePerNight) * 3;

  const booking = await prisma.booking.create({
    data: {
      bookingId: `TRM-${Date.now().toString().slice(-6)}`,
      customerId: user.id,
      hotelId: room.hotel.id,
      roomId: room.id,
      checkIn,
      checkOut,
      numberOfNights: 3,
      roomsCount: 1,
      guestsCount: 2,
      roomPrice: room.pricePerNight,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount,
      bookingStatus: 'PENDING',
      paymentStatus: 'PENDING',
      guestDetails: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '+91-9876543210',
      },
    },
    include: {
      hotel: true,
      room: true,
    },
  });

  console.log('Created test booking for mobile app:');
  console.log('ID:', booking.id);
  console.log('BookingRef:', booking.bookingId);
  console.log('Hotel:', booking.hotel.name);
  console.log('Room:', booking.room.roomType);
  console.log('Total:', booking.totalAmount);

  await prisma.$disconnect();
}

main();
