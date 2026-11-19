import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getPartnerBookings } from '@/services/api/bookingApi';
import { useAuthStore } from '@/store/authStore';
import type { Booking, BookingPaymentStatus, BookingStatus } from '@/types/booking';
import { formatCurrency } from '@/utils/currency';

type StatusFilter = 'ALL' | BookingStatus;

function getStatusBadgeTone(status: BookingStatus): 'success' | 'error' | 'gold' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    case 'PENDING':
    default:
      return 'gold';
  }
}

function getPaymentBadgeTone(status: BookingPaymentStatus): 'success' | 'error' | 'gold' | 'neutral' {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'REFUNDED':
      return 'neutral';
    case 'PENDING':
    default:
      return 'neutral';
  }
}

export default function PartnerBookingsScreen() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);

  const load = useCallback(
    async (reset = true, filterTab: StatusFilter = activeTab, querySearch = searchTerm) => {
      setError(null);
      if (reset) {
        setLoading(true);
        setBookings([]);
        pageRef.current = 1;
      } else {
        setLoadingMore(true);
      }

      try {
        const nextPage = reset ? 1 : pageRef.current + 1;
        const status = filterTab === 'ALL' ? undefined : filterTab;
        const search = querySearch.trim() || undefined;

        const result = await getPartnerBookings({
          page: nextPage,
          limit: 10,
          status,
          search,
        });

        setBookings((prev) => (reset ? result.items : [...prev, ...result.items]));
        pageRef.current = result.pagination.page;
        setPage(result.pagination.page);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to load reservations.';
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [activeTab, searchTerm],
  );

  useEffect(() => {
    if (isAuthenticated) {
      void load(true, activeTab, searchTerm);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab, load, searchTerm]);

  const onTabChange = (tab: StatusFilter) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    void load(true, tab, searchTerm);
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load(true, activeTab, searchTerm);
  };

  const onSearchSubmit = () => {
    void load(true, activeTab, searchTerm);
  };

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const checkIn = item.checkIn ? String(item.checkIn).slice(0, 10) : '—';
    const checkOut = item.checkOut ? String(item.checkOut).slice(0, 10) : '—';
    const hotelName = item.hotel?.name || 'Hotel';
    const roomType = item.room?.roomType || 'Room';
    const guestName = item.guestDetails?.fullName || item.customer?.fullName || 'Guest';
    const guestPhone = item.guestDetails?.phone || item.customer?.phone || '';
    const totalAmount = Number(item.totalAmount).toLocaleString();

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reservation ${item.bookingId}`}
        onPress={() =>
          router.push({
            pathname: '/(partner)/booking/[bookingId]',
            params: { bookingId: item.bookingId },
          })
        }
        style={({ pressed }) => [styles.bookingCardWrap, pressed && styles.pressed]}>
        <Card padding="medium">
          <View style={styles.cardHeader}>
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>REFERENCE</Text>
              <Text style={styles.refValue}>{item.bookingId}</Text>
            </View>
            <View style={styles.badgesRow}>
              <Badge label={item.bookingStatus} tone={getStatusBadgeTone(item.bookingStatus)} />
              <Badge label={`Pay: ${item.paymentStatus}`} tone={getPaymentBadgeTone(item.paymentStatus)} />
            </View>
          </View>

          <View style={styles.hotelInfo}>
            <Text style={styles.hotelName}>{hotelName}</Text>
            <Text style={styles.roomType}>{roomType}</Text>
          </View>

          <View style={styles.guestBlock}>
            <Text style={styles.guestName}>Guest: {guestName}</Text>
            {guestPhone ? <Text style={styles.guestPhone}>☎ {guestPhone}</Text> : null}
          </View>

          <View style={styles.datesRow}>
            <View style={styles.dateBlock}>
              <Text style={styles.dateMetaLabel}>CHECK-IN</Text>
              <Text style={styles.dateMetaVal}>{checkIn}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateBlock}>
              <Text style={styles.dateMetaLabel}>CHECK-OUT</Text>
              <Text style={styles.dateMetaVal}>{checkOut}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.occupancyText}>
              {item.roomsCount} room{item.roomsCount > 1 ? 's' : ''} · {item.guestsCount} guest{item.guestsCount > 1 ? 's' : ''} ({item.numberOfNights} night{item.numberOfNights > 1 ? 's' : ''})
            </Text>
            <Text style={styles.totalPrice}>
              {formatCurrency(item.totalAmount, item.currency)} <Text style={styles.totalCaption}>total</Text>
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Hotel Reservations
        </Text>
        <Text style={styles.subtitle}>
          {total} {total === 1 ? 'booking' : 'bookings'} under your properties
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          label="Search Reservations"
          placeholder="Search by reference, guest, or hotel..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as StatusFilter[]).map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onTabChange(tab)}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}>
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <ErrorView message={error} onRetry={() => void load(true, activeTab, searchTerm)} /> : null}

      {loading ? (
        <Loader label="Loading hotel reservations…" />
      ) : bookings.length === 0 && !error ? (
        <View style={styles.centerContainer}>
          <EmptyState
            title="No reservations found"
            description={
              searchTerm
                ? `No bookings matched "${searchTerm}".`
                : activeTab === 'ALL'
                  ? 'Your properties do not have any bookings yet.'
                  : `No ${activeTab.toLowerCase()} bookings found for your properties.`
            }
          />
        </View>
      ) : null}

      {!loading && bookings.length > 0 ? (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={() => {
            if (page < totalPages && !loading && !loadingMore) void load(false, activeTab, searchTerm);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            page < totalPages ? (
              <Button
                title={loadingMore ? 'Loading more…' : 'Load more bookings'}
                variant="outline"
                fullWidth
                disabled={loadingMore}
                onPress={() => void load(false, activeTab, searchTerm)}
              />
            ) : null
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.medium, paddingTop: spacing.small, paddingBottom: spacing.xxsmall },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  searchContainer: { paddingHorizontal: spacing.medium, paddingTop: spacing.small },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    gap: spacing.xsmall,
  },
  tabButton: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xxsmall,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.surface,
    fontWeight: '700',
  },
  centerContainer: { flex: 1, justifyContent: 'center', padding: spacing.large },
  list: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  bookingCardWrap: { gap: spacing.xsmall },
  pressed: { opacity: 0.88 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.small },
  refBlock: { gap: 2 },
  refLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  refValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', gap: spacing.xsmall, alignItems: 'center' },
  hotelInfo: { gap: 2, marginBottom: spacing.xsmall },
  hotelName: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  roomType: { color: colors.text, fontSize: 14, fontWeight: '600' },
  guestBlock: { marginBottom: spacing.small },
  guestName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  guestPhone: { color: colors.muted, fontSize: 12, marginTop: 1 },
  datesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.small, borderRadius: radii.small, marginBottom: spacing.small },
  dateBlock: { flex: 1 },
  dateDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.small },
  dateMetaLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  dateMetaVal: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xsmall },
  occupancyText: { color: colors.muted, fontSize: 12 },
  totalPrice: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  totalCaption: { color: colors.muted, fontSize: 12, fontWeight: '400' },
});
