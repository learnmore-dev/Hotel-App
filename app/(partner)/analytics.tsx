import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import * as payoutApi from '@/services/api/payoutApi';
import type {
  PartnerEarningsItem,
  PartnerEarningsSummary,
  PayoutRecord,
  PayoutStatus,
} from '@/types/payout';
import { formatCurrency } from '@/utils/currency';

type ActiveTab = 'EARNINGS' | 'PAYOUTS';
type EarningsFilter = 'ALL' | 'AVAILABLE' | 'PENDING' | 'PAID' | 'PAY_AT_HOTEL';
type PayoutsFilter = 'ALL' | PayoutStatus;

function getEarningsStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'PAID':
      return 'primary';
    case 'PENDING':
    case 'PROCESSING':
      return 'gold';
    case 'PAY_AT_HOTEL':
      return 'neutral';
    case 'FAILED':
    case 'REJECTED':
      return 'error';
    default:
      return 'neutral';
  }
}

function getPayoutStatusTone(status: PayoutStatus): BadgeTone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PROCESSING':
      return 'primary';
    case 'PENDING':
      return 'gold';
    case 'FAILED':
    case 'REJECTED':
      return 'error';
    default:
      return 'neutral';
  }
}

export default function PartnerAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<PartnerEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<PartnerEarningsItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('EARNINGS');
  const [earningsFilter, setEarningsFilter] = useState<EarningsFilter>('ALL');
  const [payoutsFilter, setPayoutsFilter] = useState<PayoutsFilter>('ALL');

  // Request Payout Modal state
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [sumRes, earnRes, payRes] = await Promise.all([
        payoutApi.getPartnerEarningsSummary(),
        payoutApi.getPartnerEarningsHistory({ limit: 50 }),
        payoutApi.getPartnerPayouts({ limit: 50 }),
      ]);
      setSummary(sumRes);
      setEarnings(earnRes.items);
      setPayouts(payRes.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load earnings data';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleRequestPayout = async () => {
    if (!summary || summary.metrics.availableBalance <= 0) {
      Alert.alert('Notice', 'No available balance for payout.');
      return;
    }

    try {
      setRequestSubmitting(true);
      const result = await payoutApi.requestPartnerPayout({
        notes: requestNotes.trim() || undefined,
      });

      setRequestModalVisible(false);
      setRequestNotes('');
      Alert.alert(
        'Payout Requested',
        `Successfully requested ${formatCurrency(result.totalNet)} across ${result.payoutsCount} booking(s). Batch reference: ${result.batchReference}`,
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request payout';
      Alert.alert('Payout Request Failed', msg);
    } finally {
      setRequestSubmitting(false);
    }
  };

  const filteredEarnings = earnings.filter((item) => {
    if (earningsFilter === 'ALL') return true;
    if (earningsFilter === 'PENDING') {
      return item.payoutStatus === 'PENDING' || item.payoutStatus === 'PROCESSING';
    }
    return item.payoutStatus === earningsFilter;
  });

  const filteredPayouts = payouts.filter((item) => {
    if (payoutsFilter === 'ALL') return true;
    return item.status === payoutsFilter;
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Loader label="Loading partner earnings..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !summary) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ErrorView title="Earnings Unavailable" message={error} onRetry={loadData} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        {/* Header with Partner Profile & Commission */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.title}>Earnings & Payouts</Text>
            <Text style={styles.subtitle}>{summary?.partner.businessName || 'Partner Dashboard'}</Text>
          </View>
          <View style={styles.badgeGroup}>
            <Badge
              label={`${(summary?.partner.commissionRate ?? 15).toFixed(1)}% Commission`}
              tone="gold"
              showDot
            />
            <Badge label={summary?.partner.status ?? 'ACTIVE'} tone="success" />
          </View>
        </View>

        {/* Primary Available Balance Highlight Card */}
        <Card style={styles.availableCard}>
          <Text style={styles.availableLabel}>Available for Payout</Text>
          <Text style={styles.availableAmount}>
            {formatCurrency(summary?.metrics.availableBalance ?? 0)}
          </Text>
          <Text style={styles.availableCaption}>
            {summary?.metrics.eligibleBookingsCount ?? 0} completed stay(s) ready for disbursement
          </Text>
          <View style={styles.availableActionRow}>
            <Button
              title="Request Payout"
              variant="primary"
              size="medium"
              disabled={(summary?.metrics.availableBalance ?? 0) <= 0}
              onPress={() => setRequestModalVisible(true)}
            />
          </View>
        </Card>

        {/* Secondary Metrics Grid */}
        {/* Secondary Metrics Grid */}
<View style={styles.metricsGrid}>
  <Card style={styles.metricCard}>
    <Text style={styles.metricLabel}>Pending Approval</Text>
    <Text style={styles.metricValue}>
      {formatCurrency(summary?.metrics.pendingBalance ?? 0)}
    </Text>
    <Badge label="Awaiting Review" tone="gold" />
  </Card>

  <Card style={styles.metricCard}>
    <Text style={styles.metricLabel}>In Processing</Text>
    <Text style={styles.metricValue}>
      {formatCurrency(summary?.metrics.processingBalance ?? 0)}
    </Text>
    <Badge label="Approved" tone="primary" />
  </Card>
</View>

<View style={styles.metricsGrid}>
  <Card style={styles.metricCard}>
    <Text style={styles.metricLabel}>Total Paid Out</Text>
    <Text style={styles.metricValue}>
      {formatCurrency(summary?.metrics.paidBalance ?? 0)}
    </Text>
    <Badge label="Settled" tone="success" />
  </Card>
</View>
        

        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Lifetime Gross</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(summary?.metrics.lifetimeGross ?? 0)}
            </Text>
            <Text style={styles.metricCaption}>Prepaid Stays</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Lifetime Net</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(summary?.metrics.lifetimeNet ?? 0)}
            </Text>
            <Text style={styles.metricCaption}>After Commission</Text>
          </Card>
        </View>

        {/* Pay at Hotel Revenue Isolation Card (Requirement 6) */}
        <Card style={styles.payAtHotelCard}>
          <View style={styles.payAtHotelHeader}>
            <Text style={styles.payAtHotelTitle}>Pay at Hotel (Collected Directly)</Text>
            <Badge label="Hotel Cash" tone="neutral" />
          </View>
          <Divider inset={spacing.small} />
          <View style={styles.payAtHotelRow}>
            <View>
              <Text style={styles.payAtHotelLabel}>Direct Guest Payments</Text>
              <Text style={styles.payAtHotelAmount}>
                {formatCurrency(summary?.payAtHotel.totalCollectedByHotel ?? 0)}
              </Text>
              <Text style={styles.payAtHotelCaption}>
                {summary?.payAtHotel.totalBookings ?? 0} stay(s) collected at hotel
              </Text>
            </View>
            <View style={styles.commissionReceivableBlock}>
              <Text style={styles.payAtHotelLabel}>Platform Fee Due</Text>
              <Text style={styles.commissionReceivableAmount}>
                {formatCurrency(summary?.payAtHotel.platformCommissionReceivable ?? 0)}
              </Text>
              <Text style={styles.payAtHotelCaption}>Receivable</Text>
            </View>
          </View>
          <Text style={styles.payAtHotelNotice}>
            Notice: Funds collected directly in person at checkout are retained by your property and are strictly separate from platform payouts.
          </Text>
        </Card>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            accessibilityRole="tab"
            style={[styles.tabButton, activeTab === 'EARNINGS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('EARNINGS')}>
            <Text style={[styles.tabText, activeTab === 'EARNINGS' && styles.tabTextActive]}>
              Booking Earnings ({filteredEarnings.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            style={[styles.tabButton, activeTab === 'PAYOUTS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('PAYOUTS')}>
            <Text style={[styles.tabText, activeTab === 'PAYOUTS' && styles.tabTextActive]}>
              Payout Requests ({filteredPayouts.length})
            </Text>
          </Pressable>
        </View>

        {/* Filter Chips */}
        {activeTab === 'EARNINGS' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
            {(['ALL', 'AVAILABLE', 'PENDING', 'PAID', 'PAY_AT_HOTEL'] as EarningsFilter[]).map((filter) => (
              <Pressable
                key={filter}
                style={[styles.filterChip, earningsFilter === filter && styles.filterChipActive]}
                onPress={() => setEarningsFilter(filter)}>
                <Text style={[styles.filterChipText, earningsFilter === filter && styles.filterChipTextActive]}>
                  {filter.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
            {(['ALL', 'PENDING', 'PROCESSING', 'PAID', 'REJECTED'] as PayoutsFilter[]).map((filter) => (
              <Pressable
                key={filter}
                style={[styles.filterChip, payoutsFilter === filter && styles.filterChipActive]}
                onPress={() => setPayoutsFilter(filter)}>
                <Text style={[styles.filterChipText, payoutsFilter === filter && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Content Lists */}
        {activeTab === 'EARNINGS' ? (
          filteredEarnings.length === 0 ? (
            <EmptyState
              title="No Booking Earnings"
              description="No bookings match the selected earnings filter."
            />
          ) : (
            filteredEarnings.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemRef}>{item.bookingId}</Text>
                    <Text style={styles.itemHotel}>{item.hotel.name}</Text>
                  </View>
                  <Badge label={item.payoutStatus.replace(/_/g, ' ')} tone={getEarningsStatusTone(item.payoutStatus)} />
                </View>
                <Divider inset={spacing.small} />
                <View style={styles.datesRow}>
                  <Text style={styles.itemDate}>Stay: {item.checkIn.slice(0, 10)} to {item.checkOut.slice(0, 10)}</Text>
                  <Text style={styles.itemGuest}>Guest: {item.customer.fullName}</Text>
                </View>
                <View style={styles.amountsRow}>
                  <View>
                    <Text style={styles.amountLabel}>Gross</Text>
                    <Text style={styles.amountValue}>{formatCurrency(item.amounts.grossAmount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Commission ({item.amounts.commissionRate}%)</Text>
                    <Text style={styles.amountCommission}>-{formatCurrency(item.amounts.commissionAmount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Net Payable</Text>
                    <Text style={styles.amountNet}>{formatCurrency(item.amounts.netAmount)}</Text>
                  </View>
                </View>
                {item.paymentMethod === 'PAY_AT_HOTEL' ? (
                  <Text style={styles.itemNotice}>• Collected directly in cash at hotel</Text>
                ) : null}
              </Card>
            ))
          )
        ) : filteredPayouts.length === 0 ? (
          <EmptyState
            title="No Payout Requests"
            description="You have not requested any payouts in this category yet."
          />
        ) : (
          filteredPayouts.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View>
                  <Text style={styles.itemRef}>{item.batchReference || `Payout #${item.id.slice(0, 8)}`}</Text>
                  <Text style={styles.itemHotel}>{item.hotelName} ({item.bookingRef})</Text>
                </View>
                <Badge label={item.status} tone={getPayoutStatusTone(item.status)} />
              </View>
              <Divider inset={spacing.small} />
              <View style={styles.amountsRow}>
                <View>
                  <Text style={styles.amountLabel}>Gross</Text>
                  <Text style={styles.amountValue}>{formatCurrency(item.amount)}</Text>
                </View>
                <View>
                  <Text style={styles.amountLabel}>Platform Fee</Text>
                  <Text style={styles.amountCommission}>-{formatCurrency(item.commissionAmount)}</Text>
                </View>
                <View>
                  <Text style={styles.amountLabel}>Disbursed Net</Text>
                  <Text style={styles.amountNet}>{formatCurrency(item.netAmount)}</Text>
                </View>
              </View>

              {item.transactionReference ? (
                <View style={styles.auditBlock}>
                  <Text style={styles.auditLabel}>Transaction Ref: {item.transactionReference}</Text>
                  {item.processedAt ? (
                    <Text style={styles.auditTime}>Paid: {new Date(item.processedAt).toLocaleDateString()}</Text>
                  ) : null}
                </View>
              ) : null}

              {item.rejectionReason ? (
                <View style={styles.rejectionBlock}>
                  <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
                  <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Request Payout Modal */}
      <Modal
        visible={requestModalVisible}
        title="Request Payout"
        onClose={() => setRequestModalVisible(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalHeading}>Confirm Payout Disbursement</Text>
          <Text style={styles.modalDescription}>
            You are requesting a payout of your current available balance covering concluded online bookings.
          </Text>

          <Card style={styles.modalSummaryCard}>
            <View style={styles.modalSummaryRow}>
              <Text style={styles.modalSummaryLabel}>Eligible Bookings:</Text>
              <Text style={styles.modalSummaryValue}>{summary?.metrics.eligibleBookingsCount ?? 0}</Text>
            </View>
            <View style={styles.modalSummaryRow}>
              <Text style={styles.modalSummaryLabel}>Net Payable Amount:</Text>
              <Text style={styles.modalSummaryHighlight}>
                {formatCurrency(summary?.metrics.availableBalance ?? 0)}
              </Text>
            </View>
          </Card>

          <Input
            label="Notes (Optional)"
            placeholder="Add any instructions or account reference"
            value={requestNotes}
            onChangeText={setRequestNotes}
          />

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              variant="outline"
              size="medium"
              disabled={requestSubmitting}
              onPress={() => setRequestModalVisible(false)}
            />
            <Button
              title="Submit Request"
              variant="primary"
              size="medium"
              loading={requestSubmitting}
              onPress={handleRequestPayout}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.large },
  scrollContent: { padding: spacing.medium, paddingBottom: spacing.xxlarge },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.medium,
  },
  headerTextGroup: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xxsmall },
  badgeGroup: { alignItems: 'flex-end', gap: spacing.xxsmall },

  availableCard: {
    backgroundColor: '#0F2942',
    borderColor: '#1D3B5C',
    padding: spacing.large,
    marginBottom: spacing.medium,
  },
  availableLabel: { color: '#88A4C2', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  availableAmount: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginVertical: spacing.xsmall },
  availableCaption: { color: '#B0C8E0', fontSize: 13, marginBottom: spacing.medium },
  availableActionRow: { flexDirection: 'row' },

  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.medium,
    marginBottom: spacing.medium,
  },
  metricCard: {
    flex: 1,
    padding: spacing.medium,
    gap: spacing.xxsmall,
  },
  metricLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  metricValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  metricCaption: { fontSize: 11, color: colors.muted },

  payAtHotelCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  payAtHotelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payAtHotelTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  divider: { marginVertical: spacing.small },
  payAtHotelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: spacing.xsmall,
  },
  payAtHotelLabel: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  payAtHotelAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  payAtHotelCaption: { fontSize: 12, color: colors.muted, marginTop: 2 },
  commissionReceivableBlock: { alignItems: 'flex-end' },
  commissionReceivableAmount: { fontSize: 20, fontWeight: '700', color: colors.error },
  payAtHotelNotice: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
    marginTop: spacing.small,
    backgroundColor: colors.background,
    padding: spacing.small,
    borderRadius: radii.small,
  },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.small,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.small,
    alignItems: 'center',
    borderRadius: radii.small,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.surface,
  },

  filterBar: {
    gap: spacing.xsmall,
    paddingVertical: spacing.xxsmall,
    marginBottom: spacing.medium,
  },
  filterChip: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.xsmall,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.surface,
  },

  itemCard: {
    marginBottom: spacing.small,
    padding: spacing.medium,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemRef: { fontSize: 14, fontWeight: '700', color: colors.primary },
  itemHotel: { fontSize: 13, color: colors.text, marginTop: 2 },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  itemDate: { fontSize: 12, color: colors.muted },
  itemGuest: { fontSize: 12, color: colors.muted },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.small,
    borderRadius: radii.small,
  },
  amountLabel: { fontSize: 11, color: colors.muted },
  amountValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  amountCommission: { fontSize: 14, fontWeight: '600', color: colors.error, marginTop: 2 },
  amountNet: { fontSize: 15, fontWeight: '700', color: colors.success, marginTop: 2 },
  itemNotice: { fontSize: 11, color: colors.muted, marginTop: spacing.xsmall, fontStyle: 'italic' },

  auditBlock: {
    marginTop: spacing.small,
    padding: spacing.small,
    backgroundColor: '#F0F9FF',
    borderRadius: radii.small,
  },
  auditLabel: { fontSize: 12, fontWeight: '600', color: colors.primary },
  auditTime: { fontSize: 11, color: colors.muted, marginTop: 2 },

  rejectionBlock: {
    marginTop: spacing.small,
    padding: spacing.small,
    backgroundColor: colors.errorSubtle,
    borderRadius: radii.small,
  },
  rejectionTitle: { fontSize: 12, fontWeight: '700', color: colors.error },
  rejectionText: { fontSize: 12, color: colors.error, marginTop: 2 },

  modalContent: { gap: spacing.medium },
  modalHeading: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalDescription: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  modalSummaryCard: {
    backgroundColor: colors.background,
    padding: spacing.medium,
    gap: spacing.small,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSummaryLabel: { fontSize: 14, color: colors.muted },
  modalSummaryValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  modalSummaryHighlight: { fontSize: 20, fontWeight: '800', color: colors.success },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
    marginTop: spacing.small,
  },
});
