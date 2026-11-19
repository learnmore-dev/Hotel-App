import django
from django.views.decorators.csrf import csrf_exempt
from django.urls import path

from apps.core import views
from apps.core import payment_views
from apps.core import booking_views
from apps.core import payout_views
from django.http import HttpResponseNotAllowed

from django.conf import settings
from django.conf.urls.static import static
from apps.core import image_upload_views
from apps.core import views
from apps.core import payment_views
from apps.core import review_views

@csrf_exempt
def booking_collection(request):
    if request.method == "GET":
        return booking_views.get_my_bookings(request)

    if request.method == "POST":
        return booking_views.create_booking(request)

    return HttpResponseNotAllowed(["GET", "POST"])


# One URL supports both customer booking methods.

urlpatterns = [
    
    
    # Health
    path("api/health", views.health_check, name="health"),

    # Authentication
    path("api/auth/register", views.register, name="register"),
    path("api/auth/login", views.login, name="login"),
    path("api/auth/me", views.me, name="me"),
    path("api/auth/logout", views.logout, name="logout"),
    path("api/auth/refresh", views.refresh_token, name="refresh-token"),

    # Hotels
    path("api/hotels", views.hotel_list, name="hotel-list"),
    path("api/hotels/featured", views.featured_hotels, name="featured-hotels"),
    path("api/hotels/destinations", views.destinations, name="destinations"),
    path("api/hotels/<uuid:hotel_id>", views.hotel_detail, name="hotel-detail"),
    path(
        "api/hotels/<uuid:hotel_id>/rooms/availability",
        views.hotel_availability,
        name="hotel-availability",
    ),
    path(
    "api/partner/hotels/images",
    image_upload_views.upload_hotel_images,
    name="partner-upload-hotel-images",
    ),
    path(
        "api/partner/hotels",
        views.partner_hotels,
        name="partner-hotels",
    ),
    path(
        "api/partner/hotels/<uuid:hotel_id>",
        views.partner_hotel_detail,
        name="partner-hotel-detail",
    ),
    path(
        "api/partner/hotels/<uuid:hotel_id>/status",
        views.partner_hotel_status,
        name="partner-hotel-status",
),

path("api/admin/hotels", views.admin_hotels, name="admin-hotels"),
path("api/admin/hotels/<uuid:hotel_id>", views.admin_hotel_detail, name="admin-hotel-detail"),
path("api/admin/hotels/<uuid:hotel_id>/status", views.admin_hotel_status, name="admin-hotel-status"),
path("api/admin/hotels/<uuid:hotel_id>/featured", views.admin_hotel_featured, name="admin-hotel-featured"),

path(
    "api/admin/dashboard",
    views.admin_dashboard,
    name="admin-dashboard",
),
path(
    "api/admin/analytics",
    views.admin_analytics,
    name="admin-analytics",
),


    # Hotel Reviews
    
path(
    "api/reviews/hotel/<uuid:hotel_id>",
    views.hotel_reviews,
    name="hotel-reviews",
),

# Admin Reviews
path(
    "api/admin/reviews",
    views.admin_reviews,
    name="admin-reviews",
),
path(
    "api/admin/reviews/<uuid:review_id>/moderate",
    views.moderate_review,
    name="admin-moderate-review",
),

# Customer Reviews

path(
    "api/reviews",
    review_views.create_review,
    name="create-review",
),
path(
    "api/reviews/eligibility/<uuid:booking_id>",
    review_views.review_eligibility,
    name="review-eligibility",
),
path(
    "api/reviews/my",
    review_views.my_reviews,
    name="my-reviews",
),
path("api/reviews/<uuid:review_id>", review_views.review_detail, name="review-detail"),
path("api/reviews/<uuid:review_id>/update", review_views.update_review, name="update-review"),
path("api/reviews/<uuid:review_id>/delete", review_views.delete_review, name="delete-review"),
path(
    "api/reviews/<uuid:review_id>/update",
    review_views.update_review,
    name="update-review",
),
path(
    "api/reviews/<uuid:review_id>/delete",
    review_views.delete_review,
    name="delete-review",
),

# Partner Reviews

path(
    "api/partner/reviews",
    review_views.partner_reviews,
    name="partner-reviews",
),

    # Customer Bookings
    path("api/bookings", booking_collection, name="booking-collection"),
    # path("api/bookings", booking_views.get_my_bookings, name="booking-list"),
    # path("api/bookings", booking_views.create_booking, name="booking-create"),
    path(
        "api/bookings/<str:booking_id>/payment",
        payment_views.get_booking_payment,
        name="booking-payment",
    ),
    path(
        "api/bookings/<str:booking_id>/cancel",
        booking_views.cancel_my_booking,
        name="cancel-booking",
    ),
    path(
        "api/bookings/<str:booking_id>",
        booking_views.get_my_booking_by_id,
        name="my-booking-detail",
    ),

    # Partner Bookings
    path(
        "api/partner/bookings",
        booking_views.get_partner_bookings,
        name="partner-bookings",
    ),
    path(
        "api/partner/bookings/<str:booking_id>/status",
        booking_views.update_partner_booking_status,
        name="partner-update-booking-status",
    ),
    path(
        "api/partner/bookings/<str:booking_id>",
        booking_views.get_partner_booking_by_id,
        name="partner-booking-detail",
    ),

    # Admin Bookings
    path(
        "api/admin/bookings",
        booking_views.get_admin_bookings,
        name="admin-bookings",
    ),
    path(
        "api/admin/bookings/<str:booking_id>/status",
        booking_views.update_admin_booking_status,
        name="admin-update-booking-status",
    ),
    path(
        "api/admin/bookings/<str:booking_id>",
        booking_views.get_admin_booking_by_id,
        name="admin-booking-detail",
    ),

    # Payments
    path("api/payments", payment_views.create_payment, name="create-payment"),
    path(
        "api/payments/razorpay/order",
        payment_views.create_razorpay_order,
        name="create-razorpay-order",
    ),
    path(
        "api/payments/razorpay/verify",
        payment_views.verify_razorpay_payment,
        name="verify-razorpay-payment",
    ),
    path(
        "api/payments/razorpay/test-sign",
        payment_views.generate_test_payment_signature,
        name="generate-test-payment-signature",
    ),
    path(
        "api/payments/<str:payment_id>/refund",
        payment_views.refund_payment,
        name="refund-payment",
    ),
    path(
        "api/payments/<str:payment_id>",
        payment_views.get_payment_by_id,
        name="get-payment",
    ),

        # Partner Earnings and Payouts
    path(
        "api/partner/earnings/summary",
        payout_views.partner_earnings_summary,
        name="partner-earnings-summary",
    ),
    path(
        "api/partner/earnings/history",
        payout_views.partner_earnings_history,
        name="partner-earnings-history",
    ),
    path(
        "api/partner/payouts/request",
        payout_views.request_partner_payout,
        name="request-partner-payout",
    ),
    path(
        "api/partner/payouts",
        payout_views.get_partner_payouts,
        name="partner-payouts",
    ),

    # Admin Payouts

    path(
        "api/admin/vendors",
        views.admin_vendors,
        name="admin-vendors",
    ),
	
    path(
        "api/admin/payouts",
        payout_views.get_admin_payouts,
        name="admin-payouts",
    ),
    path(
        "api/admin/payouts/<str:payout_id>/status",
        payout_views.update_admin_payout_status,
        name="admin-update-payout-status",
    ),
    path(
        "api/admin/payouts/<str:payout_id>",
        payout_views.get_admin_payout_by_id,
        name="admin-payout-detail",
    ),
    path(
        "api/admin/partners/<str:partner_id>/commission",
        payout_views.update_partner_commission,
        name="admin-update-partner-commission",
    ),
]
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )