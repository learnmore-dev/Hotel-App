import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { HotelAmenities } from '@/components/hotel/HotelAmenities';
import { HotelImageGallery } from '@/components/hotel/HotelImageGallery';
import { HotelRating } from '@/components/hotel/HotelRating';
import { RoomCard } from '@/components/hotel/RoomCard';
import { HotelReviewsSection } from '@/components/review/HotelReviewsSection';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getHotelById } from '@/services/api/hotelApi';
import { getRoomAvailability } from '@/services/api/bookingApi';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { hotelErrorMessage } from '@/utils/hotelErrors';
import type { AvailableRoom } from '@/types/booking';
import type { Hotel, HotelRoom } from '@/types/hotel';

export default function CustomerHotelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[] | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUser = useAuthStore((state) => state.user);
  const {
    checkIn,
    checkOut,
    roomsCount,
    guestsCount,
    setDates,
    setCounts,
    setSelectedRoom,
    initGuestDetailsFromUser,
  } = useBookingStore();

  const [checkInDraft, setCheckInDraft] = useState(checkIn);
  const [checkOutDraft, setCheckOutDraft] = useState(checkOut);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    getHotelById(id)
      .then((value) => {
        if (active) setHotel(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(hotelErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const checkAvailability = async (cIn = checkInDraft, cOut = checkOutDraft, rCount = roomsCount, gCount = guestsCount) => {
    if (!id) return;
    setCheckingAvailability(true);
    setAvailabilityMessage(null);
    try {
      const result = await getRoomAvailability(id, {
        checkIn: cIn,
        checkOut: cOut,
        rooms: rCount,
        guests: gCount,
      });
      setAvailableRooms(result.rooms);
      setDates(cIn, cOut);
      setCounts(rCount, gCount);
      if (result.rooms.length === 0) {
        setAvailabilityMessage('No rooms match your selected dates and guest count.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to check availability for these dates.';
      setAvailabilityMessage(msg);
      setAvailableRooms(null);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSelectRoom = (room: HotelRoom | AvailableRoom) => {
    if (!hotel) return;
    setDates(checkInDraft, checkOutDraft);
    setCounts(roomsCount, guestsCount);
    setSelectedRoom(hotel, room as HotelRoom);
    initGuestDetailsFromUser(currentUser);
    router.push('/(customer)/booking/checkout');
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Hotel Details' }} />
        <Loader label="Loading hotel details" fullScreen />
      </>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Hotel Details' }} />
        <ErrorView
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            if (id) void getHotelById(id).then(setHotel).catch(() => setError('Unable to load hotel.')).finally(() => setLoading(false));
          }}
        />
      </SafeAreaView>
    );
  }
  if (!hotel) return null;

  const images = [hotel.mainImage, ...hotel.galleryImages]
    .filter((value): value is string => Boolean(value))
    .map((uri, index) => ({ uri, alt: `${hotel.name} photo ${index + 1}` }));

  // Display rooms from live availability check if run, otherwise fallback to hotel.rooms
  const roomsToDisplay = availableRooms ?? hotel.rooms ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: hotel.name || 'Hotel Details' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <HotelImageGallery images={images} height={250} accessibilityLabel={`${hotel.name} photos`} />

        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              {hotel.name}
            </Text>
            <Text style={styles.location}>
              {hotel.address}, {hotel.city}
            </Text>
          </View>
          {hotel.ratingScore ? (
            <HotelRating rating={Number(hotel.ratingScore)} reviewCount={hotel.reviewCount} />
          ) : null}
        </View>

        {hotel.starRating ? <Text style={styles.partner}>{hotel.starRating}-star hotel</Text> : null}
        <Text style={styles.partner}>Hosted by {hotel.partner.businessName}</Text>

        <Text style={styles.price}>
          ${Number(hotel.pricePerNight).toLocaleString()} <Text style={styles.perNight}>per night</Text>
        </Text>

        {hotel.description ? <Text style={styles.description}>{hotel.description}</Text> : null}

        {hotel.amenities.length ? (
          <>
            <Text style={styles.section}>Amenities</Text>
            <HotelAmenities amenities={hotel.amenities.map((label) => ({ id: label, label }))} />
          </>
        ) : null}

        {/* Stay Dates & Capacity Selector */}
        <Text style={styles.section}>Select dates & guests</Text>
        <Card padding="medium">
          <View style={styles.stayDetails}>
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <Input
                  label="Check-in"
                  value={checkInDraft}
                  onChangeText={setCheckInDraft}
                  placeholder="YYYY-MM-DD"
                  returnKeyType="done"
                />
              </View>
              <View style={styles.dateCol}>
                <Input
                  label="Check-out"
                  value={checkOutDraft}
                  onChangeText={setCheckOutDraft}
                  placeholder="YYYY-MM-DD"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.counterRow}>
              <View style={styles.counterItem}>
                <Text style={styles.counterLabel}>Rooms</Text>
                <View style={styles.counterControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease rooms"
                    style={[styles.counterBtn, roomsCount <= 1 && styles.counterBtnDisabled]}
                    disabled={roomsCount <= 1}
                    onPress={() => setCounts(Math.max(1, roomsCount - 1), guestsCount)}>
                    <Text style={styles.counterBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.counterValue}>{roomsCount}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase rooms"
                    style={styles.counterBtn}
                    onPress={() => setCounts(roomsCount + 1, guestsCount)}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.counterItem}>
                <Text style={styles.counterLabel}>Guests</Text>
                <View style={styles.counterControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease guests"
                    style={[styles.counterBtn, guestsCount <= 1 && styles.counterBtnDisabled]}
                    disabled={guestsCount <= 1}
                    onPress={() => setCounts(roomsCount, Math.max(1, guestsCount - 1))}>
                    <Text style={styles.counterBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.counterValue}>{guestsCount}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase guests"
                    style={styles.counterBtn}
                    onPress={() => setCounts(roomsCount, guestsCount + 1)}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Button
              title="Update availability"
              variant="outline"
              size="medium"
              loading={checkingAvailability}
              onPress={() => void checkAvailability()}
            />

            {availabilityMessage ? (
              <Text style={styles.alertText}>{availabilityMessage}</Text>
            ) : null}
          </View>
        </Card>

        {/* Available Rooms Listing */}
        <Text style={styles.section}>Available rooms</Text>
        {roomsToDisplay.length > 0 ? (
          roomsToDisplay.map((room) => {
            const availCount = (room as AvailableRoom).availableRooms ?? (room as HotelRoom).availableRooms ?? 0;
            return (
              <RoomCard
                key={room.id}
                name={room.roomType}
                description={room.description ?? undefined}
                capacity={`Up to ${room.maxGuests} guests${room.bedType ? ` · ${room.bedType}` : ''} · ${availCount} available`}
                amenities={[...room.amenities, ...((room as HotelRoom).inclusions ?? [])]}
                images={room.images}
                price={Number(room.pricePerNight)}
                actionLabel="Select room"
                onSelect={() => handleSelectRoom(room)}
              />
            );
          })
        ) : (
          <Text style={styles.muted}>No rooms available for the selected criteria.</Text>
        )}

        <Text style={styles.muted}>
          Check-in {hotel.checkInTime ?? '—'} · Check-out {hotel.checkOutTime ?? '—'}
        </Text>

        <HotelReviewsSection hotelId={id} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.small },
  titleCopy: { flex: 1, gap: spacing.xsmall },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  location: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  partner: { color: colors.muted, fontSize: 13 },
  price: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  perNight: { color: colors.muted, fontSize: 13, fontWeight: '400' },
  description: { color: colors.text, fontSize: 15, lineHeight: 23 },
  section: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.small },
  stayDetails: { gap: spacing.medium },
  dateRow: { flexDirection: 'row', gap: spacing.small },
  dateCol: { flex: 1 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.medium },
  counterItem: { alignItems: 'center', gap: spacing.xsmall },
  counterLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: { opacity: 0.4 },
  counterBtnText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  counterValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  alertText: { color: colors.accent, fontSize: 13, textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 14 },
});
