
from rest_framework import serializers

from .models import (
    User,
    Hotel,
    Room,
    Booking,
    Payment,
    Coupon,
    Review,
    Notification,
    Payout,
    PartnerProfile,
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "fullName",
            "email",
            "phone",
            "role",
            "avatar",
            "isActive",
            "isEmailVerified",
            "createdAt",
            "updatedAt",
        ]


class PartnerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerProfile
        fields = ["businessName"]
        read_only_fields = fields


class RoomSerializer(serializers.ModelSerializer):
    hotelId = serializers.UUIDField(
        source="hotel_id",
        read_only=True,
    )

    class Meta:
        model = Room
        fields = [
            "id",
            "hotelId",
            "roomType",
            "description",
            "pricePerNight",
            "maxGuests",
            "bedType",
            "amenities",
            "inclusions",
            "images",
            "totalRooms",
            "availableRooms",
            "blockedRooms",
            "status",
            "createdAt",
            "updatedAt",
        ]


class HotelSerializer(serializers.ModelSerializer):
    partner = PartnerProfileSerializer(read_only=True)
    rooms = RoomSerializer(many=True, read_only=True)

    class Meta:
        model = Hotel
        fields = [
            "id",
            "name",
            "description",
            "city",
            "destination",
            "address",
            "latitude",
            "longitude",
            "starRating",
            "ratingScore",
            "reviewCount",
            "pricePerNight",
            "originalPrice",
            "mainImage",
            "galleryImages",
            "amenities",
            "checkInTime",
            "checkOutTime",
            "isFeatured",
            "isActive",
            "partner",
            "createdAt",
            "updatedAt",
            "rooms",
        ]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = "__all__"


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = "__all__"


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"


class PayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payout
        fields = "__all__"
