
import os
import uuid
import hmac
import hashlib

import razorpay

from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from urllib3 import request

from apps.core.models import (
    Booking,
    Payment,
    PartnerProfile,
)


# ---------------------------------------------------------
# Common response helpers
# ---------------------------------------------------------

def api_error(message, status_code):
    return Response(
        {
            "success": False,
            "message": message,
        },
        status=status_code,
    )


def api_success(message, data=None, status_code=status.HTTP_200_OK):
    return Response(
        {
            "success": True,
            "message": message,
            "data": data,
        },
        status=status_code,
    )


# ---------------------------------------------------------
# Database helpers
# ---------------------------------------------------------

def find_booking(booking_id):
    try:
        return Booking.objects.select_related(
            "customer",
            "hotel",
        ).filter(
            id=booking_id
        ).first() or Booking.objects.select_related(
            "customer",
            "hotel",
        ).filter(
            bookingId=booking_id
        ).first()
    except Exception:
        return None


def find_payment(payment_id):
    try:
        return Payment.objects.select_related(
            "booking",
            "customer",
            "booking__hotel",
        ).filter(id=payment_id).first()
    except Exception:
        return None


def payment_detail(payment):
    if not payment:
        return None

    return {
        "id": str(payment.id),
        "bookingId": str(payment.booking_id),
        "customerId": str(payment.customer_id),
        "amount": float(payment.amount),
        "currency": payment.currency,
        "paymentMethod": payment.paymentMethod,
        "transactionId": payment.transactionId,
        "gatewayOrderId": payment.gatewayOrderId,
        "gatewayPaymentId": payment.gatewayPaymentId,
        "status": payment.status,
        "gateway": payment.gateway,
        "paidAt": (
            payment.paidAt.isoformat()
            if payment.paidAt else None
        ),
        "createdAt": payment.createdAt.isoformat(),
        "updatedAt": payment.updatedAt.isoformat(),
    }


def get_partner_profile(user):
    return PartnerProfile.objects.filter(
        user=user,
        status="APPROVED",
    ).first()


def can_access_payment(user, payment):
    if user.role == "ADMIN":
        return True

    if user.role == "CUSTOMER":
        return str(payment.customer_id) == str(user.id)

    if user.role == "PARTNER":
        partner = get_partner_profile(user)

        if not partner:
            return False

        return str(payment.booking.hotel.partner_id) == str(partner.id)

    return False


# ---------------------------------------------------------
# Razorpay helpers
# ---------------------------------------------------------

def razorpay_credentials():
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    return key_id, key_secret


def is_production():
    return (
        os.getenv("DJANGO_DEBUG", "").lower() == "false"
        or os.getenv("NODE_ENV", "").lower() == "production"
        or not settings.DEBUG
    )


def razorpay_client():
    key_id, key_secret = razorpay_credentials()

    if not key_id or not key_secret:
        return None

    try:
        return razorpay.Client(
            auth=(key_id, key_secret)
        )
    except Exception:
        return None


def get_razorpay_secret():
    _, secret = razorpay_credentials()

    if secret:
        return secret

    return "trumitrip_test_secret"


# ---------------------------------------------------------
# 1. Create payment
# POST /api/payments
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_payment(request):

    if request.user.role != "CUSTOMER":
        return api_error(
            "Only customers can make payments.",
            status.HTTP_403_FORBIDDEN,
        )

    booking_id = request.data.get("bookingId")
    payment_method = request.data.get("paymentMethod")

    if not booking_id or not payment_method:
        return api_error(
            "Booking ID and payment method are required.",
            status.HTTP_400_BAD_REQUEST,
        )

    allowed_methods = [
        "UPI",
        "CARD",
        "NET_BANKING",
        "PAY_AT_HOTEL",
    ]

    if payment_method not in allowed_methods:
        return api_error(
            "Invalid payment method.",
            status.HTTP_400_BAD_REQUEST,
        )

    booking = find_booking(booking_id)

    if not booking:
        return api_error(
            "Booking not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if str(booking.customer_id) != str(request.user.id):
        return api_error(
            "You cannot pay for this booking.",
            status.HTTP_403_FORBIDDEN,
        )

    if booking.bookingStatus == "CANCELLED":
        return api_error(
            "Cancelled bookings cannot be paid.",
            status.HTTP_400_BAD_REQUEST,
        )

    existing = Payment.objects.filter(
        booking=booking
    ).first()

    if existing and existing.status == "SUCCESS":
        return api_error(
            "This booking has already been paid.",
            status.HTTP_409_CONFLICT,
        )

    now = timezone.now()

    simulate_status = str(
        request.data.get("simulateStatus", "SUCCESS")
    ).upper()

    if payment_method == "PAY_AT_HOTEL":
        payment_status = "PENDING"
        transaction_id = f"HOTEL_{uuid.uuid4().hex}"
    elif simulate_status == "FAILED":
        payment_status = "FAILED"
        transaction_id = f"FAIL_{uuid.uuid4().hex}"
    else:
        payment_status = "SUCCESS"
        transaction_id = f"TXN_{uuid.uuid4().hex}"

    try:
        with transaction.atomic():

            payment = existing

            if not payment:
                payment = Payment(
                    id=uuid.uuid4(),
                    booking=booking,
                    customer=request.user,
                    createdAt=now,
                )

            payment.amount = booking.totalAmount
            payment.currency = "INR"
            payment.paymentMethod = payment_method
            payment.transactionId = transaction_id
            payment.status = payment_status
            payment.gateway = "MOCK"
            payment.gatewayResponse = {
                "simulated": True,
                "status": payment_status,
            }
            payment.updatedAt = now

            if payment_status == "SUCCESS":
                payment.paidAt = now

            payment.save()

            if payment_status == "SUCCESS":
                booking.paymentStatus = "PAID"
                booking.bookingStatus = "CONFIRMED"
            elif payment_method == "PAY_AT_HOTEL":
                booking.paymentStatus = "PENDING"
            else:
                booking.paymentStatus = "PENDING"

            booking.updatedAt = now
            booking.save()

        return api_success(
            "Payment processed successfully."
            if payment_status == "SUCCESS"
            else "Payment is pending or failed.",
            payment_detail(payment),
        )

    except Exception:
        return api_error(
            "Unable to create payment.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---------------------------------------------------------
# 2. Create Razorpay order
# POST /api/payments/razorpay/order
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    print("PAYMENT DEBUG USER:", request.user.id, request.user.role)
    print("PAYMENT DEBUG BOOKING ID:", request.data.get("bookingId"))

    if request.user.role != "CUSTOMER":
        return api_error(
            "Only customers can create payment orders.",
            status.HTTP_403_FORBIDDEN,
        )

    booking_id = request.data.get("bookingId")

    if not booking_id:
        return api_error(
            "Booking ID is required.",
            status.HTTP_400_BAD_REQUEST,
        )

    booking = find_booking(booking_id)

    if not booking:
        return api_error(
            "Booking not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if str(booking.customer_id) != str(request.user.id):
        return api_error(
            "You cannot pay for this booking.",
            status.HTTP_403_FORBIDDEN,
        )

    if booking.bookingStatus == "CANCELLED":
        return api_error(
            "Cancelled bookings cannot be paid.",
            status.HTTP_400_BAD_REQUEST,
        )

    existing = Payment.objects.filter(
        booking=booking
    ).first()

    if existing and existing.status == "SUCCESS":
        return api_error(
            "This booking has already been paid.",
            status.HTTP_409_CONFLICT,
        )

    amount = int(
        Decimal(str(booking.totalAmount)) * 100
    )

    client = razorpay_client()
    key_id, _ = razorpay_credentials()

    try:
        if client:
            order = client.order.create({
                "amount": amount,
                "currency": "INR",
                "receipt": str(booking.bookingId),
            })
            order_id = order["id"]
        else:
            if is_production():
                return api_error(
                    "Payment gateway is not configured.",
                    status.HTTP_502_BAD_GATEWAY,
                )

            order_id = f"order_test_{uuid.uuid4().hex}"

        now = timezone.now()

        with transaction.atomic():
            payment = existing

            if not payment:
                payment = Payment(
                    id=uuid.uuid4(),
                    booking=booking,
                    customer=request.user,
                    createdAt=now,
                )

            payment.amount = booking.totalAmount
            payment.currency = "INR"
            payment.paymentMethod = "CARD"
            payment.gateway = "RAZORPAY"
            payment.gatewayOrderId = order_id
            payment.status = "PENDING"
            payment.gatewayResponse = {
                "orderId": order_id,
            }
            payment.updatedAt = now
            payment.save()

        hotel = booking.hotel

        return api_success(
            "Razorpay order created successfully.",
            {
                "keyId": key_id or "rzp_test_demo",
                "orderId": order_id,
                "amount": amount,
                "currency": "INR",
                "bookingId": str(booking.id),
                "bookingRef": booking.bookingId,
                "hotelName": hotel.name,
                "customerName": request.user.fullName,
                "customerEmail": request.user.email,
                "customerPhone": request.user.phone,
                "customer": {
                    "name": request.user.fullName,
                    "email": request.user.email,
                    "contact": request.user.phone,
                },
            },
        )

    except Exception:
        return api_error(
            "Unable to create Razorpay order.",
            status.HTTP_502_BAD_GATEWAY,
        )


# ---------------------------------------------------------
# 3. Verify Razorpay payment
# POST /api/payments/razorpay/verify
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):

    order_id = request.data.get("razorpayOrderId")
    payment_id = request.data.get("razorpayPaymentId")
    signature = request.data.get("razorpaySignature")

    if not order_id or not payment_id or not signature:
        return api_error(
            "Razorpay payment details are required.",
            status.HTTP_400_BAD_REQUEST,
        )

    payment = Payment.objects.select_related(
        "booking",
        "customer",
    ).filter(
        gatewayOrderId=order_id,
    ).first()

    if not payment:
        return api_error(
            "Payment order not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if str(payment.customer_id) != str(request.user.id):
        return api_error(
            "You cannot verify this payment.",
            status.HTTP_403_FORBIDDEN,
        )

    if payment.status == "SUCCESS":
        return api_success(
            "Payment is already verified.",
            payment_detail(payment),
        )

    if payment_id.startswith("pay_test_"):
        if is_production():
            return api_error(
                "Test payments are disabled in production.",
                status.HTTP_403_FORBIDDEN,
            )
    else:
        client = razorpay_client()

        if not client:
            return api_error(
                "Payment gateway is not configured.",
                status.HTTP_502_BAD_GATEWAY,
            )

    message = f"{order_id}|{payment_id}"

    expected_signature = hmac.new(
        get_razorpay_secret().encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        signature,
    ):
        return api_error(
            "Invalid payment signature.",
            status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()

    try:
        with transaction.atomic():

            payment.status = "SUCCESS"
            payment.gatewayPaymentId = payment_id
            payment.gatewaySignature = signature
            payment.transactionId = payment_id
            payment.paidAt = now
            payment.updatedAt = now
            payment.save()

            booking = payment.booking
            booking.paymentStatus = "PAID"
            booking.bookingStatus = "CONFIRMED"
            booking.updatedAt = now
            booking.save()

        return api_success(
            "Payment verified successfully.",
            payment_detail(payment),
        )

    except Exception:
        return api_error(
            "Unable to update payment.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---------------------------------------------------------
# 4. Generate test payment signature
# POST /api/payments/razorpay/test-sign
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_test_payment_signature(request):

    if is_production():
        return api_error(
            "Test payments are disabled in production.",
            status.HTTP_403_FORBIDDEN,
        )

    order_id = request.data.get("razorpayOrderId")

    if not order_id:
        return api_error(
            "Razorpay order ID is required.",
            status.HTTP_400_BAD_REQUEST,
        )

    payment = Payment.objects.filter(
        gatewayOrderId=order_id,
        customer=request.user,
    ).first()

    if not payment:
        return api_error(
            "Payment order not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if payment.status == "SUCCESS":
        return api_error(
            "Payment is already completed.",
            status.HTTP_409_CONFLICT,
        )

    test_payment_id = f"pay_test_{uuid.uuid4().hex}"

    message = f"{order_id}|{test_payment_id}"

    signature = hmac.new(
        get_razorpay_secret().encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    return api_success(
        "Test payment signature generated.",
        {
            "razorpayOrderId": order_id,
            "razorpayPaymentId": test_payment_id,
            "razorpaySignature": signature,
            "signature": signature,
        },
    )


# ---------------------------------------------------------
# 5. Get payment by ID
# GET /api/payments/<payment_id>
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_payment_by_id(request, payment_id):

    payment = find_payment(payment_id)

    if not payment:
        return api_error(
            "Payment not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if not can_access_payment(request.user, payment):
        return api_error(
            "You are not allowed to view this payment.",
            status.HTTP_403_FORBIDDEN,
        )

    return api_success(
        "Payment retrieved successfully.",
        payment_detail(payment),
    )


# ---------------------------------------------------------
# 6. Get booking payment
# GET /api/bookings/<booking_id>/payment
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_booking_payment(request, booking_id):

    booking = find_booking(booking_id)

    if not booking:
        return api_error(
            "Booking not found.",
            status.HTTP_404_NOT_FOUND,
        )

    payment = Payment.objects.filter(
        booking=booking
    ).first()

    if not payment:
        return api_error(
            "Payment not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if not can_access_payment(request.user, payment):
        return api_error(
            "You are not allowed to view this payment.",
            status.HTTP_403_FORBIDDEN,
        )

    return api_success(
        "Booking payment retrieved successfully.",
        payment_detail(payment),
    )


# ---------------------------------------------------------
# 7. Refund payment
# POST /api/payments/<payment_id>/refund
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refund_payment(request, payment_id):

    from apps.core.models import Payout

    if request.user.role != "ADMIN":
        return api_error(
            "Only administrators can refund payments.",
            status.HTTP_403_FORBIDDEN,
        )

    payment = find_payment(payment_id)

    if not payment:
        return api_error(
            "Payment not found.",
            status.HTTP_404_NOT_FOUND,
        )

    if payment.status == "REFUNDED":
        return api_success(
            "Payment is already refunded.",
            payment_detail(payment),
        )

    if payment.status != "SUCCESS":
        return api_error(
            "Only successful payments can be refunded.",
            status.HTTP_400_BAD_REQUEST,
        )

    reason = (
        request.data.get("reason") or "Payment refunded"
    ).strip()

    # Never send simulated test payment IDs to Razorpay.
    is_test_payment = (
        payment.gatewayPaymentId
        and payment.gatewayPaymentId.startswith("pay_test_")
    )

    if (
        payment.gateway == "RAZORPAY"
        and payment.gatewayPaymentId
        and not is_test_payment
    ):
        client = razorpay_client()

        if not client:
            return api_error(
                "Payment gateway is not configured.",
                status.HTTP_502_BAD_GATEWAY,
            )

        try:
            client.payment.refund(
                payment.gatewayPaymentId
            )
        except Exception:
            return api_error(
                "Razorpay refund failed.",
                status.HTTP_502_BAD_GATEWAY,
            )

    try:
        with transaction.atomic():

            now = timezone.now()

            payment.status = "REFUNDED"
            payment.gatewayResponse = {
                "statusChangedTo": "REFUNDED",
                "reason": reason,
                "updatedAt": now.isoformat(),
            }
            payment.updatedAt = now
            payment.save()

            booking = payment.booking
            booking.paymentStatus = "REFUNDED"
            booking.updatedAt = now
            booking.save()

            # Cancel pending and processing payouts only.
            payouts = Payout.objects.select_for_update().filter(
                booking=booking,
                status__in=["PENDING", "PROCESSING"],
            )

            for payout in payouts:
                payout.status = "FAILED"
                payout.rejectionReason = reason

                cancellation_note = (
                    f"Automatically cancelled: {reason}"
                )

                payout.notes = (
                    f"{payout.notes}; {cancellation_note}"
                    if payout.notes
                    else cancellation_note
                )

                payout.updatedAt = now
                payout.save()

        return api_success(
            "Payment refunded successfully.",
            payment_detail(payment),
        )

    except Exception:
        return api_error(
            "Unable to update refund status.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
