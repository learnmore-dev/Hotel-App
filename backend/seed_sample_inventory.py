import argparse
import os
import uuid
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.db import transaction
from django.utils import timezone
from apps.core.models import Hotel, Room, PartnerProfile


PARTNER_ID = "9117fa9b-aa4c-4905-a7ad-9bf0834445b9"

IMAGES = [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
]


def room(name, price, guests, bed, count=6):
    return {
        "roomType": name,
        "description": f"Sample demo accommodation: {name}, designed for a comfortable stay.",
        "pricePerNight": Decimal(str(price)),
        "maxGuests": guests,
        "bedType": bed,
        "amenities": ["Air Conditioning", "Wi-Fi", "Smart TV", "Private Bathroom"],
        "inclusions": ["High-Speed Wi-Fi", "Daily Housekeeping"],
        "images": [IMAGES[1]],
        "totalRooms": count,
        "availableRooms": count,
        "blockedRooms": 0,
        "status": "AVAILABLE",
    }


# Additional room types for hotels already in the database.
EXISTING_ROOMS = {
    "Alpine Lodge & Mountain Retreat": [
        room("Alpine Ridge Twin Room", 145, 2, "2 Twin Beds"),
    ],
    "Urban Comfort Suites & Inn": [
        room("Executive Tech King", 115, 2, "1 King Bed"),
        room("Family Garden Suite", 155, 4, "1 King + 2 Twin Beds"),
    ],
    "Azure Marina Luxury Resort": [
        room("Coastal Deluxe Room", 180, 2, "1 Queen Bed"),
        room("Marina Family Suite", 260, 4, "1 King + 2 Twin Beds"),
        room("Premium Sea View Room", 225, 3, "1 King Bed"),
    ],
    "Royal Palms Coastal Sanctuary & Spa": [
        room("Garden Courtyard Room", 210, 2, "1 Queen Bed"),
        room("Premium Ocean Suite", 340, 4, "1 King Bed"),
    ],
    "Heritage Haveli & Palace Resort": [
        room("Courtyard Deluxe Room", 125, 2, "1 Queen Bed"),
        room("Maharaja Family Suite", 195, 4, "1 King + 2 Twin Beds"),
    ],
    "The Grand Backwater Palace": [
        room("Backwater Deluxe Room", 160, 2, "1 King Bed"),
        room("Lagoon Family Suite", 240, 4, "1 King + 2 Twin Beds"),
        room("Heritage Waterfront Suite", 295, 3, "1 King Bed"),
    ],
    "The Grand Azure Resort & Spa": [
        room("Premium Beach King", 285, 2, "1 King Bed"),
    ],
    "Ginger City Express Stay": [
        room("Executive Business Queen", 105, 2, "1 Queen Bed"),
        room("Family City Suite", 145, 4, "1 King + 2 Twin Beds"),
    ],
    "The Metropolitan Skyline Hotel": [
        room("Executive Skyline Suite", 285, 3, "1 King Bed"),
    ],
}


# Seven additional sample/demo hotels: one for each city that needs another.
NEW_HOTELS = [
    {
        "name": "Aspen Creek Alpine Stay",
        "city": "Aspen",
        "destination": "Rocky Mountains",
        "address": "Demo listing, Aspen, Colorado, USA",
        "price": 175,
        "description": "Sample demo mountain accommodation in Aspen.",
        "amenities": ["Mountain View", "Wi-Fi", "Restaurant", "Heating", "Parking"],
        "rooms": [
            room("Creekside Queen Room", 175, 2, "1 Queen Bed"),
            room("Mountain Family Suite", 245, 4, "1 King + 2 Twin Beds"),
            room("Alpine Premium King", 215, 2, "1 King Bed"),
        ],
    },
    {
        "name": "Bengaluru Garden City Suites",
        "city": "Bengaluru",
        "destination": "Whitefield",
        "address": "Demo listing, Whitefield, Bengaluru, Karnataka, India",
        "price": 110,
        "description": "Sample demo city accommodation in Bengaluru.",
        "amenities": ["Wi-Fi", "Business Center", "Restaurant", "Gym", "Parking"],
        "rooms": [
            room("Garden Queen Room", 110, 2, "1 Queen Bed"),
            room("Executive Work Suite", 155, 2, "1 King Bed"),
            room("Family Comfort Suite", 185, 4, "1 King + 2 Twin Beds"),
        ],
    },
    
    {
        "name": "Jaipur Amber Courtyard Stay",
        "city": "Jaipur",
        "destination": "Amer",
        "address": "Demo listing, Amer, Jaipur, Rajasthan, India",
        "price": 130,
        "description": "Sample demo heritage-style accommodation in Jaipur.",
        "amenities": ["Courtyard", "Wi-Fi", "Restaurant", "Cultural Decor", "Parking"],
        "rooms": [
            room("Amber Deluxe Room", 130, 2, "1 Queen Bed"),
            room("Royal Family Suite", 205, 4, "1 King + 2 Twin Beds"),
            room("Courtyard Premium Suite", 175, 3, "1 King Bed"),
        ],
    },
    {
        "name": "Kochi Lagoon View Residency",
        "city": "Kochi",
        "destination": "Kerala Backwaters",
        "address": "Demo listing, Kochi, Kerala, India",
        "price": 150,
        "description": "Sample demo backwater accommodation in Kochi.",
        "amenities": ["Lagoon View", "Wi-Fi", "Restaurant", "Garden", "Parking"],
        "rooms": [
            room("Lagoon Queen Room", 150, 2, "1 Queen Bed"),
            room("Backwater Family Suite", 225, 4, "1 King + 2 Twin Beds"),
            room("Waterfront Premium Room", 195, 3, "1 King Bed"),
        ],
    },
    {
        "name": "Miami Coral Bay Boutique Hotel",
        "city": "Miami",
        "destination": "South Beach",
        "address": "Demo listing, South Beach, Miami, Florida, USA",
        "price": 230,
        "description": "Sample demo boutique accommodation in Miami.",
        "amenities": ["Pool", "Wi-Fi", "Beach Access", "Restaurant", "Fitness Center"],
        "rooms": [
            room("Coral Queen Room", 230, 2, "1 Queen Bed"),
            room("Bay Family Suite", 320, 4, "1 King + 2 Twin Beds"),
            room("Ocean Premium King", 285, 2, "1 King Bed"),
        ],
    },
    {
        "name": "Mumbai Metro Urban Stay",
        "city": "Mumbai",
        "destination": "Andheri",
        "address": "Demo listing, Andheri, Mumbai, Maharashtra, India",
        "price": 120,
        "description": "Sample demo urban accommodation in Mumbai.",
        "amenities": ["Wi-Fi", "Business Center", "Restaurant", "Air Conditioning", "Parking"],
        "rooms": [
            room("Metro Queen Room", 120, 2, "1 Queen Bed"),
            room("Business Executive Suite", 175, 2, "1 King Bed"),
            room("Urban Family Room", 195, 4, "1 King + 2 Twin Beds"),
        ],
    },
    {
        "name": "Manhattan Central Comfort Hotel",
        "city": "New York",
        "destination": "Manhattan",
        "address": "Demo listing, Midtown Manhattan, New York, NY, USA",
        "price": 175,
        "description": "Sample demo city accommodation in Manhattan, New York.",
        "amenities": ["City View", "Wi-Fi", "Business Center", "Restaurant", "Fitness Center"],
        "rooms": [
            room("Manhattan Queen Room", 175, 2, "1 Queen Bed"),
            room("Central Family Suite", 265, 4, "1 King + 2 Twin Beds"),
            room("Executive Manhattan King", 225, 2, "1 King Bed"),
        ],
    },
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    partner = PartnerProfile.objects.get(id=PARTNER_ID, status="APPROVED")
    now = timezone.now()

    planned_hotels = []
    planned_rooms = []

    # Find existing active hotels and identify only missing room types.
    for hotel_name, room_specs in EXISTING_ROOMS.items():
        hotel = Hotel.objects.filter(name=hotel_name, isActive=True).first()

        if not hotel:
            raise RuntimeError(f"Expected active hotel not found: {hotel_name}")

        for spec in room_specs:
            exists = Room.objects.filter(
                hotel_id=hotel.id,
                roomType=spec["roomType"],
            ).exists()

            if not exists:
                planned_rooms.append((hotel, spec))

    # Identify new hotels and their room types.
    for spec in NEW_HOTELS:
        hotel = Hotel.objects.filter(
            name=spec["name"],
            city=spec["city"],
        ).first()

        if hotel:
            if not hotel.isActive:
                raise RuntimeError(f"Matching hotel exists but is inactive: {spec['name']}")
            print(f"Existing hotel will be preserved: {spec['name']}")
        else:
            planned_hotels.append(spec)

        if hotel:
            for room_spec in spec["rooms"]:
                if not Room.objects.filter(
                    hotel_id=hotel.id,
                    roomType=room_spec["roomType"],
                ).exists():
                    planned_rooms.append((hotel, room_spec))

    print("\n========== INVENTORY PREVIEW ==========")
    print(f"Partner: {partner.businessName}")
    print(f"New hotels to add: {len(planned_hotels)}")

    for spec in planned_hotels:
        print(f"  + {spec['name']} — {spec['city']}")
        for room_spec in spec["rooms"]:
            print(f"      - {room_spec['roomType']}")

    print(f"\nAdditional room types for existing hotels: {len(planned_rooms)}")
    for hotel, spec in planned_rooms:
        print(f"  + {hotel.name}: {spec['roomType']}")

    new_hotel_room_count = sum(len(spec["rooms"]) for spec in planned_hotels)
    print(f"\nTotal new room types expected: {len(planned_rooms) + new_hotel_room_count}")

    if not args.apply:
        print("\nDRY RUN ONLY. No database records were changed.")
        print("Review this preview, then run with --apply to insert.")
        return

    with transaction.atomic():
        for spec in planned_hotels:
            hotel = Hotel.objects.create(
                id=uuid.uuid4(),
                name=spec["name"],
                description=spec["description"],
                city=spec["city"],
                destination=spec["destination"],
                address=spec["address"],
                latitude=None,
                longitude=None,
                starRating=None,
                ratingScore=None,
                reviewCount=0,
                pricePerNight=Decimal(str(spec["price"])),
                originalPrice=None,
                mainImage=IMAGES[0],
                galleryImages=[IMAGES[1], IMAGES[2]],
                amenities=spec["amenities"],
                checkInTime="14:00",
                checkOutTime="11:00",
                isFeatured=False,
                isActive=True,
                partner=partner,
                createdAt=now,
                updatedAt=now,
            )

            for room_spec in spec["rooms"]:
                Room.objects.create(
                    id=uuid.uuid4(),
                    hotel=hotel,
                    createdAt=now,
                    updatedAt=now,
                    **room_spec,
                )

        for hotel, room_spec in planned_rooms:
            Room.objects.create(
                id=uuid.uuid4(),
                hotel=hotel,
                createdAt=now,
                updatedAt=now,
                **room_spec,
            )

    print("\nSUCCESS: Sample inventory inserted.")
    print(f"New hotels: {len(planned_hotels)}")
    print(f"Additional rooms: {len(planned_rooms) + new_hotel_room_count}")


if __name__ == "__main__":
    main()
