import 'dotenv/config';
import { getPrismaClient } from '../config/prisma.js';

async function main() {
  const prisma = getPrismaClient();
  const userCount = await prisma.user.count();
  const hotelCount = await prisma.hotel.count();
  const roomCount = await prisma.room.count();
  const bookingCount = await prisma.booking.count();
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, fullName: true } });
  const hotels = await prisma.hotel.findMany({ select: { id: true, name: true, city: true, isActive: true } });

  console.log(JSON.stringify({
    counts: { userCount, hotelCount, roomCount, bookingCount },
    users,
    hotels,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("DB_ERROR:", err.message);
  process.exit(1);
});
