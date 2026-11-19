import uuid

from django.db import models
from django.contrib.postgres.fields import ArrayField


class ExistingTableModel(models.Model):
    class Meta:
        abstract = True
        managed = False


class User(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    fullName = models.CharField(max_length=160)
    email = models.CharField(max_length=320, unique=True)
    phone = models.CharField(max_length=32, null=True, blank=True, unique=True)
    passwordHash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, default="CUSTOMER")
    avatar = models.TextField(null=True, blank=True)
    isActive = models.BooleanField(default=True)
    isEmailVerified = models.BooleanField(default=False)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    class Meta:
        managed = False
        db_table = "User"


class PartnerProfile(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="userId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="partner_profiles",
    )
    businessName = models.CharField(max_length=200)
    businessEmail = models.CharField(max_length=320, null=True, blank=True)
    businessPhone = models.CharField(max_length=32, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    documents = models.JSONField(default=list)
    status = models.CharField(max_length=20, default="PENDING")
    commissionRate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "PartnerProfile"


class Hotel(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=120)
    destination = models.CharField(max_length=120, null=True, blank=True)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    starRating = models.IntegerField(null=True, blank=True)
    ratingScore = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    reviewCount = models.IntegerField(default=0)
    pricePerNight = models.DecimalField(max_digits=12, decimal_places=2)
    originalPrice = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    mainImage = models.TextField(null=True, blank=True)
    galleryImages = ArrayField(models.TextField(), default=list)
    amenities = ArrayField(models.TextField(), default=list)
    checkInTime = models.CharField(max_length=20, null=True, blank=True)
    checkOutTime = models.CharField(max_length=20, null=True, blank=True)
    isFeatured = models.BooleanField(default=False)
    isActive = models.BooleanField(default=True)
    partner = models.ForeignKey(
        PartnerProfile,
        db_column="partnerId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="hotels",
    )
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Hotel"


class Room(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    hotel = models.ForeignKey(
        Hotel,
        db_column="hotelId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="rooms",
    )
    roomType = models.CharField(max_length=120)
    description = models.TextField(null=True, blank=True)
    pricePerNight = models.DecimalField(max_digits=12, decimal_places=2)
    maxGuests = models.IntegerField()
    bedType = models.CharField(max_length=100, null=True, blank=True)
    amenities = ArrayField(models.TextField(), default=list)
    inclusions = ArrayField(models.TextField(), default=list)
    images = ArrayField(models.TextField(), default=list)
    totalRooms = models.IntegerField(default=0)
    availableRooms = models.IntegerField(default=0)
    blockedRooms = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default="AVAILABLE")
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Room"


class Coupon(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(null=True, blank=True)
    discountType = models.CharField(max_length=20)
    discountValue = models.DecimalField(max_digits=12, decimal_places=2)
    minimumBookingAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    maximumDiscount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    validFrom = models.DateTimeField()
    validUntil = models.DateTimeField()
    usageLimit = models.IntegerField(null=True, blank=True)
    usedCount = models.IntegerField(default=0)
    perUserLimit = models.IntegerField(null=True, blank=True)
    isActive = models.BooleanField(default=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Coupon"


class Booking(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    bookingId = models.CharField(max_length=40, unique=True)
    idempotencyKey = models.CharField(max_length=128, null=True, blank=True, unique=True)
    customer = models.ForeignKey(
        User,
        db_column="customerId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="customer_bookings",
    )
    hotel = models.ForeignKey(
        Hotel,
        db_column="hotelId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="bookings",
    )
    room = models.ForeignKey(
        Room,
        db_column="roomId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="bookings",
    )
    checkIn = models.DateField()
    checkOut = models.DateField()
    roomsCount = models.IntegerField()
    guestsCount = models.IntegerField()
    guestDetails = models.JSONField()
    specialRequests = models.TextField(null=True, blank=True)
    numberOfNights = models.IntegerField()
    roomPrice = models.DecimalField(max_digits=12, decimal_places=2)
    taxAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discountAmount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    totalAmount = models.DecimalField(max_digits=12, decimal_places=2)
    coupon = models.ForeignKey(
        Coupon,
        db_column="couponId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="bookings",
    )
    paymentStatus = models.CharField(max_length=20, default="PENDING")
    bookingStatus = models.CharField(max_length=20, default="PENDING")
    cancellationReason = models.TextField(null=True, blank=True)
    cancelledAt = models.DateTimeField(null=True, blank=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Booking"


class Payment(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    booking = models.OneToOneField(
        Booking,
        db_column="bookingId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="payment",
    )
    customer = models.ForeignKey(
        User,
        db_column="customerId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    paymentMethod = models.CharField(max_length=30)
    transactionId = models.CharField(max_length=160, null=True, blank=True, unique=True)
    gatewayOrderId = models.CharField(max_length=120, null=True, blank=True, unique=True)
    gatewayPaymentId = models.CharField(max_length=120, null=True, blank=True, unique=True)
    gatewaySignature = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, default="PENDING")
    gateway = models.CharField(max_length=100, null=True, blank=True)
    gatewayResponse = models.JSONField(null=True, blank=True)
    paidAt = models.DateTimeField(null=True, blank=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Payment"


class WebhookEvent(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    eventId = models.CharField(max_length=120, unique=True)
    eventType = models.CharField(max_length=80)
    provider = models.CharField(max_length=40, default="RAZORPAY")
    payload = models.JSONField()
    processedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "WebhookEvent"


class Review(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    customer = models.ForeignKey(
        User,
        db_column="customerId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="reviews",
    )
    hotel = models.ForeignKey(
        Hotel,
        db_column="hotelId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="reviews",
    )
    booking = models.OneToOneField(
        Booking,
        db_column="bookingId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="review",
    )
    rating = models.IntegerField()
    comment = models.TextField()
    isPublished = models.BooleanField(default=False)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Review"


class Payout(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    partner = models.ForeignKey(
        PartnerProfile,
        db_column="partnerId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="payouts",
    )
    booking = models.ForeignKey(
        Booking,
        db_column="bookingId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="payouts",
    )
    batchReference = models.CharField(max_length=160, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    commissionAmount = models.DecimalField(max_digits=12, decimal_places=2)
    netAmount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, default="PENDING")
    transactionReference = models.CharField(max_length=160, null=True, blank=True, unique=True)
    processedAt = models.DateTimeField(null=True, blank=True)
    rejectionReason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    processedBy = models.UUIDField(null=True, blank=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Payout"


class Notification(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="userId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="notifications",
    )
    title = models.CharField(max_length=160)
    message = models.TextField()
    type = models.CharField(max_length=20)
    isRead = models.BooleanField(default=False)
    readAt = models.DateTimeField(null=True, blank=True)
    dedupKey = models.CharField(max_length=160, null=True, blank=True, unique=True)
    actionUrl = models.CharField(max_length=255, null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    createdAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "Notification"


class NotificationPreference(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    user = models.OneToOneField(
        User,
        db_column="userId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="notificationPreference",
    )
    bookingUpdates = models.BooleanField(default=True)
    paymentAlerts = models.BooleanField(default=True)
    payoutAlerts = models.BooleanField(default=True)
    reminders = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)
    pushEnabled = models.BooleanField(default=True)
    emailEnabled = models.BooleanField(default=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "NotificationPreference"


class PushDevice(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="userId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="pushDevices",
    )
    pushToken = models.CharField(max_length=255, unique=True)
    deviceType = models.CharField(max_length=40, null=True, blank=True)
    isActive = models.BooleanField(default=True)
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "PushDevice"


class RefreshToken(ExistingTableModel):
    id = models.UUIDField(primary_key=True)
    user = models.ForeignKey(
        User,
        db_column="userId",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        related_name="refreshTokens",
    )
    tokenHash = models.CharField(max_length=64, unique=True)
    family = models.UUIDField(default=uuid.uuid4)
    isRevoked = models.BooleanField(default=False)
    revokedAt = models.DateTimeField(null=True, blank=True)
    replacedByToken = models.CharField(max_length=64, null=True, blank=True)
    expiresAt = models.DateTimeField()
    createdAt = models.DateTimeField()
    updatedAt = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "RefreshToken"