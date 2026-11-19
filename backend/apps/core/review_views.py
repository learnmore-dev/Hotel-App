
import uuid

from django.core.paginator import Paginator, EmptyPage
from django.db.models import Avg, Count
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Booking, Hotel, PartnerProfile, Review


# ---------------------------------------------------------
# Common helpers
# ---------------------------------------------------------

def review_error(message, http_status):
    return Response(
        {"success": False, "message": message},
        status=http_status,
    )


def review_success(data, message=None, http_status=status.HTTP_200_OK):
    result = {"success": True, "data": data}

    if message:
        result["message"] = message

    return Response(result, status=http_status)


def review_pagination(request):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        limit = max(1, min(50, int(request.query_params.get("limit", 10))))
    except (TypeError, ValueError):
        page, limit = 1, 10

    return page, limit


def serialize_customer(user, include_email=False):
    result = {
        "id": str(user.id),
        "fullName": user.fullName,
        "avatar": user.avatar,
    }

    if include_email:
        result["email"] = user.email

    return result


def serialize_hotel(hotel, include_details=False):
    result = {
        "id": str(hotel.id),
        "name": hotel.name,
    }

    if include_details:
        result.update({
            "city": hotel.city,
            "mainImage": hotel.mainImage,
            "starRating": hotel.starRating,
        })

    return result


def serialize_booking(booking, include_hotel=False):
    result = {
        "id": str(booking.id),
        "bookingId": booking.bookingId,
        "checkIn": booking.checkIn.isoformat(),
        "checkOut": booking.checkOut.isoformat(),
    }

    if include_hotel:
        result["hotel"] = {
            "id": str(booking.hotel.id),
            "name": booking.hotel.name,
            "city": booking.hotel.city,
            "mainImage": booking.hotel.mainImage,
        }

    return result


def serialize_review(review, include_email=False, include_partner_hotel=False):
    result = {
        "id": str(review.id),
        "rating": review.rating,
        "comment": review.comment,
        "isPublished": review.isPublished,
        "createdAt": review.createdAt.isoformat(),
        "updatedAt": review.updatedAt.isoformat(),
        "customer": serialize_customer(
            review.customer,
            include_email=include_email,
        ),
        "hotel": serialize_hotel(review.hotel),
        "booking": serialize_booking(review.booking),
    }

    if include_partner_hotel:
        result["hotel"]["city"] = review.hotel.city

    return result


def sync_hotel_rating(hotel_id):
    stats = Review.objects.filter(
        hotel_id=hotel_id,
        isPublished=True,
    ).aggregate(
        average=Avg("rating"),
        total=Count("id"),
    )

    Hotel.objects.filter(id=hotel_id).update(
        reviewCount=stats["total"] or 0,
        ratingScore=(
            round(float(stats["average"]), 2)
            if stats["average"] is not None
            else None
        ),
        updatedAt=timezone.now(),
    )


def booking_is_eligible(booking):
    if booking.bookingStatus == "COMPLETED":
        return True

    return (
        booking.bookingStatus == "CONFIRMED"
        and booking.checkOut <= timezone.localdate()
        and booking.paymentStatus == "PAID"
    )


def get_booking_eligibility_error(booking, customer_id):
    if str(booking.customer_id) != str(customer_id):
        return "You are not authorized to review this booking", status.HTTP_403_FORBIDDEN

    if booking.bookingStatus == "CANCELLED":
        return "Cancelled bookings cannot be reviewed", status.HTTP_400_BAD_REQUEST

    if not booking_is_eligible(booking):
        return (
            "Reviews can only be submitted for completed stays after checkout",
            status.HTTP_400_BAD_REQUEST,
        )

    if Review.objects.filter(booking_id=booking.id).exists():
        return (
            "A review has already been submitted for this booking",
            status.HTTP_409_CONFLICT,
        )

    return None


def paginate_reviews(request, queryset):
    page, limit = review_pagination(request)
    paginator = Paginator(queryset, limit)

    try:
        page_obj = paginator.page(page)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages or 1)

    return {
        "page": page_obj.number,
        "limit": limit,
        "total": paginator.count,
        "totalPages": max(1, paginator.num_pages),
    }, page_obj.object_list


def customer_role_required(request):
    if getattr(request.user, "role", "") != "CUSTOMER":
        return review_error(
            "Only customers can perform this action.",
            status.HTTP_403_FORBIDDEN,
        )
    return None


# ---------------------------------------------------------
# Review eligibility
# GET /api/reviews/eligibility/<booking_id>
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_eligibility(request, booking_id):
    role_error = customer_role_required(request)
    if role_error:
        return role_error

    booking = (
        Booking.objects
        .select_related("hotel")
        .filter(id=booking_id)
        .first()
    )

    if not booking:
        return review_success({
            "eligible": False,
            "reason": "Booking not found",
            "booking": None,
        })

    if str(booking.customer_id) != str(request.user.id):
        return review_success({
            "eligible": False,
            "reason": "Booking does not belong to you",
            "booking": None,
        })

    existing_review = (
        Review.objects
        .select_related("customer", "hotel", "booking")
        .filter(booking_id=booking.id)
        .first()
    )

    if existing_review:
        return review_success({
            "eligible": False,
            "alreadyReviewed": True,
            "existingReview": serialize_review(existing_review),
            "booking": serialize_booking(booking, include_hotel=True),
        })

    if booking.bookingStatus == "CANCELLED":
        return review_success({
            "eligible": False,
            "reason": "Booking was cancelled",
            "booking": None,
        })

    if not booking_is_eligible(booking):
        return review_success({
            "eligible": False,
            "reason": "Stay is not yet completed",
            "booking": serialize_booking(booking, include_hotel=True),
        })

    return review_success({
        "eligible": True,
        "booking": serialize_booking(booking, include_hotel=True),
    })


# ---------------------------------------------------------
# Create review
# POST /api/reviews
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_review(request):
    role_error = customer_role_required(request)
    if role_error:
        return role_error

    booking_id = request.data.get("bookingId")
    rating = request.data.get("rating")
    comment = request.data.get("comment", "")

    if not booking_id or rating is None:
        return review_error(
            "bookingId and rating are required.",
            status.HTTP_400_BAD_REQUEST,
        )

    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return review_error(
            "Rating must be an integer between 1 and 5.",
            status.HTTP_400_BAD_REQUEST,
        )

    if rating < 1 or rating > 5:
        return review_error(
            "Rating must be between 1 and 5.",
            status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(comment, str):
        return review_error(
            "Comment must be text.",
            status.HTTP_400_BAD_REQUEST,
        )

    booking = (
        Booking.objects
        .select_related("hotel")
        .filter(id=booking_id)
        .first()
    )

    if not booking:
        return review_error("Booking not found.", status.HTTP_404_NOT_FOUND)

    eligibility_error = get_booking_eligibility_error(
        booking,
        request.user.id,
    )

    if eligibility_error:
        message, http_status = eligibility_error
        return review_error(message, http_status)

    now = timezone.now()

    review = Review.objects.create(
        id=uuid.uuid4(),
        customer_id=request.user.id,
        hotel_id=booking.hotel_id,
        booking_id=booking.id,
        rating=rating,
        comment=comment.strip(),
        isPublished=True,
        createdAt=now,
        updatedAt=now,
    )

    sync_hotel_rating(booking.hotel_id)

    review = (
        Review.objects
        .select_related("customer", "hotel", "booking")
        .get(id=review.id)
    )

    return review_success(
        serialize_review(review),
        message="Review submitted successfully.",
        http_status=status.HTTP_201_CREATED,
    )


# ---------------------------------------------------------
# Customer review list
# GET /api/reviews/my
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_reviews(request):
    role_error = customer_role_required(request)
    if role_error:
        return role_error

    queryset = (
        Review.objects
        .filter(customer_id=request.user.id)
        .select_related("customer", "hotel", "booking")
        .order_by("-createdAt")
    )

    pagination, reviews = paginate_reviews(request, queryset)

    return review_success({
        "pagination": pagination,
        "reviews": [serialize_review(review) for review in reviews],
    })


# ---------------------------------------------------------
# Review details
# GET /api/reviews/<review_id>
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def review_detail(request, review_id):
    review = (
        Review.objects
        .select_related("customer", "hotel", "booking")
        .filter(id=review_id)
        .first()
    )

    if not review:
        return review_error("Review not found.", status.HTTP_404_NOT_FOUND)

    role = str(getattr(request.user, "role", "")).upper()
    is_admin = role in ("ADMIN", "SUPER_ADMIN")
    is_owner = str(review.customer_id) == str(request.user.id)

    if not review.isPublished and not (is_owner or is_admin):
        return review_error("Review not found.", status.HTTP_404_NOT_FOUND)

    return review_success(
        serialize_review(review, include_email=is_admin)
    )


# ---------------------------------------------------------
# Update customer review
# PUT /api/reviews/<review_id>
# ---------------------------------------------------------

@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_review(request, review_id):
    role_error = customer_role_required(request)
    if role_error:
        return role_error

    review = Review.objects.filter(id=review_id).first()

    if not review:
        return review_error("Review not found.", status.HTTP_404_NOT_FOUND)

    if str(review.customer_id) != str(request.user.id):
        return review_error(
            "You are not authorized to update this review.",
            status.HTTP_403_FORBIDDEN,
        )

    if "rating" in request.data:
        try:
            rating = int(request.data["rating"])
        except (TypeError, ValueError):
            return review_error(
                "Rating must be an integer between 1 and 5.",
                status.HTTP_400_BAD_REQUEST,
            )

        if rating < 1 or rating > 5:
            return review_error(
                "Rating must be between 1 and 5.",
                status.HTTP_400_BAD_REQUEST,
            )

        review.rating = rating

    if "comment" in request.data:
        if not isinstance(request.data["comment"], str):
            return review_error(
                "Comment must be text.",
                status.HTTP_400_BAD_REQUEST,
            )
        review.comment = request.data["comment"].strip()

    review.updatedAt = timezone.now()
    review.save()

    if review.isPublished:
        sync_hotel_rating(review.hotel_id)

    review = (
        Review.objects
        .select_related("customer", "hotel", "booking")
        .get(id=review.id)
    )

    return review_success(
        serialize_review(review),
        message="Review updated successfully.",
    )


# ---------------------------------------------------------
# Delete customer review
# DELETE /api/reviews/<review_id>
# ---------------------------------------------------------

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_review(request, review_id):
    role_error = customer_role_required(request)
    if role_error:
        return role_error

    review = Review.objects.filter(id=review_id).first()

    if not review:
        return review_error("Review not found.", status.HTTP_404_NOT_FOUND)

    if str(review.customer_id) != str(request.user.id):
        return review_error(
            "You are not authorized to delete this review.",
            status.HTTP_403_FORBIDDEN,
        )

    hotel_id = review.hotel_id
    was_published = review.isPublished

    review.delete()

    if was_published:
        sync_hotel_rating(hotel_id)

    return review_success(
        {"deleted": True},
        message="Review deleted successfully.",
    )


# ---------------------------------------------------------
# Partner reviews
# GET /api/partner/reviews
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def partner_reviews(request):
    if getattr(request.user, "role", "") != "PARTNER":
        return review_error(
            "Only partners can view partner reviews.",
            status.HTTP_403_FORBIDDEN,
        )

    profile = PartnerProfile.objects.filter(
        user_id=request.user.id
    ).first()

    if not profile:
        return review_error(
            "Partner profile not found.",
            status.HTTP_403_FORBIDDEN,
        )

    hotels = list(
        Hotel.objects
        .filter(partner_id=profile.id)
        .values("id", "name")
    )

    hotel_ids = [hotel["id"] for hotel in hotels]

    if not hotel_ids:
        return review_success({
            "hotels": [],
            "pagination": {
                "page": 1,
                "limit": review_pagination(request)[1],
                "total": 0,
                "totalPages": 1,
            },
            "reviews": [],
        })

    hotel_id = request.query_params.get("hotelId")
    rating = request.query_params.get("rating")

    if hotel_id:
        if str(hotel_id) not in [str(item) for item in hotel_ids]:
            return review_error(
                "You are not authorized to view reviews for this hotel.",
                status.HTTP_403_FORBIDDEN,
            )
        hotel_ids = [hotel_id]

    queryset = (
        Review.objects
        .filter(hotel_id__in=hotel_ids)
        .select_related("customer", "hotel", "booking")
        .order_by("-createdAt")
    )

    if rating:
        try:
            rating_value = int(rating)
            if rating_value < 1 or rating_value > 5:
                raise ValueError
        except (TypeError, ValueError):
            return review_error(
                "Rating filter must be between 1 and 5.",
                status.HTTP_400_BAD_REQUEST,
            )
        queryset = queryset.filter(rating=rating_value)

    pagination, reviews = paginate_reviews(request, queryset)

    return review_success({
        "hotels": [
            {"id": str(hotel["id"]), "name": hotel["name"]}
            for hotel in hotels
        ],
        "pagination": pagination,
        "reviews": [
            serialize_review(review, include_partner_hotel=True)
            for review in reviews
        ],
    })

@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def review_detail_update_delete(request, review_id):
    if request.method == "GET":
        return review_detail(request, review_id)

    if request.method == "PUT":
        return update_review(request, review_id)

    if request.method == "DELETE":
        return delete_review(request, review_id)
