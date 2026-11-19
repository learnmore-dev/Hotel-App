
import secrets
import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import Booking, PartnerProfile, Payout

from apps.core.booking_views import (
    api_error,
    success,
    money,
    is_admin,
    get_approved_partner,
)


# ---------------------------------------------------------
# Common helpers
# ---------------------------------------------------------

ACTIVE_PAYOUT_STATUSES = ("PENDING", "PROCESSING", "PAID")


def decimal_value(value):
    return money(value or 0)


def calculate_commission(gross, rate):
    gross = decimal_value(gross)
    rate = Decimal(str(rate or 0))
    commission = money(gross * rate / Decimal("100"))
    net = money(gross - commission)
    return commission, net


def pagination_values(request):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except (TypeError, ValueError):
        page = 1

    try:
        limit = int(request.query_params.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20

    limit = max(1, min(limit, 100))
    return page, limit


def paginate(items, page, limit):
    total = len(items)
    start = (page - 1) * limit
    end = start + limit

    return {
        "items": items[start:end],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        },
    }


def apply_date_filters(queryset, request, field="createdAt"):
    start_value = request.query_params.get("startDate")
    end_value = request.query_params.get("endDate")

    if start_value:
        start_date = parse_date(start_value)
        if not start_date:
            return None, api_error("Invalid startDate. Use YYYY-MM-DD.")

        queryset = queryset.filter(
            **{f"{field}__date__gte": start_date}
        )

    if end_value:
        end_date = parse_date(end_value)
        if not end_date:
            return None, api_error("Invalid endDate. Use YYYY-MM-DD.")

        queryset = queryset.filter(
            **{f"{field}__date__lte": end_date}
        )

    return queryset, None


def is_eligible_booking(booking):
    try:
        payment = booking.payment
    except Exception:
        return False

    return (
        booking.bookingStatus == "COMPLETED"
        and booking.paymentStatus == "PAID"
        and payment.status == "SUCCESS"
        and payment.paymentMethod != "PAY_AT_HOTEL"
    )


def latest_payout(booking):
    return (
        Payout.objects
        .filter(booking=booking)
        .order_by("-createdAt")
        .first()
    )


def payout_data(payout):
    if not payout:
        return None

    return {
        "id": str(payout.id),
        "batchReference": payout.batchReference,
        "status": payout.status,
        "amount": float(decimal_value(payout.amount)),
        "commissionAmount": float(decimal_value(payout.commissionAmount)),
        "netAmount": float(decimal_value(payout.netAmount)),
        "transactionReference": payout.transactionReference,
        "rejectionReason": payout.rejectionReason,
        "processedAt": (
            payout.processedAt.isoformat()
            if payout.processedAt else None
        ),
        "createdAt": (
            payout.createdAt.isoformat()
            if payout.createdAt else None
        ),
    }


def earnings_item(booking, partner):
    payout = latest_payout(booking)
    eligible = is_eligible_booking(booking)

    if eligible:
        payout_status = "AVAILABLE"
    elif payout and payout.status in ("PENDING", "PROCESSING", "PAID"):
        payout_status = payout.status
    else:
        try:
            if booking.payment.paymentMethod == "PAY_AT_HOTEL":
                payout_status = "PAY_AT_HOTEL"
            else:
                payout_status = "NOT_ELIGIBLE"
        except Exception:
            payout_status = "NOT_ELIGIBLE"

    if payout and payout.status == "PAID":
        commission = decimal_value(payout.commissionAmount)
        net = decimal_value(payout.netAmount)
        rate = (
            commission / decimal_value(booking.totalAmount) * 100
            if decimal_value(booking.totalAmount) else Decimal("0")
        )
    elif payout and payout.status in ("PENDING", "PROCESSING"):
        commission = decimal_value(payout.commissionAmount)
        net = decimal_value(payout.netAmount)
        rate = (
            commission / decimal_value(booking.totalAmount) * 100
            if decimal_value(booking.totalAmount) else Decimal("0")
        )
    else:
        rate = Decimal(str(partner.commissionRate or 0))
        commission, net = calculate_commission(
            booking.totalAmount,
            rate,
        )

    return {
        "id": str(booking.id),
        "bookingId": booking.bookingId,
        "hotel": {
            "id": str(booking.hotel.id),
            "name": booking.hotel.name,
            "city": booking.hotel.city,
        },
        "customer": {
            "fullName": booking.customer.fullName,
        },
        "checkIn": str(booking.checkIn),
        "checkOut": str(booking.checkOut),
        "bookingStatus": booking.bookingStatus,
        "paymentStatus": booking.paymentStatus,
        "paymentMethod": (
            booking.payment.paymentMethod
            if hasattr(booking, "payment")
            else ""
        ),
        "amounts": {
            "grossAmount": float(decimal_value(booking.totalAmount)),
            "commissionRate": float(rate),
            "commissionAmount": float(commission),
            "netAmount": float(net),
        },
        "payoutStatus": payout_status,
        "payout": payout_data(payout),
        "createdAt": (
            booking.createdAt.isoformat()
            if booking.createdAt else None
        ),
    }


def partner_payout_item(payout):
    booking = payout.booking

    return {
        "id": str(payout.id),
        "batchReference": payout.batchReference,
        "bookingId": str(booking.id),
        "bookingRef": booking.bookingId,
        "hotelName": booking.hotel.name,
        "checkIn": str(booking.checkIn),
        "checkOut": str(booking.checkOut),
        "amount": float(decimal_value(payout.amount)),
        "commissionAmount": float(decimal_value(payout.commissionAmount)),
        "netAmount": float(decimal_value(payout.netAmount)),
        "status": payout.status,
        "transactionReference": payout.transactionReference,
        "rejectionReason": payout.rejectionReason,
        "notes": payout.notes,
        "processedAt": (
            payout.processedAt.isoformat()
            if payout.processedAt else None
        ),
        "createdAt": (
            payout.createdAt.isoformat()
            if payout.createdAt else None
        ),
    }


def admin_payout_item(payout):
    partner = payout.partner
    booking = payout.booking

    contact_email = (
        partner.businessEmail
        or (partner.user.email if partner.user else "")
    )

    return {
        "id": str(payout.id),
        "batchReference": payout.batchReference,
        "partner": {
            "id": str(partner.id),
            "businessName": partner.businessName,
            "contactEmail": contact_email,
            "commissionRate": float(partner.commissionRate or 0),
        },
        "booking": {
            "id": str(booking.id),
            "bookingId": booking.bookingId,
            "hotelName": booking.hotel.name,
            "city": booking.hotel.city,
            "checkIn": str(booking.checkIn),
            "checkOut": str(booking.checkOut),
            "customerName": booking.customer.fullName,
        },
        "amount": float(decimal_value(payout.amount)),
        "commissionAmount": float(decimal_value(payout.commissionAmount)),
        "netAmount": float(decimal_value(payout.netAmount)),
        "status": payout.status,
        "transactionReference": payout.transactionReference,
        "rejectionReason": payout.rejectionReason,
        "notes": payout.notes,
        "processedBy": (
            str(payout.processedBy)
            if payout.processedBy else None
        ),
        "processedAt": (
            payout.processedAt.isoformat()
            if payout.processedAt else None
        ),
        "createdAt": (
            payout.createdAt.isoformat()
            if payout.createdAt else None
        ),
    }


# ---------------------------------------------------------
# Partner earnings summary
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def partner_earnings_summary(request):
    partner, error = get_approved_partner(request.user)
    if error:
        return error

    bookings = list(
        Booking.objects
        .filter(hotel__partner=partner)
        .select_related("hotel", "customer", "payment")
        .order_by("-createdAt")
    )

    available = Decimal("0")
    pending = Decimal("0")
    processing = Decimal("0")
    paid = Decimal("0")

    lifetime_gross = Decimal("0")
    lifetime_commission = Decimal("0")
    lifetime_net = Decimal("0")
    eligible_count = 0

    pay_at_hotel_count = 0
    pay_at_hotel_gross = Decimal("0")
    pay_at_hotel_commission = Decimal("0")

    for booking in bookings:
        if booking.bookingStatus != "COMPLETED":
            continue

        try:
            payment = booking.payment
        except Exception:
            payment = None

        if payment and payment.paymentMethod == "PAY_AT_HOTEL":
            pay_at_hotel_count += 1
            gross = decimal_value(booking.totalAmount)
            commission, _ = calculate_commission(
                gross,
                partner.commissionRate,
            )
            pay_at_hotel_gross += gross
            pay_at_hotel_commission += commission
            continue

        if not is_eligible_booking(booking):
            continue

        payout = latest_payout(booking)

        if payout and payout.status == "PAID":
            gross = decimal_value(payout.amount)
            commission = decimal_value(payout.commissionAmount)
            net = decimal_value(payout.netAmount)
            paid += net
        elif payout and payout.status == "PROCESSING":
            gross = decimal_value(payout.amount)
            commission = decimal_value(payout.commissionAmount)
            net = decimal_value(payout.netAmount)
            processing += net
        elif payout and payout.status == "PENDING":
            gross = decimal_value(payout.amount)
            commission = decimal_value(payout.commissionAmount)
            net = decimal_value(payout.netAmount)
            pending += net
        else:
            gross = decimal_value(booking.totalAmount)
            commission, net = calculate_commission(
                gross,
                partner.commissionRate,
            )
            available += net
            eligible_count += 1

        lifetime_gross += gross
        lifetime_commission += commission
        lifetime_net += net

    data = {
        "partner": {
            "id": str(partner.id),
            "businessName": partner.businessName,
            "commissionRate": float(partner.commissionRate or 0),
            "status": partner.status,
        },
        "metrics": {
            "availableBalance": float(money(available)),
            "pendingBalance": float(money(pending)),
            "processingBalance": float(money(processing)),
            "paidBalance": float(money(paid)),
            "lifetimeGross": float(money(lifetime_gross)),
            "lifetimeCommission": float(money(lifetime_commission)),
            "lifetimeNet": float(money(lifetime_net)),
            "eligibleBookingsCount": eligible_count,
        },
        "payAtHotel": {
            "totalBookings": pay_at_hotel_count,
            "totalCollectedByHotel": float(money(pay_at_hotel_gross)),
            "platformCommissionReceivable": float(
                money(pay_at_hotel_commission)
            ),
            "notice": (
                "Pay at Hotel collections are received directly by the "
                "hotel and are excluded from platform payout requests."
            ),
        },
    }

    return success("Earnings summary retrieved.", data)


# ---------------------------------------------------------
# Partner earnings history
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def partner_earnings_history(request):
    partner, error = get_approved_partner(request.user)
    if error:
        return error

    queryset = (
        Booking.objects
        .filter(
            hotel__partner=partner,
            bookingStatus="COMPLETED",
        )
        .select_related("hotel", "customer", "payment")
        .order_by("-createdAt")
    )

    queryset, error = apply_date_filters(queryset, request)
    if error:
        return error

    bookings = list(queryset)
    items = [
        earnings_item(booking, partner)
        for booking in bookings
    ]

    requested_status = request.query_params.get("status")
    if requested_status:
        requested_status = requested_status.upper()
        items = [
            item for item in items
            if item["payoutStatus"] == requested_status
        ]

    hotel_id = request.query_params.get("hotelId")
    if hotel_id:
        items = [
            item for item in items
            if item["hotel"]["id"] == hotel_id
        ]

    page, limit = pagination_values(request)
    return success(
        "Earnings history retrieved.",
        paginate(items, page, limit),
    )


# ---------------------------------------------------------
# Partner payout request
# ---------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_partner_payout(request):
    partner, error = get_approved_partner(request.user)
    if error:
        return error

    notes = request.data.get("notes")
    requested_ids = request.data.get("bookingIds")

    if requested_ids is not None and not isinstance(requested_ids, list):
        return api_error("bookingIds must be a list.")

    with transaction.atomic():
        bookings_query = (
            Booking.objects
            .select_for_update()
            .filter(
                hotel__partner=partner,
                bookingStatus="COMPLETED",
                paymentStatus="PAID",
                payment__status="SUCCESS",
            )
            .exclude(payment__paymentMethod="PAY_AT_HOTEL")
            .select_related("hotel", "customer", "payment")
            .order_by("createdAt")
        )

        if requested_ids:
            bookings_query = bookings_query.filter(id__in=requested_ids)

        bookings = list(bookings_query)

        eligible = []
        for booking in bookings:
            existing = Payout.objects.filter(
                booking=booking,
                status__in=ACTIVE_PAYOUT_STATUSES,
            ).exists()

            if not existing:
                eligible.append(booking)

        if requested_ids and len(eligible) != len(set(requested_ids)):
            return api_error(
                "One or more selected bookings are not eligible "
                "or already have an active payout."
            )

        if not eligible:
            return api_error(
                "There are no eligible bookings available for payout."
            )

        batch_reference = (
            f"TRM-PAY-{timezone.localdate().strftime('%Y%m%d')}-"
            f"{secrets.token_hex(3).upper()}"
        )

        payout_items = []
        total_gross = Decimal("0")
        total_commission = Decimal("0")
        total_net = Decimal("0")

        for booking in eligible:
            gross = decimal_value(booking.totalAmount)
            commission, net = calculate_commission(
                gross,
                partner.commissionRate,
            )

            payout = Payout.objects.create(
                id=uuid.uuid4(),
                partner=partner,
                booking=booking,
                batchReference=batch_reference,
                amount=gross,
                commissionAmount=commission,
                netAmount=net,
                status="PENDING",
                notes=notes,
                createdAt=timezone.now(),
                updatedAt=timezone.now(),
            )

            payout_items.append({
                "id": str(payout.id),
                "bookingId": str(booking.id),
                "amount": float(gross),
                "commissionAmount": float(commission),
                "netAmount": float(net),
                "status": payout.status,
            })

            total_gross += gross
            total_commission += commission
            total_net += net

    data = {
        "batchReference": batch_reference,
        "totalGross": float(money(total_gross)),
        "totalCommission": float(money(total_commission)),
        "totalNet": float(money(total_net)),
        "payoutsCount": len(payout_items),
        "payouts": payout_items,
    }

    return success("Payout request submitted.", data, status.HTTP_201_CREATED)


# ---------------------------------------------------------
# Partner payout history
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_partner_payouts(request):
    partner, error = get_approved_partner(request.user)
    if error:
        return error

    queryset = (
        Payout.objects
        .filter(partner=partner)
        .select_related(
            "booking",
            "booking__hotel",
            "booking__customer",
        )
        .order_by("-createdAt")
    )

    payout_status = request.query_params.get("status")
    if payout_status:
        queryset = queryset.filter(status=payout_status.upper())

    queryset, error = apply_date_filters(queryset, request)
    if error:
        return error

    items = [partner_payout_item(p) for p in queryset]

    page, limit = pagination_values(request)
    return success(
        "Partner payouts retrieved.",
        paginate(items, page, limit),
    )


# ---------------------------------------------------------
# Admin payout list
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_admin_payouts(request):
    if not is_admin(request.user):
        return api_error("Admin access required.", 403)

    queryset = (
        Payout.objects
        .select_related(
            "partner",
            "partner__user",
            "booking",
            "booking__hotel",
            "booking__customer",
        )
        .order_by("-createdAt")
    )

    payout_status = request.query_params.get("status")
    if payout_status:
        queryset = queryset.filter(status=payout_status.upper())

    partner_id = request.query_params.get("partnerId")
    if partner_id:
        queryset = queryset.filter(partner_id=partner_id)

    hotel_id = request.query_params.get("hotelId")
    if hotel_id:
        queryset = queryset.filter(booking__hotel_id=hotel_id)

    batch_reference = request.query_params.get("batchReference")
    if batch_reference:
        queryset = queryset.filter(
            batchReference__icontains=batch_reference
        )

    queryset, error = apply_date_filters(queryset, request)
    if error:
        return error

    items = [admin_payout_item(p) for p in queryset]

    page, limit = pagination_values(request)
    return success(
        "Admin payouts retrieved.",
        paginate(items, page, limit),
    )


# ---------------------------------------------------------
# Admin payout detail
# ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_admin_payout_by_id(request, payout_id):
    if not is_admin(request.user):
        return api_error("Admin access required.", 403)

    try:
        payout = (
            Payout.objects
            .select_related(
                "partner",
                "partner__user",
                "booking",
                "booking__hotel",
                "booking__customer",
            )
            .get(id=payout_id)
        )
    except (Payout.DoesNotExist, ValueError):
        return api_error("Payout not found.", 404)

    return success("Payout details retrieved.", admin_payout_item(payout))


# ---------------------------------------------------------
# Admin payout status update
# ---------------------------------------------------------

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_admin_payout_status(request, payout_id):
    if not is_admin(request.user):
        return api_error("Admin access required.", 403)

    action = str(request.data.get("action", "")).upper()

    if action not in ("APPROVE", "REJECT", "MARK_PAID"):
        return api_error(
            "Invalid action. Use APPROVE, REJECT, or MARK_PAID."
        )

    with transaction.atomic():
        try:
            payout = (
                Payout.objects
                .select_for_update()
                .get(id=payout_id)
            )
        except (Payout.DoesNotExist, ValueError):
            return api_error("Payout not found.", 404)

        if payout.status in ("PAID", "REJECTED", "FAILED"):
            return api_error(
                f"A payout with status {payout.status} cannot be updated."
            )

        if action == "APPROVE":
            if payout.status != "PENDING":
                return api_error(
                    "Only pending payouts can be approved."
                )

            payout.status = "PROCESSING"

        elif action == "REJECT":
            if payout.status not in ("PENDING", "PROCESSING"):
                return api_error(
                    "Only pending or processing payouts can be rejected."
                )

            reason = str(
                request.data.get("rejectionReason", "")
            ).strip()

            if not reason:
                return api_error(
                    "A rejectionReason is required."
                )

            payout.status = "REJECTED"
            payout.rejectionReason = reason

        elif action == "MARK_PAID":
            if payout.status != "PROCESSING":
                return api_error(
                    "Only approved (processing) payouts can be marked paid."
                )

            reference = str(
                request.data.get("transactionReference", "")
            ).strip()

            if not reference:
                return api_error(
                    "A transactionReference is required."
                )

            duplicate = Payout.objects.filter(
                transactionReference=reference
            ).exclude(id=payout.id).exists()

            if duplicate:
                return api_error(
                    "This transaction reference is already in use."
                )

            payout.status = "PAID"
            payout.transactionReference = reference

        if "notes" in request.data:
            payout.notes = request.data.get("notes")

        payout.processedAt = timezone.now()
        payout.processedBy = request.user.id
        payout.updatedAt = timezone.now()

        payout.save()

    return success(
        "Payout status updated.",
        admin_payout_item(
            Payout.objects.select_related(
                "partner",
                "partner__user",
                "booking",
                "booking__hotel",
                "booking__customer",
            ).get(id=payout.id)
        ),
    )


# ---------------------------------------------------------
# Admin partner commission update
# ---------------------------------------------------------

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_partner_commission(request, partner_id):
    if not is_admin(request.user):
        return api_error("Admin access required.", 403)

    raw_rate = request.data.get("commissionRate")

    try:
        rate = Decimal(str(raw_rate))
    except Exception:
        return api_error("A valid commissionRate is required.")

    if not rate.is_finite() or rate < 0 or rate > 100:
        return api_error(
            "Commission rate must be between 0 and 100."
        )

    try:
        partner = PartnerProfile.objects.get(id=partner_id)
    except (PartnerProfile.DoesNotExist, ValueError):
        return api_error("Partner not found.", 404)

    partner.commissionRate = rate.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    partner.updatedAt = timezone.now()
    partner.save(update_fields=["commissionRate", "updatedAt"])

    return success(
        "Partner commission updated.",
        {
            "id": str(partner.id),
            "businessName": partner.businessName,
            "commissionRate": float(partner.commissionRate),
        },
    )
