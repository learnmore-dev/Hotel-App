
import bcrypt
from decimal import Decimal
import uuid

from datetime import timedelta
from django.db.models.functions import TruncDate
from django.core.paginator import Paginator
from django.db import connection
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User,
    Hotel,
    Room,
    Review,
    PartnerProfile,
    Booking,
    Payment,
    Payout,
)
from .serializers import (
    UserSerializer,
    HotelSerializer,
    RoomSerializer,
)


def hotel_page_response(request, hotels):
    """Return hotels in the format expected by the mobile app."""

    search = request.query_params.get("search")
    city = request.query_params.get("city")
    destination = request.query_params.get("destination")
    min_price = request.query_params.get("minPrice")
    max_price = request.query_params.get("maxPrice")
    star_rating = request.query_params.get("starRating")
    amenities = request.query_params.get("amenities")

    if search:
        hotels = hotels.filter(
            Q(name__icontains=search)
            | Q(city__icontains=search)
            | Q(destination__icontains=search)
        )

    if city:
        hotels = hotels.filter(city__iexact=city)

    if destination:
        hotels = hotels.filter(destination__iexact=destination)

    if min_price:
        hotels = hotels.filter(pricePerNight__gte=min_price)

    if max_price:
        hotels = hotels.filter(pricePerNight__lte=max_price)

    if star_rating:
        hotels = hotels.filter(starRating__gte=star_rating)

    if amenities:
        for amenity in amenities.split(","):
            amenity = amenity.strip()
            if amenity:
                hotels = hotels.filter(amenities__contains=[amenity])

    sort = request.query_params.get("sort", "newest")

    sort_options = {
        "price_asc": "pricePerNight",
        "price_desc": "-pricePerNight",
        "rating": "-ratingScore",
        "popular": "-reviewCount",
        "newest": "-createdAt",
    }

    hotels = hotels.order_by(sort_options.get(sort, "-createdAt"))

    try:
        page_number = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page_number = 1

    try:
        limit = int(request.query_params.get("limit", 20))
        limit = max(1, min(limit, 100))
    except (TypeError, ValueError):
        limit = 20

    paginator = Paginator(hotels, limit)
    page = paginator.get_page(page_number)

    serialized_hotels = HotelSerializer(
        page.object_list,
        many=True,
    ).data

    return Response({
        "success": True,
        "message": "Hotels retrieved successfully",
        "data": {
            "items": serialized_hotels,
            "pagination": {
                "page": page.number,
                "limit": limit,
                "total": paginator.count,
                "totalPages": paginator.num_pages,
            },
        },
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return Response({
            "success": True,
            "message": "TrumiTrip API is running",
            "database": "connected",
        })

    except Exception:
        return Response({
            "success": False,
            "message": "Database connection failed",
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    data = request.data

    full_name = data.get("fullName", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirmPassword", "")
    phone = data.get("phone", "")

    if not full_name or not email or not password:
        return Response({
            "success": False,
            "message": "Full name, email and password are required",
        }, status=status.HTTP_400_BAD_REQUEST)

    if password != confirm_password:
        return Response({
            "success": False,
            "message": "Passwords do not match",
        }, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 8:
        return Response({
            "success": False,
            "message": "Password must contain at least 8 characters",
        }, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({
            "success": False,
            "message": "Email is already registered",
        }, status=status.HTTP_409_CONFLICT)
    if phone and User.objects.filter(phone=phone).exists():
        return Response({
            "success": False,
            "message": "Phone number is already registered",
        }, status=status.HTTP_409_CONFLICT)

    hashed_password = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    user = User.objects.create(
        id=uuid.uuid4(),
        fullName=full_name,
        email=email,
        phone=phone,
        passwordHash=hashed_password,
        role="CUSTOMER",
        isActive=True,
        isEmailVerified=False,
        createdAt=timezone.now(),
        updatedAt=timezone.now(),
    )

    refresh = RefreshToken.for_user(user)

    return Response({
        "success": True,
        "message": "Account created successfully",
        "data": {
            "user": UserSerializer(user).data,
            "accessToken": str(refresh.access_token),
            "refreshToken": str(refresh),
        },
    }, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({
            "success": False,
            "message": "Invalid email or password",
        }, status=status.HTTP_401_UNAUTHORIZED)

    try:
        password_valid = bcrypt.checkpw(
            password.encode("utf-8"),
            user.passwordHash.encode("utf-8")
        )
    except (ValueError, TypeError):
        password_valid = False

    if not password_valid:
        return Response({
            "success": False,
            "message": "Invalid email or password",
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not user.isActive:
        return Response({
            "success": False,
            "message": "Your account is inactive",
        }, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)

    return Response({
        "success": True,
        "message": "Login successful",
        "data": {
            "user": UserSerializer(user).data,
            "accessToken": str(refresh.access_token),
            "refreshToken": str(refresh),
        },
    })


@api_view(["GET"])
def me(request):
    return Response({
        "success": True,
        "data": {
            "user": UserSerializer(request.user).data
        },
    })


@api_view(["POST"])
def logout(request):
    return Response({
        "success": True,
        "message": "Logged out successfully",
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def hotel_list(request):
    hotels = (
        Hotel.objects
        .filter(isActive=True)
        .select_related("partner")
        .prefetch_related("rooms")
    )

    featured = request.query_params.get("featured")

    if featured is not None:
        hotels = hotels.filter(isFeatured=featured.lower() == "true")

    return hotel_page_response(request, hotels)


@api_view(["GET"])
@permission_classes([AllowAny])
def featured_hotels(request):
    hotels = (
        Hotel.objects
        .filter(isActive=True, isFeatured=True)
        .select_related("partner")
        .prefetch_related("rooms")
    )

    return hotel_page_response(request, hotels)


@api_view(["GET"])
@permission_classes([AllowAny])
def destinations(request):
    values = (
        Hotel.objects
        .filter(isActive=True)
        .exclude(destination__isnull=True)
        .exclude(destination="")
        .values_list("destination", flat=True)
        .distinct()
    )

    return Response({
        "success": True,
        "message": "Destinations retrieved successfully",
        "data": list(values),
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def hotel_detail(request, hotel_id):
    try:
        hotel = (
            Hotel.objects
            .select_related("partner")
            .prefetch_related("rooms")
            .get(id=hotel_id, isActive=True)
        )

    except Hotel.DoesNotExist:
        return Response({
            "success": False,
            "message": "Hotel not found",
        }, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "success": True,
        "message": "Hotel details retrieved successfully",
        "data": HotelSerializer(hotel).data,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def hotel_availability(request, hotel_id):
    check_in = request.query_params.get("checkIn")
    check_out = request.query_params.get("checkOut")

    if not check_in or not check_out:
        return Response({
            "success": False,
            "message": "Check-in and check-out dates are required",
        }, status=status.HTTP_400_BAD_REQUEST)

    rooms = Room.objects.filter(
        hotel_id=hotel_id,
        status="AVAILABLE"
    )

    return Response({
        "success": True,
        "message": "Available rooms retrieved successfully",
        "data": RoomSerializer(rooms, many=True).data,
    })
@api_view(["GET"])
@permission_classes([AllowAny])
def hotel_reviews(request, hotel_id):
    try:
        hotel = Hotel.objects.get(id=hotel_id, isActive=True)
    except Hotel.DoesNotExist:
        return Response({
            "success": False,
            "message": "Hotel not found",
        }, status=status.HTTP_404_NOT_FOUND)

    published_reviews = Review.objects.filter(
        hotel_id=hotel_id,
        isPublished=True,
    )

    summary_data = published_reviews.aggregate(
        average=Avg("rating"),
        total=Count("id"),
    )

    rating_distribution = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    }

    for item in published_reviews.values("rating").annotate(
        count=Count("id")
    ):
        rating = item["rating"]
        if rating in rating_distribution:
            rating_distribution[rating] = item["count"]

    reviews = published_reviews.select_related(
        "customer",
        "hotel",
    )

    rating_filter = request.query_params.get("rating")
    if rating_filter:
        try:
            rating_filter = int(rating_filter)
            if rating_filter < 1 or rating_filter > 5:
                raise ValueError
            reviews = reviews.filter(rating=rating_filter)
        except ValueError:
            return Response({
                "success": False,
                "message": "Rating must be between 1 and 5",
            }, status=status.HTTP_400_BAD_REQUEST)

    try:
        page_number = max(1, int(request.query_params.get("page", 1)))
        limit = max(1, min(int(request.query_params.get("limit", 10)), 100))
    except (TypeError, ValueError):
        page_number = 1
        limit = 10

    paginator = Paginator(reviews.order_by("-createdAt"), limit)
    page = paginator.get_page(page_number)

    review_items = []

    for review in page.object_list:
        review_items.append({
            "id": str(review.id),
            "rating": review.rating,
            "comment": review.comment,
            "isPublished": review.isPublished,
            "createdAt": review.createdAt.isoformat(),
            "updatedAt": review.updatedAt.isoformat(),
            "customer": {
                "id": str(review.customer.id),
                "fullName": review.customer.fullName,
                "avatar": review.customer.avatar,
            },
            "hotel": {
                "id": str(review.hotel.id),
                "name": review.hotel.name,
            },
        })

    return Response({
        "success": True,
        "message": "Hotel reviews retrieved",
        "data": {
            "hotel": {
                "id": str(hotel.id),
                "name": hotel.name,
            },
            "summary": {
                "averageRating": (
                    float(summary_data["average"])
                    if summary_data["average"] is not None
                    else None
                ),
                "totalReviews": summary_data["total"],
                "ratingDistribution": rating_distribution,
            },
            "pagination": {
                "page": page.number,
                "limit": limit,
                "total": paginator.count,
                "totalPages": paginator.num_pages,
            },
            "reviews": review_items,
        },
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_reviews(request):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    reviews = Review.objects.select_related(
        "customer",
        "hotel",
    ).all()

    # Optional publication status filter
    published_filter = request.query_params.get("isPublished")
    if published_filter is not None:
        value = published_filter.strip().lower()

        if value in ("true", "1"):
            reviews = reviews.filter(isPublished=True)
        elif value in ("false", "0"):
            reviews = reviews.filter(isPublished=False)
        else:
            return Response({
                "success": False,
                "message": "isPublished must be true or false.",
            }, status=status.HTTP_400_BAD_REQUEST)

    # Optional rating filter
    rating_filter = request.query_params.get("rating")
    if rating_filter:
        try:
            rating_filter = int(rating_filter)
            if rating_filter < 1 or rating_filter > 5:
                raise ValueError
        except (TypeError, ValueError):
            return Response({
                "success": False,
                "message": "Rating must be between 1 and 5.",
            }, status=status.HTTP_400_BAD_REQUEST)

        reviews = reviews.filter(rating=rating_filter)

    # Optional hotel filter
    hotel_id = request.query_params.get("hotelId")
    if hotel_id:
        reviews = reviews.filter(hotel_id=hotel_id)

    # Pagination
    try:
        page_number = max(1, int(request.query_params.get("page", 1)))
        limit = max(1, min(int(request.query_params.get("limit", 50)), 100))
    except (TypeError, ValueError):
        page_number = 1
        limit = 50

    paginator = Paginator(reviews.order_by("-createdAt"), limit)
    page = paginator.get_page(page_number)

    review_items = []

    for review in page.object_list:
        review_items.append({
            "id": str(review.id),
            "rating": review.rating,
            "comment": review.comment,
            "isPublished": review.isPublished,
            "createdAt": review.createdAt.isoformat(),
            "updatedAt": review.updatedAt.isoformat(),
            "customer": {
                "id": str(review.customer.id),
                "fullName": review.customer.fullName,
                "avatar": review.customer.avatar,
                "email": review.customer.email,
            },
            "hotel": {
                "id": str(review.hotel.id),
                "name": review.hotel.name,
            },
        })

    return Response({
        "success": True,
        "message": "Admin reviews retrieved successfully.",
        "data": {
            "pagination": {
                "page": page.number,
                "limit": limit,
                "total": paginator.count,
                "totalPages": paginator.num_pages,
            },
            "reviews": review_items,
        },
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def moderate_review(request, review_id):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    is_published = request.data.get("isPublished")

    if not isinstance(is_published, bool):
        return Response({
            "success": False,
            "message": "isPublished must be true or false.",
        }, status=status.HTTP_400_BAD_REQUEST)

    review = Review.objects.filter(id=review_id).first()

    if not review:
        return Response({
            "success": False,
            "message": "Review not found.",
        }, status=status.HTTP_404_NOT_FOUND)

    # The optional reason is accepted for frontend compatibility.
    # The current Review table has no moderation-reason column.

    Review.objects.filter(id=review_id).update(
        isPublished=is_published,
        updatedAt=timezone.now(),
    )

    review.refresh_from_db()

    return Response({
        "success": True,
        "message": (
            "Review published successfully."
            if is_published
            else "Review hidden successfully."
        ),
        "data": {
            "id": str(review.id),
            "rating": review.rating,
            "comment": review.comment,
            "isPublished": review.isPublished,
            "createdAt": review.createdAt.isoformat(),
            "updatedAt": review.updatedAt.isoformat(),
            "customer": {
                "id": str(review.customer.id),
                "fullName": review.customer.fullName,
                "avatar": review.customer.avatar,
                "email": review.customer.email,
            },
            "hotel": {
                "id": str(review.hotel.id),
                "name": review.hotel.name,
            },
        },
    })



# ---------------------------------------------------------------------------
# Partner Hotels
# ---------------------------------------------------------------------------

def get_authenticated_partner(request):
    if not request.user or not request.user.is_authenticated:
        return None, Response(
            {"success": False, "message": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if getattr(request.user, "role", "") != "PARTNER":
        return None, Response(
            {"success": False, "message": "Only partners can manage partner hotels."},
            status=status.HTTP_403_FORBIDDEN,
        )

    profile = PartnerProfile.objects.filter(user_id=request.user.id).first()
    if not profile:
        return None, Response(
            {"success": False, "message": "Partner profile not found for this account."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if profile.status != "APPROVED":
        return None, Response(
            {"success": False, "message": "Your partner account is pending approval."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return profile, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def partner_hotels(request):
    profile, error_response = get_authenticated_partner(request)
    if error_response:
        return error_response

    if request.method == "GET":
        hotels = (
            Hotel.objects
            .filter(partner_id=profile.id)
            .select_related("partner")
            .prefetch_related("rooms")
        )
        return hotel_page_response(request, hotels)

    # POST - Create hotel
    data = request.data or {}

    name = str(data.get("name") or "").strip()
    if not name:
        return Response(
            {"success": False, "message": "Hotel name is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(name) > 200:
        return Response(
            {"success": False, "message": "Hotel name must be 200 characters or fewer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    city = str(data.get("city") or "").strip()
    if not city:
        return Response(
            {"success": False, "message": "City is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(city) > 120:
        return Response(
            {"success": False, "message": "City must be 120 characters or fewer."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    address = str(data.get("address") or "").strip()
    if not address:
        return Response(
            {"success": False, "message": "Street address is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    destination = str(data.get("destination") or "").strip()
    if destination and len(destination) > 120:
        destination = destination[:120]
    if not destination:
        destination = city

    description = str(data.get("description") or "").strip()

    price_raw = data.get("pricePerNight")
    if price_raw is None or str(price_raw).strip() == "":
        return Response(
            {"success": False, "message": "Starting price per night is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        price_per_night = Decimal(str(price_raw)).quantize(Decimal("0.01"))
        if price_per_night <= 0:
            raise ValueError
    except (ValueError, TypeError, ArithmeticError):
        return Response(
            {"success": False, "message": "Starting price per night must be a valid positive number."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    original_price_raw = data.get("originalPrice")
    original_price = None
    if original_price_raw not in (None, ""):
        try:
            original_price = Decimal(str(original_price_raw)).quantize(Decimal("0.01"))
            if original_price <= 0:
                raise ValueError
        except (ValueError, TypeError, ArithmeticError):
            return Response(
                {"success": False, "message": "Original price must be a valid positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    star_rating_raw = data.get("starRating")
    star_rating = None
    if star_rating_raw not in (None, ""):
        try:
            star_rating = int(star_rating_raw)
            if star_rating < 1 or star_rating > 5:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"success": False, "message": "Star rating must be an integer between 1 and 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    lat_raw = data.get("latitude")
    latitude = None
    if lat_raw not in (None, ""):
        try:
            latitude = Decimal(str(lat_raw)).quantize(Decimal("0.0000001"))
            if latitude < -90 or latitude > 90:
                raise ValueError
        except (ValueError, TypeError, ArithmeticError):
            return Response(
                {"success": False, "message": "Latitude must be between -90 and 90."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    lon_raw = data.get("longitude")
    longitude = None
    if lon_raw not in (None, ""):
        try:
            longitude = Decimal(str(lon_raw)).quantize(Decimal("0.0000001"))
            if longitude < -180 or longitude > 180:
                raise ValueError
        except (ValueError, TypeError, ArithmeticError):
            return Response(
                {"success": False, "message": "Longitude must be between -180 and 180."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    main_image = str(data.get("mainImage") or "").strip() or None

    gallery_images_raw = data.get("galleryImages")
    if isinstance(gallery_images_raw, list):
        gallery_images = [str(img).strip() for img in gallery_images_raw if str(img).strip()]
    elif isinstance(gallery_images_raw, str) and gallery_images_raw.strip():
        gallery_images = [img.strip() for img in gallery_images_raw.split(",") if img.strip()]
    else:
        gallery_images = []

    amenities_raw = data.get("amenities")
    if isinstance(amenities_raw, list):
        amenities = [str(a).strip() for a in amenities_raw if str(a).strip()]
    elif isinstance(amenities_raw, str) and amenities_raw.strip():
        amenities = [a.strip() for a in amenities_raw.split(",") if a.strip()]
    else:
        amenities = []

    check_in_time = str(data.get("checkInTime") or "").strip() or "14:00"
    if len(check_in_time) > 20:
        check_in_time = check_in_time[:20]

    check_out_time = str(data.get("checkOutTime") or "").strip() or "11:00"
    if len(check_out_time) > 20:
        check_out_time = check_out_time[:20]

    now = timezone.now()
    hotel = Hotel.objects.create(
        id=uuid.uuid4(),
        name=name,
        description=description or None,
        city=city,
        destination=destination,
        address=address,
        latitude=latitude,
        longitude=longitude,
        starRating=star_rating,
        ratingScore=None,
        reviewCount=0,
        pricePerNight=price_per_night,
        originalPrice=original_price,
        mainImage=main_image,
        galleryImages=gallery_images,
        amenities=amenities,
        checkInTime=check_in_time,
        checkOutTime=check_out_time,
        isFeatured=False,
        isActive=False,
        partner=profile,
        createdAt=now,
        updatedAt=now,
    )

    hotel = (
        Hotel.objects
        .select_related("partner")
        .prefetch_related("rooms")
        .get(id=hotel.id)
    )

    return Response(
        {
            "success": True,
            "message": "Hotel created successfully.",
            "data": HotelSerializer(hotel).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def partner_hotel_detail(request, hotel_id):
    profile, error_response = get_authenticated_partner(request)
    if error_response:
        return error_response

    try:
        hotel = (
            Hotel.objects
            .select_related("partner")
            .prefetch_related("rooms")
            .get(id=hotel_id, partner_id=profile.id)
        )
    except Hotel.DoesNotExist:
        return Response(
            {"success": False, "message": "Hotel not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response(
            {
                "success": True,
                "message": "Hotel retrieved successfully.",
                "data": HotelSerializer(hotel).data,
            }
        )

    data = request.data or {}

    if "name" in data:
        name = str(data["name"] or "").strip()
        if not name:
            return Response(
                {"success": False, "message": "Hotel name cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hotel.name = name[:200]

    if "city" in data:
        city = str(data["city"] or "").strip()
        if not city:
            return Response(
                {"success": False, "message": "City cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hotel.city = city[:120]

    if "address" in data:
        address = str(data["address"] or "").strip()
        if not address:
            return Response(
                {"success": False, "message": "Street address cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hotel.address = address

    if "destination" in data:
        dest = str(data["destination"] or "").strip()
        hotel.destination = dest[:120] if dest else None

    if "description" in data:
        desc = str(data["description"] or "").strip()
        hotel.description = desc or None

    if "pricePerNight" in data:
        try:
            price = Decimal(str(data["pricePerNight"])).quantize(Decimal("0.01"))
            if price <= 0:
                raise ValueError
            hotel.pricePerNight = price
        except (ValueError, TypeError, ArithmeticError):
            return Response(
                {"success": False, "message": "Starting price per night must be a valid positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if "originalPrice" in data:
        raw = data["originalPrice"]
        if raw in (None, ""):
            hotel.originalPrice = None
        else:
            try:
                orig = Decimal(str(raw)).quantize(Decimal("0.01"))
                if orig <= 0:
                    raise ValueError
                hotel.originalPrice = orig
            except (ValueError, TypeError, ArithmeticError):
                return Response(
                    {"success": False, "message": "Original price must be a valid positive number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    if "starRating" in data:
        raw = data["starRating"]
        if raw in (None, ""):
            hotel.starRating = None
        else:
            try:
                star = int(raw)
                if star < 1 or star > 5:
                    raise ValueError
                hotel.starRating = star
            except (ValueError, TypeError):
                return Response(
                    {"success": False, "message": "Star rating must be an integer between 1 and 5."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    if "latitude" in data:
        raw = data["latitude"]
        if raw in (None, ""):
            hotel.latitude = None
        else:
            try:
                lat = Decimal(str(raw)).quantize(Decimal("0.0000001"))
                if lat < -90 or lat > 90:
                    raise ValueError
                hotel.latitude = lat
            except (ValueError, TypeError, ArithmeticError):
                return Response(
                    {"success": False, "message": "Latitude must be between -90 and 90."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    if "longitude" in data:
        raw = data["longitude"]
        if raw in (None, ""):
            hotel.longitude = None
        else:
            try:
                lon = Decimal(str(raw)).quantize(Decimal("0.0000001"))
                if lon < -180 or lon > 180:
                    raise ValueError
                hotel.longitude = lon
            except (ValueError, TypeError, ArithmeticError):
                return Response(
                    {"success": False, "message": "Longitude must be between -180 and 180."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    if "mainImage" in data:
        img = str(data["mainImage"] or "").strip()
        hotel.mainImage = img or None

    if "galleryImages" in data:
        raw = data["galleryImages"]
        if isinstance(raw, list):
            hotel.galleryImages = [str(i).strip() for i in raw if str(i).strip()]
        elif isinstance(raw, str) and raw.strip():
            hotel.galleryImages = [i.strip() for i in raw.split(",") if i.strip()]
        else:
            hotel.galleryImages = []

    if "amenities" in data:
        raw = data["amenities"]
        if isinstance(raw, list):
            hotel.amenities = [str(a).strip() for a in raw if str(a).strip()]
        elif isinstance(raw, str) and raw.strip():
            hotel.amenities = [a.strip() for a in raw.split(",") if a.strip()]
        else:
            hotel.amenities = []

    if "checkInTime" in data:
        cit = str(data["checkInTime"] or "").strip()
        hotel.checkInTime = cit[:20] if cit else "14:00"

    if "checkOutTime" in data:
        cot = str(data["checkOutTime"] or "").strip()
        hotel.checkOutTime = cot[:20] if cot else "11:00"

    hotel.updatedAt = timezone.now()
    hotel.save()

    return Response(
        {
            "success": True,
            "message": "Hotel updated successfully.",
            "data": HotelSerializer(hotel).data,
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def partner_hotel_status(request, hotel_id):
    profile, error_response = get_authenticated_partner(request)
    if error_response:
        return error_response

    try:
        hotel = Hotel.objects.get(id=hotel_id, partner_id=profile.id)
    except Hotel.DoesNotExist:
        return Response(
            {"success": False, "message": "Hotel not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    is_active = request.data.get("isActive")
    if is_active is None:
        return Response(
            {"success": False, "message": "isActive is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    hotel.isActive = bool(is_active)
    hotel.updatedAt = timezone.now()
    hotel.save()

    return Response(
        {
            "success": True,
            "message": f"Hotel {'activated' if hotel.isActive else 'deactivated'} successfully.",
            "data": HotelSerializer(hotel).data,
        }
    )



def get_authenticated_admin(request):
    if not request.user or not request.user.is_authenticated:
        return Response(
            {"success": False, "message": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    role = str(getattr(request.user, "role", "")).upper()
    if role not in ("ADMIN", "SUPER_ADMIN"):
        return Response(
            {"success": False, "message": "Administrator access required."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_hotels(request):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    hotels = (
        Hotel.objects
        .all()
        .select_related("partner")
        .prefetch_related("rooms")
        .order_by("-createdAt")
    )

    return hotel_page_response(request, hotels)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_hotel_detail(request, hotel_id):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    try:
        hotel = (
            Hotel.objects
            .select_related("partner")
            .prefetch_related("rooms")
            .get(id=hotel_id)
        )
    except Hotel.DoesNotExist:
        return Response(
            {"success": False, "message": "Hotel not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({
        "success": True,
        "message": "Hotel details retrieved successfully.",
        "data": HotelSerializer(hotel).data,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_hotel_status(request, hotel_id):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    is_active = request.data.get("isActive")
    if not isinstance(is_active, bool):
        return Response(
            {"success": False, "message": "isActive must be true or false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        hotel = Hotel.objects.get(id=hotel_id)
    except Hotel.DoesNotExist:
        return Response(
            {"success": False, "message": "Hotel not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    hotel.isActive = is_active
    hotel.updatedAt = timezone.now()
    hotel.save()

    return Response({
        "success": True,
        "message": f"Hotel {'approved and activated' if is_active else 'deactivated'} successfully.",
        "data": HotelSerializer(hotel).data,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_hotel_featured(request, hotel_id):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    is_featured = request.data.get("isFeatured")
    if not isinstance(is_featured, bool):
        return Response(
            {"success": False, "message": "isFeatured must be true or false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        hotel = Hotel.objects.get(id=hotel_id)
    except Hotel.DoesNotExist:
        return Response(
            {"success": False, "message": "Hotel not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if is_featured and not hotel.isActive:
        return Response(
            {"success": False, "message": "Approve the hotel before featuring it."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    hotel.isFeatured = is_featured
    hotel.updatedAt = timezone.now()
    hotel.save()

    return Response({
        "success": True,
        "message": f"Hotel {'featured' if is_featured else 'unfeatured'} successfully.",
        "data": HotelSerializer(hotel).data,
    })

def refresh_token(request):
    refresh_str = request.data.get("refreshToken") or request.data.get("refresh")
    if not refresh_str:
        return Response(
            {"success": False, "message": "Refresh token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        refresh = RefreshToken(refresh_str)
        access_token = str(refresh.access_token)
        return Response({
            "success": True,
            "data": {
                "accessToken": access_token,
                "refreshToken": str(refresh),
            },
        })
    except Exception:
        return Response(
            {"success": False, "message": "Invalid or expired refresh token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    total_bookings = Booking.objects.count()
    total_payments = Payment.objects.count()

    successful_revenue = (
        Payment.objects.filter(status__iexact="SUCCESS")
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    dashboard_data = {
        "users": {
            "total": User.objects.count(),
            "customers": User.objects.filter(role__iexact="CUSTOMER").count(),
            "partners": PartnerProfile.objects.count(),
        },
        "hotels": {
            "total": Hotel.objects.count(),
            "active": Hotel.objects.filter(isActive=True).count(),
            "featured": Hotel.objects.filter(
                isActive=True,
                isFeatured=True,
            ).count(),
        },
        "bookings": {
            "total": total_bookings,
            "confirmed": Booking.objects.filter(
                bookingStatus__iexact="CONFIRMED"
            ).count(),
            "pending": Booking.objects.filter(
                bookingStatus__iexact="PENDING"
            ).count(),
            "cancelled": Booking.objects.filter(
                bookingStatus__iexact="CANCELLED"
            ).count(),
        },
        "payments": {
            "total": total_payments,
            "successful": Payment.objects.filter(
                status__iexact="SUCCESS"
            ).count(),
            "pending": Payment.objects.filter(
                status__iexact="PENDING"
            ).count(),
            "revenue": str(successful_revenue),
        },
        "payouts": {
            "total": Payout.objects.count(),
            "pending": Payout.objects.filter(
                status__iexact="PENDING"
            ).count(),
            "processing": Payout.objects.filter(
                status__iexact="PROCESSING"
            ).count(),
            "completed": Payout.objects.filter(
                status__iexact="COMPLETED"
            ).count(),
            "failed": Payout.objects.filter(
                status__iexact="FAILED"
            ).count(),
        },
    }

    return Response({
        "success": True,
        "data": dashboard_data,
    })



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_analytics(request):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    today = timezone.localdate()
    start_date = today - timedelta(days=29)

    booking_trends = (
        Booking.objects
        .filter(createdAt__date__gte=start_date, createdAt__date__lte=today)
        .annotate(date=TruncDate("createdAt"))
        .values("date")
        .annotate(count=Count("id"))
        .order_by("date")
    )

    revenue_trends = (
        Payment.objects
        .filter(
            status__iexact="SUCCESS",
            paidAt__date__gte=start_date,
            paidAt__date__lte=today,
        )
        .annotate(date=TruncDate("paidAt"))
        .values("date")
        .annotate(revenue=Sum("amount"))
        .order_by("date")
    )

    booking_status = (
    Booking.objects
    .filter(createdAt__date__gte=start_date, createdAt__date__lte=today)
    .values("bookingStatus")
    .annotate(count=Count("id"))
    .order_by("bookingStatus")
)

    
    payment_status = (
        Payment.objects
        .filter(createdAt__date__gte=start_date, createdAt__date__lte=today)
        .values("status")
        .annotate(count=Count("id"))
        .order_by("status")
    )

    payout_status = (
        Payout.objects
        .filter(createdAt__date__gte=start_date, createdAt__date__lte=today)
        .values("status")
        .annotate(count=Count("id"), amount=Sum("netAmount"))
        .order_by("status")
    )

    return Response({
        "success": True,
        "data": {
            "period": {
                "startDate": str(start_date),
                "endDate": str(today),
                "days": 30,
            },
            "bookingTrends": [
                {
                    "date": str(item["date"]),
                    "count": item["count"],
                }
                for item in booking_trends
            ],
            "revenueTrends": [
                {
                    "date": str(item["date"]),
                    "revenue": str(item["revenue"] or Decimal("0.00")),
                }
                for item in revenue_trends
            ],
            "bookingStatus": [
                {
                    "status": item["bookingStatus"],
                    "count": item["count"],
                }
                for item in booking_status
            ],
            "paymentStatus": [
                {
                    "status": item["status"],
                    "count": item["count"],
                }
                for item in payment_status
            ],
            "payoutStatus": [
                {
                    "status": item["status"],
                    "count": item["count"],
                    "amount": str(item["amount"] or Decimal("0.00")),
                }
                for item in payout_status
            ],
        },
    })
    

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_vendors(request):
    error_response = get_authenticated_admin(request)
    if error_response:
        return error_response

    vendors = (
        PartnerProfile.objects
        .select_related("user")
        .annotate(hotelCount=Count("hotels"))
        .order_by("-createdAt")
    )

    search = request.query_params.get("search", "").strip()
    vendor_status = request.query_params.get("status", "").strip().upper()

    if search:
        vendors = vendors.filter(
            Q(businessName__icontains=search)
            | Q(businessEmail__icontains=search)
            | Q(businessPhone__icontains=search)
            | Q(user__fullName__icontains=search)
            | Q(user__email__icontains=search)
        )

    if vendor_status:
        vendors = vendors.filter(status=vendor_status)

    try:
        page_number = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page_number = 1

    try:
        limit = int(request.query_params.get("limit", 20))
        limit = max(1, min(limit, 100))
    except (TypeError, ValueError):
        limit = 20

    paginator = Paginator(vendors, limit)
    page = paginator.get_page(page_number)

    items = []

    for vendor in page.object_list:
        user = vendor.user

        items.append({
            "id": str(vendor.id),
            "businessName": vendor.businessName,
            "businessEmail": vendor.businessEmail,
            "businessPhone": vendor.businessPhone,
            "address": vendor.address,
            "documents": vendor.documents or [],
            "status": vendor.status,
            "commissionRate": str(vendor.commissionRate),
            "hotelCount": vendor.hotelCount,
            "user": {
                "id": str(user.id),
                "fullName": user.fullName,
                "email": user.email,
                "phone": user.phone,
                "role": user.role,
                "isActive": user.isActive,
            },
            "createdAt": vendor.createdAt.isoformat() if vendor.createdAt else None,
            "updatedAt": vendor.updatedAt.isoformat() if vendor.updatedAt else None,
        })

    return Response({
        "success": True,
        "message": "Vendors retrieved successfully",
        "data": {
            "items": items,
            "pagination": {
                "page": page.number,
                "limit": limit,
                "total": paginator.count,
                "totalPages": paginator.num_pages,
            },
        },
    })
