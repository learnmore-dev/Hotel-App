import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getMyBookings } from '@/services/api/bookingApi';
import { useAuthStore } from '@/store/authStore';
import type { Booking, BookingPaymentStatus, BookingStatus } from '@/types/booking';
import { formatCurrency } from '@/utils/currency';

type TabType = 'UPCOMING' | 'PAST' | 'CANCELLED' | 'ALL';

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

export default function BookingsScreen() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<TabType>('UPCOMING');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);

  const getTimeFilter = (tab: TabType): 'upcoming' | 'past' | 'cancelled' | undefined => {
    switch (tab) {
      case 'UPCOMING':
        return 'upcoming';
      case 'PAST':
        return 'past';
      case 'CANCELLED':
        return 'cancelled';
      case 'ALL':
      default:
        return undefined;
    }
  };

  const load = useCallback(
    async (reset = true, tab: TabType = activeTab) => {
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
        const timeFilter = getTimeFilter(tab);
        const result = await getMyBookings({
          page: nextPage,
          limit: 10,
          timeFilter,
        });

        setBookings((prev) => (reset ? result.items : [...prev, ...result.items]));
        pageRef.current = result.pagination.page;
        setPage(result.pagination.page);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to load your bookings.';
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [activeTab],
  );

  useEffect(() => {
    if (isAuthenticated) {
      void load(true, activeTab);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab, load]);

  const onTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    void load(true, tab);
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load(true, activeTab);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <EmptyState
            title="Log in to view your bookings"
            description="Access your upcoming and past hotel reservations by signing into your account."
            actionLabel="Log in"
            onAction={() => router.push('/(auth)/login')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const checkIn = item.checkIn ? String(item.checkIn).slice(0, 10) : '—';
    const checkOut = item.checkOut ? String(item.checkOut).slice(0, 10) : '—';
    const hotelName = item.hotel?.name || 'Hotel';
    const city = item.hotel?.city || '';
    const roomType = item.room?.roomType || 'Room';
    const totalAmount = Number(item.totalAmount).toLocaleString();

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Booking ${item.bookingId} at ${hotelName}`}
        onPress={() =>
          router.push({
            pathname: '/(customer)/booking/[bookingId]',
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
            {city ? <Text style={styles.hotelLocation}>{city}</Text> : null}
            <Text style={styles.roomType}>{roomType}</Text>
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
            <Text style={styles.guestCount}>
              {item.roomsCount} room{item.roomsCount > 1 ? 's' : ''} · {item.guestsCount} guest{item.guestsCount > 1 ? 's' : ''}
            </Text>
            {item.bookingStatus === 'COMPLETED' ? (
              <Text style={styles.reviewPrompt}>★ Review stay</Text>
            ) : null}
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
          My Bookings
        </Text>
        <Text style={styles.subtitle}>
          {total} {total === 1 ? 'reservation' : 'reservations'}
        </Text>
      </View>

      {/* Tabs Header */}
      <View style={styles.tabsRow}>
        {(['UPCOMING', 'PAST', 'CANCELLED', 'ALL'] as TabType[]).map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onTabChange(tab)}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}>
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {tab === 'UPCOMING'
                  ? 'Upcoming'
                  : tab === 'PAST'
                    ? 'Past'
                    : tab === 'CANCELLED'
                      ? 'Cancelled'
                      : 'All'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <ErrorView message={error} onRetry={() => void load(true, activeTab)} /> : null}

      {loading ? (
        <Loader label="Loading your reservations…" />
      ) : bookings.length === 0 && !error ? (
        <View style={styles.centerContainer}>
          <EmptyState
            title={`No ${activeTab.toLowerCase()} reservations`}
            description={
              activeTab === 'UPCOMING'
                ? 'You do not have any upcoming reservations. Plan your next stay now!'
                : `You do not have any ${activeTab.toLowerCase()} reservations recorded.`
            }
            actionLabel="Search hotels"
            onAction={() => router.push('/(customer)/search')}
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
            if (page < totalPages && !loading && !loadingMore) void load(false, activeTab);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            page < totalPages ? (
              <Button
                title={loadingMore ? 'Loading more…' : 'Load more bookings'}
                variant="outline"
                fullWidth
                disabled={loadingMore}
                onPress={() => void load(false, activeTab)}
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
  header: { paddingHorizontal: spacing.medium, paddingTop: spacing.small, paddingBottom: spacing.xsmall },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    gap: spacing.small,
  },
  tabButton: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.xsmall,
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
    fontSize: 13,
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
  hotelInfo: { gap: 2, marginBottom: spacing.medium },
  hotelName: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  hotelLocation: { color: colors.muted, fontSize: 13 },
  roomType: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  datesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.small, borderRadius: radii.small, marginBottom: spacing.small },
  dateBlock: { flex: 1 },
  dateDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.small },
  dateMetaLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  dateMetaVal: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xsmall },
  guestCount: { color: colors.muted, fontSize: 13 },
  reviewPrompt: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  totalPrice: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  totalCaption: { color: colors.muted, fontSize: 12, fontWeight: '400' },
});
