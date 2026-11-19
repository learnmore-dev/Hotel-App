import 'dotenv/config';

import { getPrismaClient } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

async function seed() {
  const prisma = getPrismaClient();

  console.log('--- Starting TrumiTrip Development Seeding ---');

  // 1. Partner User & Profile
  const partnerEmail = 'partner@trumitrip.dev';
  let partnerUser = await prisma.user.findUnique({ where: { email: partnerEmail } });

  if (!partnerUser) {
    const passwordHash = await hashPassword('PartnerPass123!');
    partnerUser = await prisma.user.create({
      data: {
        fullName: 'Grand Horizon Hospitality',
        email: partnerEmail,
        phone: '+1-555-0100',
        passwordHash,
        role: 'PARTNER',
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`Created Partner user: ${partnerUser.email}`);
  } else {
    console.log(`Partner user already exists: ${partnerUser.email}`);
  }

  let partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: partnerUser.id },
  });

  if (!partnerProfile) {
    partnerProfile = await prisma.partnerProfile.create({
      data: {
        userId: partnerUser.id,
        businessName: 'Grand Horizon Hospitality LLC',
        businessEmail: 'contact@grandhorizon.dev',
        businessPhone: '+1-555-0199',
        address: '742 Ocean View Blvd, Suite 100, Miami, FL 33139',
        status: 'APPROVED',
        commissionRate: 15.0,
      },
    });
    console.log(`Created PartnerProfile: ${partnerProfile.businessName}`);
  } else if (partnerProfile.status !== 'APPROVED') {
    partnerProfile = await prisma.partnerProfile.update({
      where: { id: partnerProfile.id },
      data: { status: 'APPROVED' },
    });
  }

  // 2. Standard Dev Customer User
  const customerEmail = 'customer@trumitrip.dev';
  let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });

  if (!customerUser) {
    const customerPasswordHash = await hashPassword('CustomerPass123!');
    customerUser = await prisma.user.create({
      data: {
        fullName: 'Alex Morgan',
        email: customerEmail,
        phone: '+1-555-0200',
        passwordHash: customerPasswordHash,
        role: 'CUSTOMER',
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`Created Customer user: ${customerUser.email}`);
  } else {
    console.log(`Customer user already exists: ${customerUser.email}`);
  }

  // 3. Standard Dev Admin User
  const adminEmail = 'admin@trumitrip.dev';
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!adminUser) {
    const adminPasswordHash = await hashPassword('AdminPass123!');
    adminUser = await prisma.user.create({
      data: {
        fullName: 'System Administrator',
        email: adminEmail,
        phone: '+1-555-0300',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`Created Admin user: ${adminUser.email}`);
  } else {
    console.log(`Admin user already exists: ${adminUser.email}`);
  }

  // 4. Hotels & Rooms
  const hotelsData = [
    {
      name: 'The Grand Azure Resort & Spa',
      description:
        'Experience luxury beachfront living in the heart of South Beach. Enjoy panoramic ocean views, world-class dining, private cabanas, and our signature wellness spa.',
      city: 'Miami',
      destination: 'South Beach',
      address: '100 Ocean Drive, Miami Beach, FL 33139',
      latitude: 25.778135,
      longitude: -80.131325,
      starRating: 5,
      ratingScore: 4.85,
      reviewCount: 128,
      pricePerNight: 280.0,
      originalPrice: 350.0,
      mainImage:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Free Wi-Fi',
        'Swimming Pool',
        'Spa & Wellness',
        'Ocean View',
        'Restaurant',
        'Fitness Center',
        'Room Service',
        'Bar / Lounge',
      ],
      checkInTime: '15:00',
      checkOutTime: '11:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Deluxe Ocean Suite',
          description: 'Spacious suite with sweeping ocean views, private balcony, marble bathroom, and plush king bedding.',
          pricePerNight: 280.0,
          maxGuests: 3,
          bedType: '1 King Bed',
          amenities: ['Balcony', 'Ocean View', 'Mini Bar', 'King Bed', 'AC', 'Coffee Machine'],
          inclusions: ['Breakfast Included', 'Free Wi-Fi', 'Complimentary Parking'],
          images: [
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 10,
          availableRooms: 10,
          blockedRooms: 0,
        },
        {
          roomType: 'Executive Sunset Room',
          description: 'Contemporary design with two queen beds, sunset city vistas, smart entertainment, and walk-in rain shower.',
          pricePerNight: 360.0,
          maxGuests: 4,
          bedType: '2 Queen Beds',
          amenities: ['Sunset View', 'Mini Bar', 'Smart TV', 'Lounge Area', 'AC'],
          inclusions: ['Breakfast & Dinner', 'Free Wi-Fi', 'Spa Access'],
          images: [
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 6,
          availableRooms: 6,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'Alpine Lodge & Mountain Retreat',
      description:
        'Nestled in the Colorado Rockies, Alpine Lodge offers ski-in/ski-out convenience, crackling fireplaces, and heated outdoor pools surrounded by snowcapped pines.',
      city: 'Aspen',
      destination: 'Rocky Mountains',
      address: '550 Mountain Pass Road, Aspen, CO 81611',
      latitude: 39.191098,
      longitude: -106.817535,
      starRating: 4,
      ratingScore: 4.7,
      reviewCount: 94,
      pricePerNight: 210.0,
      originalPrice: 260.0,
      mainImage:
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Fireplace',
        'Heated Pool',
        'Ski-in / Ski-out',
        'Mountain View',
        'Free Wi-Fi',
        'Restaurant',
        'Hot Tub',
      ],
      checkInTime: '16:00',
      checkOutTime: '10:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Cozy Mountain King',
          description: 'Rustic luxury featuring natural timber accents, gas stone fireplace, mountain views, and heated bathroom floors.',
          pricePerNight: 210.0,
          maxGuests: 2,
          bedType: '1 King Bed',
          amenities: ['Fireplace', 'Mountain View', 'Heated Bathroom Floor', 'Coffee Maker', 'AC'],
          inclusions: ['Breakfast Included', 'Ski Storage', 'Free Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 8,
          availableRooms: 8,
          blockedRooms: 0,
        },
        {
          roomType: 'Family Alpine Suite',
          description: 'Spacious two-room alpine suite with kitchenette, fireplace, balcony, and sleeping capacity for family vacations.',
          pricePerNight: 320.0,
          maxGuests: 5,
          bedType: '1 King Bed + 2 Single Beds',
          amenities: ['2 Bedrooms', 'Fireplace', 'Kitchenette', 'Balcony', 'AC'],
          inclusions: ['Breakfast Included', 'Free Parking', 'Ski Passes Discount'],
          images: [
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 5,
          availableRooms: 5,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'The Metropolitan Skyline Hotel',
      description:
        'Centrally situated on Lexington Avenue, steps from Grand Central. Features modern guest rooms, high-speed fiber internet, and our rooftop skybar overlooking the Chrysler Building.',
      city: 'New York',
      destination: 'Manhattan',
      address: '450 Lexington Avenue, New York, NY 10017',
      latitude: 40.751621,
      longitude: -73.97551,
      starRating: 4,
      ratingScore: 4.65,
      reviewCount: 210,
      pricePerNight: 195.0,
      originalPrice: 240.0,
      mainImage:
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Rooftop Bar',
        'City Skyline View',
        'Fitness Center',
        'High-Speed Wi-Fi',
        'Concierge',
        'Business Center',
      ],
      checkInTime: '15:00',
      checkOutTime: '12:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Classic Queen Room',
          description: 'Efficient and stylish urban room with queen bed, ergonomic workspace, and high-definition smart television.',
          pricePerNight: 195.0,
          maxGuests: 2,
          bedType: '1 Queen Bed',
          amenities: ['City View', 'Work Desk', 'Smart TV', 'AC', 'Coffee Machine'],
          inclusions: ['High-Speed Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 12,
          availableRooms: 12,
          blockedRooms: 0,
        },
        {
          roomType: 'Skyline Panorama King',
          description: 'High-floor corner room with floor-to-ceiling vistas of the Manhattan skyline, Nespresso station, and deep soaking tub.',
          pricePerNight: 275.0,
          maxGuests: 3,
          bedType: '1 King Bed',
          amenities: ['Floor-to-Ceiling Windows', 'Panoramic Skyline View', 'Espresso Machine', 'Mini Bar', 'AC'],
          inclusions: ['Breakfast Included', 'Rooftop Lounge Access', 'High-Speed Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 8,
          availableRooms: 8,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'Royal Palms Coastal Sanctuary & Spa',
      description:
        'Nestled along the pristine golden sands of Candolim, Royal Palms offers bespoke Ayurvedic wellness treatments, private beachfront cabanas, and world-class Goan hospitality.',
      city: 'Goa',
      destination: 'Candolim',
      address: 'Plot 42, Fort Aguada Road, Candolim, Goa 403515',
      latitude: 15.517392,
      longitude: 73.765624,
      starRating: 5,
      ratingScore: 4.92,
      reviewCount: 384,
      pricePerNight: 340.0,
      originalPrice: 450.0,
      mainImage:
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Private Beach',
        'Infinity Pool',
        'Ayurvedic Spa',
        'Sunset Bar',
        'Free Wi-Fi',
        'Water Sports',
        'Kids Club',
      ],
      checkInTime: '14:00',
      checkOutTime: '11:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Oceanfront Luxury Villa',
          description: 'Spacious private villa with panoramic ocean views, private plunge pool, and dedicated butler service.',
          pricePerNight: 340.0,
          maxGuests: 4,
          bedType: '1 King Bed + 1 Daybed',
          amenities: ['Private Pool', 'Ocean View', 'Butler Service', 'Balcony', 'AC'],
          inclusions: ['Breakfast Included', 'Airport Transfer', 'Free Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 6,
          availableRooms: 6,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'Heritage Haveli & Palace Resort',
      description:
        'Experience royal Rajasthani grandeur in a restored 18th-century heritage palace overlooking the Aravalli hills, featuring traditional jharokha balconies and folk courtyard performances.',
      city: 'Jaipur',
      destination: 'Amer',
      address: 'Amer Fort Road, Amber, Jaipur, Rajasthan 302028',
      latitude: 26.985487,
      longitude: 75.850703,
      starRating: 4,
      ratingScore: 4.75,
      reviewCount: 168,
      pricePerNight: 160.0,
      originalPrice: 220.0,
      mainImage:
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Heritage Courtyard',
        'Swimming Pool',
        'Rooftop Dining',
        'Cultural Shows',
        'Free Wi-Fi',
        'Ayurvedic Massage',
      ],
      checkInTime: '13:00',
      checkOutTime: '11:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Royal Heritage Suite',
          description: 'Authentic royal furnishings with antique brass fittings, hand-carved archways, and city-view balcony.',
          pricePerNight: 160.0,
          maxGuests: 3,
          bedType: '1 Four-Poster King Bed',
          amenities: ['Jharokha Balcony', 'Antique Decor', 'Mini Bar', 'AC'],
          inclusions: ['Royal Breakfast', 'Cultural Evening Pass', 'Free Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 10,
          availableRooms: 10,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'Urban Comfort Suites & Inn',
      description:
        'Affordable, high-speed, modern budget accommodation ideally located near IT hubs, shopping centers, and public transport with clean compact suites and smart self-check-in.',
      city: 'Bengaluru',
      destination: 'Whitefield',
      address: '77 ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066',
      latitude: 12.986321,
      longitude: 77.737194,
      starRating: 3,
      ratingScore: 4.35,
      reviewCount: 142,
      pricePerNight: 75.0,
      originalPrice: 110.0,
      mainImage:
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Free Wi-Fi',
        'Air Conditioned',
        'Work Desk',
        '24h Front Desk',
        'Express Breakfast',
        'Elevator',
      ],
      checkInTime: '12:00',
      checkOutTime: '11:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Smart Budget Queen',
          description: 'Clean, soundproofed room with ergonomic work station, high-speed fiber Wi-Fi, and rainfall shower.',
          pricePerNight: 75.0,
          maxGuests: 2,
          bedType: '1 Queen Bed',
          amenities: ['Work Desk', 'Free Wi-Fi', 'AC', 'Rainfall Shower'],
          inclusions: ['Continental Breakfast', 'Free Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 20,
          availableRooms: 20,
          blockedRooms: 0,
        },
      ],
    },
    {
      name: 'Ginger City Express Stay',
      description:
        'Reliable, budget-friendly modern rooms designed for smart leisure and business travelers. Offers 24/7 fitness access, cafe dining, and seamless connectivity.',
      city: 'Mumbai',
      destination: 'Andheri',
      address: '22 Western Express Highway, Andheri East, Mumbai 400069',
      latitude: 19.113645,
      longitude: 72.869734,
      starRating: 3,
      ratingScore: 4.28,
      reviewCount: 98,
      pricePerNight: 65.0,
      originalPrice: 95.0,
      mainImage:
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      ],
      amenities: [
        'Free Wi-Fi',
        'Air Conditioned',
        'Fitness Room',
        'Cafe Dining',
        '24h Security',
        'Luggage Storage',
      ],
      checkInTime: '14:00',
      checkOutTime: '12:00',
      isFeatured: true,
      isActive: true,
      rooms: [
        {
          roomType: 'Standard Express Twin',
          description: 'Modern twin-bed room with cozy bedding, smart TV, tea/coffee maker, and spotless en-suite bathroom.',
          pricePerNight: 65.0,
          maxGuests: 2,
          bedType: '2 Single Beds',
          amenities: ['Tea/Coffee Maker', 'AC', 'Smart TV', 'Free Wi-Fi'],
          inclusions: ['High-Speed Wi-Fi'],
          images: [
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
          ],
          totalRooms: 15,
          availableRooms: 15,
          blockedRooms: 0,
        },
      ],
    },
  ];

  for (const h of hotelsData) {
    const { rooms, ...hotelDetails } = h;

    let hotel = await prisma.hotel.findFirst({
      where: { name: hotelDetails.name, partnerId: partnerProfile.id },
    });

    if (!hotel) {
      hotel = await prisma.hotel.create({
        data: {
          ...hotelDetails,
          partnerId: partnerProfile.id,
        },
      });
      console.log(`Created Hotel: ${hotel.name} in ${hotel.city}`);
    } else {
      console.log(`Hotel already exists: ${hotel.name}`);
    }

    for (const r of rooms) {
      const existingRoom = await prisma.room.findFirst({
        where: { hotelId: hotel.id, roomType: r.roomType },
      });

      if (!existingRoom) {
        await prisma.room.create({
          data: {
            ...r,
            hotelId: hotel.id,
            status: 'AVAILABLE',
          },
        });
        console.log(`  -> Created Room: ${r.roomType} ($${r.pricePerNight}/night)`);
      } else {
        console.log(`  -> Room already exists: ${r.roomType}`);
      }
    }
  }

  // 4. Sample Promotional Coupons (Phase 11)
  const sampleCoupons = [
    {
      code: 'WELCOME10',
      description: '10% discount for first-time guests up to $50 off',
      discountType: 'PERCENTAGE' as const,
      discountValue: 10,
      minimumBookingAmount: 100,
      maximumDiscount: 50,
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      validUntil: new Date('2029-12-31T23:59:59.000Z'),
      usageLimit: 500,
      perUserLimit: 1,
      isActive: true,
    },
    {
      code: 'SAVE50',
      description: 'Flat $50 off on stays of $200 or more',
      discountType: 'FIXED_AMOUNT' as const,
      discountValue: 50,
      minimumBookingAmount: 200,
      maximumDiscount: null,
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      validUntil: new Date('2029-12-31T23:59:59.000Z'),
      usageLimit: 300,
      perUserLimit: 2,
      isActive: true,
    },
    {
      code: 'LUXURY100',
      description: '$100 off premium suites with min $500 spend',
      discountType: 'FIXED_AMOUNT' as const,
      discountValue: 100,
      minimumBookingAmount: 500,
      maximumDiscount: null,
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      validUntil: new Date('2029-12-31T23:59:59.000Z'),
      usageLimit: 100,
      perUserLimit: 1,
      isActive: true,
    },
    {
      code: 'SUMMER20',
      description: '20% discount on resort getaways up to $100 off',
      discountType: 'PERCENTAGE' as const,
      discountValue: 20,
      minimumBookingAmount: 150,
      maximumDiscount: 100,
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      validUntil: new Date('2029-12-31T23:59:59.000Z'),
      usageLimit: 1000,
      perUserLimit: 1,
      isActive: true,
    },
  ];

  for (const couponData of sampleCoupons) {
    const existing = await prisma.coupon.findUnique({
      where: { code: couponData.code },
    });
    if (!existing) {
      await prisma.coupon.create({
        data: couponData,
      });
      console.log(`Created Coupon: ${couponData.code} (${couponData.description})`);
    } else {
      console.log(`Coupon already exists: ${couponData.code}`);
    }
  }

  console.log('--- Development Seeding Completed Successfully ---');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
