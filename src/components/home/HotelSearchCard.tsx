import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type SearchParams = {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
};

type HotelSearchCardProps = {
  onSearch: (params: SearchParams) => void;
  availableDestinations?: string[];
};

const DEFAULT_POPULAR_DESTINATIONS = [
  'Goa',
  'Dubai',
  'Manali',
  'Paris',
  'Singapore',
  'New York',
  'Miami',
  'Aspen',
  'Udaipur',
  'Jaipur',
  'Maldives',
];

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };
  return date.toLocaleDateString('en-US', options);
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function HotelSearchCard({
  onSearch,
  availableDestinations = [],
}: HotelSearchCardProps) {
  // Destination state
  const [destination, setDestination] = useState('');
  const [destinationModalVisible, setDestinationModalVisible] = useState(false);
  const [destQuery, setDestQuery] = useState('');

  // Date state (defaults: today + 1 day for check-in, today + 3 days for checkout)
  const today = new Date();
  const [checkInDate, setCheckInDate] = useState<Date>(addDays(today, 1));
  const [checkOutDate, setCheckOutDate] = useState<Date>(addDays(today, 3));
  const [dateModalVisible, setDateModalVisible] = useState(false);

  // Guests & Rooms state
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [guestModalVisible, setGuestModalVisible] = useState(false);

  // Calculate nights
  const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Combine popular destination list
  const destinationList = Array.from(
    new Set([...availableDestinations, ...DEFAULT_POPULAR_DESTINATIONS]),
  ).filter((place) =>
    destQuery ? place.toLowerCase().includes(destQuery.toLowerCase().trim()) : true,
  );

  const handleSelectDestination = (place: string) => {
    setDestination(place);
    setDestinationModalVisible(false);
    setDestQuery('');
  };

  const handleSetQuickDates = (nightsToAdd: number, daysFromNow = 1) => {
    const start = addDays(today, daysFromNow);
    const end = addDays(start, nightsToAdd);
    setCheckInDate(start);
    setCheckOutDate(end);
    setDateModalVisible(false);
  };

  const handleExecuteSearch = () => {
    onSearch({
      destination,
      checkIn: formatDateISO(checkInDate),
      checkOut: formatDateISO(checkOutDate),
      rooms,
      adults,
      children,
    });
  };

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.card}>
        {/* DESTINATION FIELD */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Destination: ${destination || 'Where are you going?'}`}
          style={({ pressed }) => [styles.fieldContainer, pressed && styles.fieldPressed]}
          onPress={() => setDestinationModalVisible(true)}>
          <View style={styles.iconCircle}>
            <Ionicons name="location" size={20} color="#E5B83F" />
          </View>
          <View style={styles.fieldTextGroup}>
            <Text style={styles.fieldLabel}>DESTINATION OR HOTEL</Text>
            <Text numberOfLines={1} style={styles.fieldValue}>
              {destination ? destination : 'Where are you going?'}
            </Text>
          </View>
          {destination ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear destination"
              hitSlop={8}
              onPress={() => setDestination('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          )}
        </Pressable>

        <View style={styles.divider} />

        {/* CHECK-IN & CHECK-OUT DATES */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dates: Check in ${formatDate(checkInDate)}, Check out ${formatDate(
            checkOutDate,
          )}, ${nights} nights`}
          style={({ pressed }) => [styles.fieldContainer, pressed && styles.fieldPressed]}
          onPress={() => setDateModalVisible(true)}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={20} color="#E5B83F" />
          </View>
          <View style={styles.fieldTextGroup}>
            <Text style={styles.fieldLabel}>CHECK-IN & CHECK-OUT</Text>
            <Text numberOfLines={1} style={styles.fieldValue}>
              {formatDate(checkInDate)} — {formatDate(checkOutDate)}
            </Text>
            <Text style={styles.fieldSubvalue}>
              {nights} {nights === 1 ? 'night' : 'nights'} stay
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </Pressable>

        <View style={styles.divider} />

        {/* ROOMS & GUESTS */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Guests: ${rooms} room, ${adults + children} guests`}
          style={({ pressed }) => [styles.fieldContainer, pressed && styles.fieldPressed]}
          onPress={() => setGuestModalVisible(true)}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={20} color="#E5B83F" />
          </View>
          <View style={styles.fieldTextGroup}>
            <Text style={styles.fieldLabel}>ROOMS & GUESTS</Text>
            <Text numberOfLines={1} style={styles.fieldValue}>
              {rooms} {rooms === 1 ? 'Room' : 'Rooms'}, {adults + children}{' '}
              {adults + children === 1 ? 'Guest' : 'Guests'}
            </Text>
            <Text style={styles.fieldSubvalue}>
              {adults} {adults === 1 ? 'Adult' : 'Adults'}
              {children > 0 ? `, ${children} ${children === 1 ? 'Child' : 'Children'}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </Pressable>

        {/* SEARCH HOTELS CTA */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search Hotels"
          style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
          onPress={handleExecuteSearch}>
          <Ionicons name="search" size={20} color="#07172F" />
          <Text style={styles.searchButtonText}>Search Hotels</Text>
        </Pressable>
      </View>

      {/* DESTINATION SELECTION MODAL */}
      <Modal
        visible={destinationModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDestinationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close destination modal"
                hitSlop={10}
                onPress={() => setDestinationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#07172F" />
              </Pressable>
            </View>

            {/* Search input in modal */}
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color="#64748B" />
              <TextInput
                value={destQuery}
                onChangeText={setDestQuery}
                placeholder="Search city, region, or landmark..."
                placeholderTextColor="#94A3B8"
                style={styles.modalInput}
                autoFocus
              />
              {destQuery ? (
                <Pressable onPress={() => setDestQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.modalSectionLabel}>Popular Travel Destinations</Text>
            <FlatList
              data={destinationList}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Select destination ${item}`}
                  style={({ pressed }) => [
                    styles.destItem,
                    destination === item && styles.destItemSelected,
                    pressed && styles.destItemPressed,
                  ]}
                  onPress={() => handleSelectDestination(item)}>
                  <View style={styles.destItemIcon}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={destination === item ? '#E5B83F' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.destItemText,
                      destination === item && styles.destItemTextSelected,
                    ]}>
                    {item}
                  </Text>
                  {destination === item && (
                    <Ionicons name="checkmark-circle" size={20} color="#E5B83F" />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* DATES MODAL */}
      <Modal
        visible={dateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Stay Dates</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close date picker modal"
                hitSlop={10}
                onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#07172F" />
              </Pressable>
            </View>

            <View style={styles.dateSummaryCard}>
              <View style={styles.dateBox}>
                <Text style={styles.dateBoxLabel}>CHECK-IN</Text>
                <Text style={styles.dateBoxVal}>{formatDate(checkInDate)}</Text>
              </View>
              <View style={styles.dateArrow}>
                <Ionicons name="arrow-forward" size={18} color="#E5B83F" />
                <Text style={styles.dateNightsCount}>{nights}N</Text>
              </View>
              <View style={styles.dateBox}>
                <Text style={styles.dateBoxLabel}>CHECK-OUT</Text>
                <Text style={styles.dateBoxVal}>{formatDate(checkOutDate)}</Text>
              </View>
            </View>

            <Text style={styles.modalSectionLabel}>Quick Selection</Text>
            <View style={styles.quickDatesGrid}>
              <Pressable
                style={styles.quickDateBtn}
                onPress={() => handleSetQuickDates(1, 0)}>
                <Text style={styles.quickDateTitle}>Tonight</Text>
                <Text style={styles.quickDateSub}>1 night</Text>
              </Pressable>

              <Pressable
                style={styles.quickDateBtn}
                onPress={() => handleSetQuickDates(2, 1)}>
                <Text style={styles.quickDateTitle}>Weekend Escape</Text>
                <Text style={styles.quickDateSub}>2 nights</Text>
              </Pressable>

              <Pressable
                style={styles.quickDateBtn}
                onPress={() => handleSetQuickDates(4, 2)}>
                <Text style={styles.quickDateTitle}>4 Nights Getaway</Text>
                <Text style={styles.quickDateSub}>4 nights</Text>
              </Pressable>

              <Pressable
                style={styles.quickDateBtn}
                onPress={() => handleSetQuickDates(7, 3)}>
                <Text style={styles.quickDateTitle}>Full Week Vacation</Text>
                <Text style={styles.quickDateSub}>7 nights</Text>
              </Pressable>
            </View>

            <View style={styles.stepperSection}>
              <Text style={styles.modalSectionLabel}>Adjust Duration</Text>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Total Nights</Text>
                <View style={styles.stepperControls}>
                  <Pressable
                    accessibilityLabel="Decrease nights"
                    disabled={nights <= 1}
                    style={[styles.stepperBtn, nights <= 1 && styles.stepperBtnDisabled]}
                    onPress={() => {
                      if (nights > 1) {
                        setCheckOutDate(addDays(checkOutDate, -1));
                      }
                    }}>
                    <Ionicons name="remove" size={18} color={nights <= 1 ? '#94A3B8' : '#07172F'} />
                  </Pressable>
                  <Text style={styles.stepperValText}>{nights}</Text>
                  <Pressable
                    accessibilityLabel="Increase nights"
                    disabled={nights >= 30}
                    style={[styles.stepperBtn, nights >= 30 && styles.stepperBtnDisabled]}
                    onPress={() => {
                      if (nights < 30) {
                        setCheckOutDate(addDays(checkOutDate, 1));
                      }
                    }}>
                    <Ionicons name="add" size={18} color="#07172F" />
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.modalConfirmBtn}
              onPress={() => setDateModalVisible(false)}>
              <Text style={styles.modalConfirmText}>Confirm Dates</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* GUESTS & ROOMS MODAL */}
      <Modal
        visible={guestModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGuestModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rooms & Guests</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close guests modal"
                hitSlop={10}
                onPress={() => setGuestModalVisible(false)}>
                <Ionicons name="close" size={24} color="#07172F" />
              </Pressable>
            </View>

            {/* Rooms Stepper */}
            <View style={styles.guestRow}>
              <View>
                <Text style={styles.guestRowTitle}>Rooms</Text>
                <Text style={styles.guestRowSub}>Number of rooms needed</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  disabled={rooms <= 1}
                  style={[styles.stepperBtn, rooms <= 1 && styles.stepperBtnDisabled]}
                  onPress={() => setRooms(Math.max(1, rooms - 1))}>
                  <Ionicons name="remove" size={18} color={rooms <= 1 ? '#94A3B8' : '#07172F'} />
                </Pressable>
                <Text style={styles.stepperValText}>{rooms}</Text>
                <Pressable
                  disabled={rooms >= 8}
                  style={[styles.stepperBtn, rooms >= 8 && styles.stepperBtnDisabled]}
                  onPress={() => setRooms(Math.min(8, rooms + 1))}>
                  <Ionicons name="add" size={18} color="#07172F" />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalDivider} />

            {/* Adults Stepper */}
            <View style={styles.guestRow}>
              <View>
                <Text style={styles.guestRowTitle}>Adults</Text>
                <Text style={styles.guestRowSub}>Ages 13 and above</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  disabled={adults <= 1}
                  style={[styles.stepperBtn, adults <= 1 && styles.stepperBtnDisabled]}
                  onPress={() => setAdults(Math.max(1, adults - 1))}>
                  <Ionicons name="remove" size={18} color={adults <= 1 ? '#94A3B8' : '#07172F'} />
                </Pressable>
                <Text style={styles.stepperValText}>{adults}</Text>
                <Pressable
                  disabled={adults >= 16}
                  style={[styles.stepperBtn, adults >= 16 && styles.stepperBtnDisabled]}
                  onPress={() => setAdults(Math.min(16, adults + 1))}>
                  <Ionicons name="add" size={18} color="#07172F" />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalDivider} />

            {/* Children Stepper */}
            <View style={styles.guestRow}>
              <View>
                <Text style={styles.guestRowTitle}>Children</Text>
                <Text style={styles.guestRowSub}>Ages 0 to 12</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  disabled={children <= 0}
                  style={[styles.stepperBtn, children <= 0 && styles.stepperBtnDisabled]}
                  onPress={() => setChildren(Math.max(0, children - 1))}>
                  <Ionicons name="remove" size={18} color={children <= 0 ? '#94A3B8' : '#07172F'} />
                </Pressable>
                <Text style={styles.stepperValText}>{children}</Text>
                <Pressable
                  disabled={children >= 8}
                  style={[styles.stepperBtn, children >= 8 && styles.stepperBtnDisabled]}
                  onPress={() => setChildren(Math.min(8, children + 1))}>
                  <Ionicons name="add" size={18} color="#07172F" />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.modalConfirmBtn}
              onPress={() => setGuestModalVisible(false)}>
              <Text style={styles.modalConfirmText}>Apply Guests & Rooms</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: 16,
    marginTop: -28,
    zIndex: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#07172F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 12,
    borderRadius: 12,
  },
  fieldPressed: {
    backgroundColor: '#F8FAFC',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 184, 63, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTextGroup: {
    flex: 1,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  fieldValue: {
    color: '#172033',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldSubvalue: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  searchButton: {
    backgroundColor: '#E5B83F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    gap: 8,
    shadowColor: '#E5B83F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  searchButtonPressed: {
    backgroundColor: '#D4A62C',
    transform: [{ scale: 0.99 }],
  },
  searchButtonText: {
    color: '#07172F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 23, 47, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#07172F',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    marginBottom: 16,
  },
  modalInput: {
    flex: 1,
    color: '#07172F',
    fontSize: 14,
    fontWeight: '500',
  },
  modalSectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  destItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 12,
  },
  destItemSelected: {
    backgroundColor: 'rgba(229, 184, 63, 0.1)',
  },
  destItemPressed: {
    backgroundColor: '#F1F5F9',
  },
  destItemIcon: {
    width: 32,
    alignItems: 'center',
  },
  destItemText: {
    flex: 1,
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '600',
  },
  destItemTextSelected: {
    color: '#07172F',
    fontWeight: '800',
  },

  // Date Modal
  dateSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#07172F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  dateBox: {
    flex: 1,
  },
  dateBoxLabel: {
    color: '#E5B83F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateBoxVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  dateArrow: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  dateNightsCount: {
    color: '#E5B83F',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  quickDatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  quickDateBtn: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  quickDateTitle: {
    color: '#07172F',
    fontSize: 13,
    fontWeight: '700',
  },
  quickDateSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  stepperSection: {
    marginBottom: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  stepperLabel: {
    color: '#07172F',
    fontSize: 14,
    fontWeight: '700',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValText: {
    color: '#07172F',
    fontSize: 15,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  modalConfirmBtn: {
    backgroundColor: '#E5B83F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalConfirmText: {
    color: '#07172F',
    fontSize: 15,
    fontWeight: '800',
  },

  // Guest Row
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  guestRowTitle: {
    color: '#07172F',
    fontSize: 15,
    fontWeight: '700',
  },
  guestRowSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
});
