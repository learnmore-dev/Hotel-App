
import math
import os
import re
import secrets
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import (
    Booking,
    Coupon,
    Hotel,
    Notification,
    PartnerProfile,
    Payout,
    Room,
)


# ---------------------------------------------------------
# General helpers
# ---------------------------------------------------------

CENT = Decimal("0.01")

BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]
PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"]

ALLOWED_TRANSITIONS = {
    "PENDING": ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["COMPLETED", "CANCELLED"],
    "CANCELLED": [],
    "COMPLETED": [],
}


def money(value):
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def api_error(message, code=400):
    return Response(
        {"success": False, "message": message},
        status=code,
    )


def success(message, data=None, code=200):
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return Response(payload, status=code)


def parse_date(value, field_name):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{field_name} must use YYYY-MM-DD format.")

    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{field_name} must be a valid date.")


def validate_booking_dates(check_in, check_out):
    today = timezone.now().date()

    if check_in < today:
        raise ValueError("Check-in date cannot be in the past.")

    if check_out <= check_in:
        raise ValueError("Check-out must be after check-in.")

    return (check_out - check_in).days


def parse_optional_date(value, field_name):
    if value in (None, ""):
        return None
    return parse_date(value, field_name)


def generate_booking_reference():
    today = timezone.now().date()
    date_part = today.strftime("%Y%m%d")
    return f"TRM-{date_part}-{secrets.token_hex(3).upper()}"


def get_user_id(request):
    return getattr(request.user, "id", None)


def is_admin(user):
    return str(getattr(user, "role", "")).upper() in ("ADMIN", "SUPER_ADMIN")


def get_partner_profile(user):
    return PartnerProfile.objects.filter(user_id=user.id).first()


def get_approved_partner(user):
    profile = get_partner_profile(user)

    if not profile:
        return None, api_error("Partner profile not found.", 404)

    if profile.status != "APPROVED":
        return None, api_error("Your partner account is not approved.", 403)

    return profile, None


def get_booking_by_identifier(identifier):
    query = Q(bookingId=identifier)

    try:
        query |= Q(id=uuid.UUID(str(identifier)))
    except (ValueError, TypeError, AttributeError):
        pass

    return Booking.objects.filter(query).first()


def serialize_booking(booking, include_customer=True):
    hotel = booking.hotel
    room = booking.room
    coupon = booking.coupon

    partner_profile = None
    if hotel and hotel.partner_id:
        partner_profile = PartnerProfile.objects.filter(
            id=hotel.partner_id
        ).first()

    data = {
        "id": str(booking.id),
        "bookingId": booking.bookingId,
        "customerId": str(booking.customer_id),
        "hotelId": str(booking.hotel_id),
        "roomId": str(booking.room_id),
        "checkIn": booking.checkIn.isoformat(),
        "checkOut": booking.checkOut.isoformat(),
        "roomsCount": booking.roomsCount,
        "guestsCount": booking.guestsCount,
        "guestDetails": booking.guestDetails,
        "specialRequests": booking.specialRequests,
        "numberOfNights": booking.numberOfNights,
        "roomPrice": float(booking.roomPrice),
        "taxAmount": float(booking.taxAmount),
        "discountAmount": float(booking.discountAmount),
        "totalAmount": float(booking.totalAmount),
        "paymentStatus": booking.paymentStatus,
        "bookingStatus": booking.bookingStatus,
        "couponId": str(booking.coupon_id) if booking.coupon_id else None,
        "cancellationReason": booking.cancellationReason,
        "cancelledAt": (
            booking.cancelledAt.isoformat()
            if booking.cancelledAt else None
        ),
        "createdAt": booking.createdAt.isoformat() if booking.createdAt else None,
        "updatedAt": booking.updatedAt.isoformat() if booking.updatedAt else None,
        "hotel": {
            "id": str(hotel.id),
            "name": hotel.name,
            "city": hotel.city,
            "destination": hotel.destination,
            "address": hotel.address,
            "mainImage": hotel.mainImage,
            "starRating": hotel.starRating,
            "checkInTime": hotel.checkInTime,
            "checkOutTime": hotel.checkOutTime,
            "partner": (
                {"businessName": partner_profile.businessName}
                if partner_profile else None
            ),
        },
        "room": {
            "id": str(room.id),
            "roomType": room.roomType,
            "pricePerNight": float(room.pricePerNight),
            "maxGuests": room.maxGuests,
            "bedType": room.bedType,
            "images": room.images,
            "amenities": room.amenities,
        },
        "coupon": (
            {
                "id": str(coupon.id),
                "code": coupon.code,
                "discountType": coupon.discountType,
                "discountValue": float(coupon.discountValue),
                "description": coupon.description,
            }
            if coupon else None
        ),
    }

    if include_customer:
        customer = booking.customer
        data["customer"] = {
            "id": str(customer.id),
            "fullName": customer.fullName,
            "email": customer.email,
            "phone": customer.phone,
        }

    return data


def paginate_queryset(queryset, page, limit):
    page = max(1, int(page or 1))
    limit = min(50, max(1, int(limit or 10)))

    total = queryset.count()
    pages = math.ceil(total / limit) if total else 0
    offset = (page - 1) * limit

    return {
        "items": list(queryset[offset:offset + limit]),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": pages,
        },
    }


def get_query_params(request):
    params = request.query_params

    return {
        "page": params.get("page", 1),
        "limit": params.get("limit", 10),
        "status": params.get("status"),
        "paymentStatus": params.get("paymentStatus"),
        "hotelId": params.get("hotelId"),
        "customerId": params.get("customerId"),
        "startDate": params.get("startDate"),
        "endDate": params.get("endDate"),
        "search": params.get("search"),
        "timeFilter": params.get("timeFilter"),
    }


def apply_booking_filters(queryset, params, customer_mode=False):
    if params.get("status"):
        if params["status"] not in BOOKING_STATUSES:
            raise ValueError("Invalid booking status.")
        queryset = queryset.filter(bookingStatus=params["status"])

    if params.get("paymentStatus"):
        if params["paymentStatus"] not in PAYMENT_STATUSES:
            raise ValueError("Invalid payment status.")
        queryset = queryset.filter(paymentStatus=params["paymentStatus"])

    if params.get("hotelId"):
        try:
            uuid.UUID(str(params["hotelId"]))
        except ValueError:
            raise ValueError("hotelId must be a valid UUID.")
        queryset = queryset.filter(hotel_id=params["hotelId"])

    if params.get("customerId"):
        try:
            uuid.UUID(str(params["customerId"]))
        except ValueError:
            raise ValueError("customerId must be a valid UUID.")
        queryset = queryset.filter(customer_id=params["customerId"])

    start_date = parse_optional_date(params.get("startDate"), "startDate")
    end_date = parse_optional_date(params.get("endDate"), "endDate")

    if start_date:
        queryset = queryset.filter(checkIn__gte=start_date)

    if end_date:
        queryset = queryset.filter(checkOut__lte=end_date)

    time_filter = params.get("timeFilter")
    today = timezone.now().date()

    if time_filter == "upcoming":
        queryset = queryset.filter(
            bookingStatus__in=["PENDING", "CONFIRMED"],
            checkIn__gte=today,
        )
    elif time_filter == "past":
        queryset = queryset.filter(
            Q(checkOut__lt=today) | Q(bookingStatus="COMPLETED")
        )
    elif time_filter == "cancelled":
        queryset = queryset.filter(bookingStatus="CANCELLED")
    elif time_filter:
        raise ValueError("Invalid timeFilter.")

    search = (params.get("search") or "").strip()

    if len(search) > 100:
        raise ValueError("search must be 100 characters or fewer.")

    if search:
        queryset = queryset.filter(
            Q(bookingId__icontains=search)
            | Q(hotel__name__icontains=search)
            | Q(hotel__city__icontains=search)
        )

    return queryset


# ---------------------------------------------------------
# Pricing and coupons
# ---------------------------------------------------------

def calculate_coupon_discount(coupon, base_amount):
    minimum = money(coupon.minimumBookingAmount or 0)

    if base_amount < minimum:
        return Decimal("0.00")

    value = money(coupon.discountValue)

    if coupon.discountType == "PERCENTAGE":
        discount = money(base_amount * value / Decimal("100"))

        if coupon.maximumDiscount is not None:
            maximum = money(coupon.maximumDiscount)
            if maximum > 0:
                discount = min(discount, maximum)

    else:
        discount = value

    return max(
        Decimal("0.00"),
        min(discount, base_amount),
    )


def calculate_booking_pricing(room_price, nights, rooms_count, coupon=None):
    price = money(room_price)
    base_amount = money(price * nights * rooms_count)

    raw_tax_rate = os.getenv("BOOKING_TAX_RATE_PERCENT", "0").strip()

    try:
        tax_rate = Decimal(raw_tax_rate)
        if tax_rate < 0:
            tax_rate = Decimal("0")
    except Exception:
        tax_rate = Decimal("0")

    tax_amount = money(base_amount * tax_rate / Decimal("100"))

    discount_amount = (
        calculate_coupon_discount(coupon, base_amount)
        if coupon else Decimal("0.00")
    )

    total_amount = max(
        Decimal("0.00"),
        money(base_amount + tax_amount - discount_amount),
    )

    return {
        "numberOfNights": nights,
        "roomPrice": price,
        "taxAmount": tax_amount,
        "discountAmount": discount_amount,
        "totalAmount": total_amount,
    }


def validate_coupon(code, customer_id, base_amount):
    if not code:
        return None

    normalized = str(code).strip().upper()

    if not normalized or len(normalized) > 64:
        raise ValueError("Invalid coupon code.")

    coupon = Coupon.objects.filter(code=normalized).first()

    if not coupon or not coupon.isActive:
        raise ValueError("Invalid or inactive coupon.")

    now = timezone.now()

    if now < coupon.validFrom or now > coupon.validUntil:
        raise ValueError("This coupon is not currently valid.")

    if coupon.usageLimit is not None:
        if coupon.usedCount >= coupon.usageLimit:
            raise ValueError("Coupon usage limit has been reached.")

    if coupon.perUserLimit is not None:
        user_usage = Booking.objects.filter(
            customer_id=customer_id,
            coupon_id=coupon.id,
        ).exclude(bookingStatus="CANCELLED").count()

        if user_usage >= coupon.perUserLimit:
            raise ValueError("You have already used this coupon the maximum number of times.")

    if base_amount < money(coupon.minimumBookingAmount or 0):
        raise ValueError("Booking amount does not meet the coupon minimum.")

    return coupon


# ---------------------------------------------------------
# Room availability
# ---------------------------------------------------------

def calculate_peak_booked_rooms(bookings, range_start, range_end):
    events = {}
    occupied_at_start = 0

    for booking in bookings:
        if booking.roomsCount <= 0:
            continue

        original_start = booking.checkIn
        original_end = booking.checkOut

        start = max(original_start, range_start)
        end = min(original_end, range_end)

        if start >= end:
            continue

        if original_start <= range_start:
            occupied_at_start += booking.roomsCount
        else:
            events[start] = events.get(start, 0) + booking.roomsCount

        events[end] = events.get(end, 0) - booking.roomsCount

    occupied = occupied_at_start
    peak = occupied

    for event_date in sorted(events):
        occupied += events[event_date]
        peak = max(peak, occupied)

    return peak


def check_room_capacity(room, check_in, check_out, rooms_count):
    existing_bookings = Booking.objects.filter(
        room_id=room.id,
        bookingStatus__in=["PENDING", "CONFIRMED"],
        checkIn__lt=check_out,
        checkOut__gt=check_in,
    )

    physical_capacity = max(
        0,
        room.totalRooms - room.blockedRooms,
    )

    sellable_capacity = min(
        room.availableRooms,
        physical_capacity,
    )

    peak_booked = calculate_peak_booked_rooms(
        existing_bookings,
        check_in,
        check_out,
    )

    remaining = sellable_capacity - peak_booked

    if remaining < rooms_count:
        raise ValueError("Not enough rooms are available for the selected dates.")


# ---------------------------------------------------------
# Notifications and payout cancellation
# ---------------------------------------------------------

def safe_notify(user_id, title, message, notification_type, dedup_key, action_url=None, data=None):
    try:
        if not user_id:
            return

        Notification.objects.create(
            id=uuid.uuid4(),
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            isRead=False,
            dedupKey=dedup_key,
            actionUrl=action_url,
            data=data,
            createdAt=timezone.now(),
        )
    except IntegrityError:
        pass
    except Exception:
        # Notifications must not fail the booking operation.
        pass


def notify_booking_created(booking):
    safe_notify(
        booking.customer_id,
        "Booking received",
        f"Your booking {booking.bookingId} has been created.",
        "BOOKING",
        f"booking-created-customer-{booking.id}",
        f"/bookings/{booking.id}",
        {"bookingId": booking.bookingId},
    )

    try:
        partner = PartnerProfile.objects.filter(
            id=booking.hotel.partner_id
        ).first()

        if partner:
            safe_notify(
                partner.user_id,
                "New booking received",
                f"A new booking {booking.bookingId} has been received.",
                "BOOKING",
                f"booking-created-partner-{booking.id}",
                f"/partner/bookings/{booking.id}",
                {"bookingId": booking.bookingId},
            )
    except Exception:
        pass


def notify_booking_cancelled(booking):
    safe_notify(
        booking.customer_id,
        "Booking cancelled",
        f"Booking {booking.bookingId} has been cancelled.",
        "BOOKING",
        f"booking-cancelled-customer-{booking.id}",
        f"/bookings/{booking.id}",
        {"bookingId": booking.bookingId},
    )

    try:
        partner = PartnerProfile.objects.filter(
            id=booking.hotel.partner_id
        ).first()

        if partner:
            safe_notify(
                partner.user_id,
                "Booking cancelled",
                f"Booking {booking.bookingId} has been cancelled.",
                "BOOKING",
                f"booking-cancelled-partner-{booking.id}",
                f"/partner/bookings/{booking.id}",
                {"bookingId": booking.bookingId},
            )
    except Exception:
        pass


def void_pending_payouts_for_booking(booking):
    Payout.objects.filter(
        booking_id=booking.id,
        status__in=["PENDING", "PROCESSING"],
    ).update(
        status="FAILED",
        rejectionReason="Booking was cancelled.",
        updatedAt=timezone.now(),
    )


def decrement_coupon_usage(booking):
    if not booking.coupon_id:
        return

    Coupon.objects.filter(
        id=booking.coupon_id,
        usedCount__gt=0,
    ).update(
        usedCount=models_f("usedCount") - 1,
        updatedAt=timezone.now(),
    )


def models_f(field):
    from django.db.models import F
    return F(field)


# ---------------------------------------------------------
# Customer booking endpoints
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_booking(request):
    user_id = get_user_id(request)
    body = request.data

    try:
        hotel_id = uuid.UUID(str(body.get("hotelId", "")))
        room_id = uuid.UUID(str(body.get("roomId", "")))
    except (ValueError, TypeError):
        return api_error("Hotel ID and Room ID must be valid UUIDs.")

    try:
        check_in = parse_date(body.get("checkIn"), "checkIn")
        check_out = parse_date(body.get("checkOut"), "checkOut")

        nights = validate_booking_dates(check_in, check_out)

        rooms_count = int(body.get("roomsCount"))
        guests_count = int(body.get("guestsCount"))

        if not 1 <= rooms_count <= 50:
            return api_error("roomsCount must be between 1 and 50.")

        if not 1 <= guests_count <= 200:
            return api_error("guestsCount must be between 1 and 200.")

    except (ValueError, TypeError):
        return api_error("Invalid booking dates or room and guest counts.")

    guest_details = body.get("guestDetails")

    if not isinstance(guest_details, dict):
        return api_error("guestDetails is required and must be an object.")

    full_name = str(guest_details.get("fullName", "")).strip()
    email = str(guest_details.get("email", "")).strip().lower()
    phone = str(guest_details.get("phone", "")).strip()

    if not full_name or len(full_name) > 160:
        return api_error("Guest full name is required (up to 160 characters).")

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return api_error("A valid guest email is required.")

    if not 4 <= len(phone) <= 32:
        return api_error("A valid guest phone number is required.")

    special_requests = body.get("specialRequests")
    if special_requests is not None:
        if not isinstance(special_requests, str) or len(special_requests.strip()) > 500:
            return api_error("specialRequests must be 500 characters or fewer.")
        special_requests = special_requests.strip() or None

    idempotency_key = (
        body.get("idempotencyKey")
        or request.headers.get("Idempotency-Key")
        or request.headers.get("idempotency-key")
    )

    if idempotency_key is not None:
        idempotency_key = str(idempotency_key).strip()
        if len(idempotency_key) > 128:
            return api_error("idempotencyKey must be 128 characters or fewer.")

    coupon_code = body.get("couponCode")
    if coupon_code is not None:
        if not isinstance(coupon_code, str) or not 1 <= len(coupon_code.strip()) <= 64:
            return api_error("couponCode must be between 1 and 64 characters.")

    if idempotency_key:
        existing = Booking.objects.filter(
            idempotencyKey=idempotency_key
        ).first()

        if existing:
            if str(existing.customer_id) != str(user_id):
                return api_error("This idempotency key belongs to another customer.", 403)

            return success(
                "Booking already exists.",
                serialize_booking(existing),
            )

    try:
        with transaction.atomic():
            hotel = Hotel.objects.filter(
                id=hotel_id,
                isActive=True,
            ).first()

            if not hotel:
                return api_error("Hotel not found or inactive.", 404)

            room = Room.objects.select_for_update().filter(
                id=room_id,
                hotel_id=hotel_id,
                status="AVAILABLE",
            ).first()

            if not room:
                return api_error("Room not found or unavailable.", 404)

            required_capacity = math.ceil(guests_count / rooms_count)

            if required_capacity > room.maxGuests:
                return api_error(
                    f"This room allows a maximum of {room.maxGuests} guests per room."
                )

            check_room_capacity(
                room,
                check_in,
                check_out,
                rooms_count,
            )

            base_amount = money(
                room.pricePerNight * nights * rooms_count
            )

            coupon = validate_coupon(
                coupon_code,
                user_id,
                base_amount,
            )

            pricing = calculate_booking_pricing(
                room.pricePerNight,
                nights,
                rooms_count,
                coupon,
            )

            booking_reference = None

            for _ in range(5):
                candidate = generate_booking_reference()

                if not Booking.objects.filter(bookingId=candidate).exists():
                    booking_reference = candidate
                    break

            if not booking_reference:
                raise ValueError("Unable to generate booking reference. Please try again.")

            now = timezone.now()

            booking = Booking.objects.create(
                id=uuid.uuid4(),
                bookingId=booking_reference,
                idempotencyKey=idempotency_key,
                customer_id=user_id,
                hotel_id=hotel.id,
                room_id=room.id,
                checkIn=check_in,
                checkOut=check_out,
                roomsCount=rooms_count,
                guestsCount=guests_count,
                guestDetails={
                    "fullName": full_name,
                    "email": email,
                    "phone": phone,
                },
                specialRequests=special_requests,
                numberOfNights=pricing["numberOfNights"],
                roomPrice=pricing["roomPrice"],
                taxAmount=pricing["taxAmount"],
                discountAmount=pricing["discountAmount"],
                totalAmount=pricing["totalAmount"],
                coupon_id=coupon.id if coupon else None,
                paymentStatus="PENDING",
                bookingStatus="PENDING",
                createdAt=now,
                updatedAt=now,
            )

            if coupon:
                Coupon.objects.filter(id=coupon.id).update(
                    usedCount=models_f("usedCount") + 1,
                    updatedAt=now,
                )

        notify_booking_created(booking)

        return success(
            "Booking created successfully",
            serialize_booking(booking),
            status.HTTP_201_CREATED,
        )

    except ValueError as exc:
        return api_error(str(exc))

    except IntegrityError:
        if idempotency_key:
            existing = Booking.objects.filter(
                idempotencyKey=idempotency_key
            ).first()

            if existing and str(existing.customer_id) == str(user_id):
                return success(
                    "Booking already exists.",
                    serialize_booking(existing),
                )

        return api_error("Unable to create booking due to a data conflict.", 409)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_bookings(request):
    try:
        params = get_query_params(request)

        queryset = Booking.objects.filter(
            customer_id=get_user_id(request)
        ).select_related(
            "customer", "hotel", "room", "coupon"
        ).order_by("-createdAt")

        queryset = apply_booking_filters(
            queryset,
            params,
            customer_mode=True,
        )

        page = int(params["page"])
        limit = int(params["limit"])

        if page < 1 or page > 1000000:
            return api_error("page must be a positive integer.")

        if limit < 1 or limit > 50:
            return api_error("limit must be between 1 and 50.")

        result = paginate_queryset(queryset, page, limit)

        result["items"] = [
            serialize_booking(item)
            for item in result["items"]
        ]

        return success("Bookings retrieved", result)

    except (ValueError, TypeError) as exc:
        return api_error(str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_booking_by_id(request, booking_id):
    booking = get_booking_by_identifier(booking_id)

    if not booking or str(booking.customer_id) != str(get_user_id(request)):
        return api_error("Booking not found.", 404)

    return success(
        "Booking details retrieved",
        serialize_booking(booking),
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def cancel_my_booking(request, booking_id):
    booking = get_booking_by_identifier(booking_id)

    if not booking or str(booking.customer_id) != str(get_user_id(request)):
        return api_error("Booking not found.", 404)

    reason = request.data.get("cancellationReason")

    if reason is not None:
        if not isinstance(reason, str) or len(reason.strip()) > 500:
            return api_error("cancellationReason must be 500 characters or fewer.")
        reason = reason.strip() or None

    if booking.bookingStatus in ("CANCELLED", "COMPLETED"):
        return api_error("This booking cannot be cancelled.")

    try:
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking.id)

            if booking.bookingStatus in ("CANCELLED", "COMPLETED"):
                return api_error("This booking cannot be cancelled.")

            booking.bookingStatus = "CANCELLED"
            booking.cancelledAt = timezone.now()
            booking.cancellationReason = reason
            booking.updatedAt = timezone.now()
            booking.save(
                update_fields=[
                    "bookingStatus",
                    "cancelledAt",
                    "cancellationReason",
                    "updatedAt",
                ]
            )

            decrement_coupon_usage(booking)
            void_pending_payouts_for_booking(booking)

        notify_booking_cancelled(booking)

        return success(
            "Booking cancelled successfully",
            serialize_booking(booking),
        )

    except Exception:
        return api_error("Unable to cancel booking.", 500)


# ---------------------------------------------------------
# Partner booking endpoints
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_partner_bookings(request):
    profile, error_response = get_approved_partner(request.user)

    if error_response:
        return error_response

    try:
        params = get_query_params(request)

        queryset = Booking.objects.filter(
            hotel__partner_id=profile.id
        ).select_related(
            "customer", "hotel", "room", "coupon"
        ).order_by("-createdAt")

        if params.get("search"):
            search = params["search"].strip()

            if len(search) > 100:
                return api_error("search must be 100 characters or fewer.")

            if search:
                queryset = queryset.filter(
                    Q(bookingId__icontains=search)
                    | Q(customer__fullName__icontains=search)
                    | Q(customer__email__icontains=search)
                    | Q(hotel__name__icontains=search)
                )

            params["search"] = None

        queryset = apply_booking_filters(queryset, params)

        result = paginate_queryset(
            queryset,
            int(params["page"]),
            int(params["limit"]),
        )

        result["items"] = [
            serialize_booking(item)
            for item in result["items"]
        ]

        return success("Partner bookings retrieved", result)

    except (ValueError, TypeError) as exc:
        return api_error(str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_partner_booking_by_id(request, booking_id):
    profile, error_response = get_approved_partner(request.user)

    if error_response:
        return error_response

    booking = get_booking_by_identifier(booking_id)

    if not booking or str(booking.hotel.partner_id) != str(profile.id):
        return api_error("Booking not found.", 404)

    return success(
        "Partner booking details retrieved",
        serialize_booking(booking),
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_partner_booking_status(request, booking_id):
    profile, error_response = get_approved_partner(request.user)

    if error_response:
        return error_response

    booking = get_booking_by_identifier(booking_id)

    if not booking or str(booking.hotel.partner_id) != str(profile.id):
        return api_error("Booking not found.", 404)

    return update_booking_status(
        booking,
        request.data,
        actor="partner",
    )


# ---------------------------------------------------------
# Admin booking endpoints
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_admin_bookings(request):
    if not is_admin(request.user):
        return api_error("Administrator access required.", 403)

    try:
        params = get_query_params(request)

        queryset = Booking.objects.select_related(
            "customer", "hotel", "room", "coupon"
        ).order_by("-createdAt")

        if params.get("search"):
            search = params["search"].strip()

            if len(search) > 100:
                return api_error("search must be 100 characters or fewer.")

            queryset = queryset.filter(
                Q(bookingId__icontains=search)
                | Q(customer__fullName__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(hotel__name__icontains=search)
            )

            params["search"] = None

        queryset = apply_booking_filters(queryset, params)

        result = paginate_queryset(
            queryset,
            int(params["page"]),
            int(params["limit"]),
        )

        result["items"] = [
            serialize_booking(item)
            for item in result["items"]
        ]

        return success("Admin bookings retrieved", result)

    except (ValueError, TypeError) as exc:
        return api_error(str(exc))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_admin_booking_by_id(request, booking_id):
    if not is_admin(request.user):
        return api_error("Administrator access required.", 403)

    booking = get_booking_by_identifier(booking_id)

    if not booking:
        return api_error("Booking not found.", 404)

    return success(
        "Admin booking details retrieved",
        serialize_booking(booking),
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_admin_booking_status(request, booking_id):
    if not is_admin(request.user):
        return api_error("Administrator access required.", 403)

    booking = get_booking_by_identifier(booking_id)

    if not booking:
        return api_error("Booking not found.", 404)

    return update_booking_status(
        booking,
        request.data,
        actor="admin",
    )


# ---------------------------------------------------------
# Shared partner/admin status update
# ---------------------------------------------------------

def update_booking_status(booking, body, actor):
    new_status = body.get("status")
    reason = body.get("reason")

    if new_status not in BOOKING_STATUSES:
        return api_error(
            "status must be PENDING, CONFIRMED, CANCELLED, or COMPLETED."
        )

    if reason is not None:
        if not isinstance(reason, str) or len(reason.strip()) > 500:
            return api_error("reason must be 500 characters or fewer.")
        reason = reason.strip() or None

    if new_status not in ALLOWED_TRANSITIONS.get(booking.bookingStatus, []):
        return api_error(
            f"Cannot change booking status from {booking.bookingStatus} to {new_status}."
        )

    try:
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking.id)

            if new_status not in ALLOWED_TRANSITIONS.get(booking.bookingStatus, []):
                return api_error("This booking status has already changed.")

            booking.bookingStatus = new_status
            booking.updatedAt = timezone.now()

            update_fields = ["bookingStatus", "updatedAt"]

            if new_status == "CANCELLED":
                booking.cancelledAt = timezone.now()
                booking.cancellationReason = reason
                update_fields.extend(["cancelledAt", "cancellationReason"])

                decrement_coupon_usage(booking)
                void_pending_payouts_for_booking(booking)

            booking.save(update_fields=update_fields)

        if new_status == "CANCELLED":
            notify_booking_cancelled(booking)

        return success(
            f"Booking status updated to {new_status}",
            serialize_booking(booking),
        )

    except Exception:
        return api_error("Unable to update booking status.", 500)
