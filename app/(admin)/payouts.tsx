import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import type { AdminPayoutItem, PayoutStatus } from '@/types/payout';
import { formatCurrency } from '@/utils/currency';

type StatusFilter = 'ALL' | PayoutStatus;

function getStatusBadgeTone(status: PayoutStatus): BadgeTone {
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

export default function AdminPayoutsScreen() {
  const [payouts, setPayouts] = useState<AdminPayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Action Modals State
  const [selectedPayout, setSelectedPayout] = useState<AdminPayoutItem | null>(null);

  // 1. Mark as Paid Modal
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // 2. Reject Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // 3. Update Partner Commission Modal
  const [commissionModalVisible, setCommissionModalVisible] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      setError(null);
      const res = await payoutApi.getAdminPayouts({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 50,
      });
      setPayouts(res.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load payouts';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPayouts();
  }, [fetchPayouts]);

  // Actions
  const handleApprove = async (payout: AdminPayoutItem) => {
    try {
      await payoutApi.updateAdminPayoutStatus(payout.id, {
        action: 'APPROVE',
      });
      Alert.alert('Approved', `Payout ${payout.id.slice(0, 8)} moved to PROCESSING.`);
      await fetchPayouts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve payout';
      Alert.alert('Error', msg);
    }
  };

  const openMarkPaidModal = (payout: AdminPayoutItem) => {
    setSelectedPayout(payout);
    setTransactionRef(`TXN-BANK-${Date.now().toString().slice(-6)}`);
    setPayNotes('');
    setPayModalVisible(true);
  };

  const handleConfirmPaid = async () => {
    if (!selectedPayout) return;
    if (!transactionRef.trim() || transactionRef.trim().length < 3) {
      Alert.alert('Validation Error', 'Transaction reference must be at least 3 characters.');
      return;
    }

    try {
      setPaySubmitting(true);
      await payoutApi.updateAdminPayoutStatus(selectedPayout.id, {
        action: 'MARK_PAID',
        transactionReference: transactionRef.trim(),
        notes: payNotes.trim() || undefined,
      });

      setPayModalVisible(false);
      Alert.alert('Disbursed', `Payout marked as PAID with ref: ${transactionRef.trim()}`);
      await fetchPayouts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark as paid';
      Alert.alert('Error', msg);
    } finally {
      setPaySubmitting(false);
    }
  };

  const openRejectModal = (payout: AdminPayoutItem) => {
    setSelectedPayout(payout);
    setRejectionReason('');
    setRejectNotes('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedPayout) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      Alert.alert('Validation Error', 'Rejection reason must be at least 3 characters.');
      return;
    }

    try {
      setRejectSubmitting(true);
      await payoutApi.updateAdminPayoutStatus(selectedPayout.id, {
        action: 'REJECT',
        rejectionReason: rejectionReason.trim(),
        notes: rejectNotes.trim() || undefined,
      });

      setRejectModalVisible(false);
      Alert.alert('Rejected', `Payout ${selectedPayout.id.slice(0, 8)} has been rejected.`);
      await fetchPayouts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject payout';
      Alert.alert('Error', msg);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const openCommissionModal = (payout: AdminPayoutItem) => {
    setSelectedPayout(payout);
    setNewCommissionRate(String(payout.partner.commissionRate));
    setCommissionModalVisible(true);
  };

  const handleConfirmCommission = async () => {
    if (!selectedPayout) return;
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Validation Error', 'Commission rate must be a valid number between 0 and 100%.');
      return;
    }

    try {
      setCommissionSubmitting(true);
      await payoutApi.updatePartnerCommission(selectedPayout.partner.id, {
        commissionRate: rate,
      });

      setCommissionModalVisible(false);
      Alert.alert(
        'Commission Updated',
        `Partner commission updated to ${rate.toFixed(2)}%. Future bookings/payouts will use this rate. Historical payouts remain unchanged.`,
      );
      await fetchPayouts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update commission rate';
      Alert.alert('Error', msg);
    } finally {
      setCommissionSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payouts Console</Text>
          <Text style={styles.headerSubtitle}>
            Manage partner disbursement requests, audit payouts, and configure commission rates.
          </Text>
        </View>

        {/* Filter Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {(['ALL', 'PENDING', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED'] as StatusFilter[]).map((filter) => (
            <Pressable
              key={filter}
              style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
              onPress={() => setStatusFilter(filter)}>
              <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Payout List */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <Loader label="Loading payouts..." />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <ErrorView title="Unable to Load Payouts" message={error} onRetry={fetchPayouts} />
          </View>
        ) : payouts.length === 0 ? (
          <EmptyState
            title="No Payouts Found"
            description={`No payout requests match the "${statusFilter}" filter.`}
          />
        ) : (
          <FlatList
            data={payouts}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Card style={styles.payoutCard}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{item.partner.businessName}</Text>
                    <Text style={styles.partnerEmail}>{item.partner.contactEmail}</Text>
                  </View>
                  <Badge label={item.status} tone={getStatusBadgeTone(item.status)} />
                </View>

                <Divider inset={spacing.small} />

                {/* Booking & Hotel Details */}
                <View style={styles.bookingDetails}>
                  <Text style={styles.hotelText}>{item.booking.hotelName} ({item.booking.city})</Text>
                  <Text style={styles.bookingRefText}>Booking: {item.booking.bookingId} • Guest: {item.booking.customerName}</Text>
                  <Text style={styles.datesText}>Stay: {item.booking.checkIn.slice(0, 10)} to {item.booking.checkOut.slice(0, 10)}</Text>
                </View>

                {/* Financial Breakdown */}
                <View style={styles.amountsRow}>
                  <View>
                    <Text style={styles.amountLabel}>Gross Revenue</Text>
                    <Text style={styles.amountValue}>{formatCurrency(item.amount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Platform Fee ({item.partner.commissionRate}%)</Text>
                    <Text style={styles.amountFee}>-{formatCurrency(item.commissionAmount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Net Payable</Text>
                    <Text style={styles.amountNet}>{formatCurrency(item.netAmount)}</Text>
                  </View>
                </View>

                {/* Audit Information */}
                {item.batchReference ? (
                  <Text style={styles.batchRefText}>Batch: {item.batchReference}</Text>
                ) : null}

                {item.transactionReference ? (
                  <View style={styles.auditInfo}>
                    <Text style={styles.auditTxRef}>Disbursement Ref: {item.transactionReference}</Text>
                    {item.processedAt ? (
                      <Text style={styles.auditDate}>Settled on {new Date(item.processedAt).toLocaleString()}</Text>
                    ) : null}
                  </View>
                ) : null}

                {item.rejectionReason ? (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
                    <Text style={styles.rejectionBody}>{item.rejectionReason}</Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <Button
                    title="Commission"
                    variant="ghost"
                    size="small"
                    onPress={() => openCommissionModal(item)}
                  />

                  {item.status === 'PENDING' ? (
  <>
    <Button
      title="Reject"
      variant="danger"
      size="small"
      onPress={() => openRejectModal(item)}
    />
    <Button
      title="Approve"
      variant="secondary"
      size="small"
      onPress={() => handleApprove(item)}
    />
  </>
) : item.status === 'PROCESSING' ? (
  <>
    <Button
      title="Reject"
      variant="danger"
      size="small"
      onPress={() => openRejectModal(item)}
    />
    <Button
      title="Mark Paid"
      variant="primary"
      size="small"
      onPress={() => openMarkPaidModal(item)}
    />
  </>
) : item.status === 'PAID' ? (
  <Badge label="Disbursed & Immutable" tone="success" />
) : null}
                </View>
              </Card>
            )}
          />
        )}
      </View>

      {/* Mark as Paid Modal */}
      <Modal
        visible={payModalVisible}
        title="Disburse Payout"
        onClose={() => setPayModalVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            Disburse {formatCurrency(selectedPayout?.netAmount ?? 0)} to {selectedPayout?.partner.businessName}.
          </Text>

          <Input
            label="Transaction Reference (Required)"
            placeholder="e.g. BANK-UTR-12345678"
            value={transactionRef}
            onChangeText={setTransactionRef}
          />

          <Input
            label="Disbursement Notes (Optional)"
            placeholder="Account details or transfer note"
            value={payNotes}
            onChangeText={setPayNotes}
          />

          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="outline"
              size="medium"
              disabled={paySubmitting}
              onPress={() => setPayModalVisible(false)}
            />
            <Button
              title="Confirm Payment"
              variant="primary"
              size="medium"
              loading={paySubmitting}
              onPress={handleConfirmPaid}
            />
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        title="Reject Payout"
        onClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            Reject payout request of {formatCurrency(selectedPayout?.netAmount ?? 0)}. The booking will be returned to the partner's eligible pool.
          </Text>

          <Input
            label="Rejection Reason (Required)"
            placeholder="State why this payout cannot be fulfilled"
            value={rejectionReason}
            onChangeText={setRejectionReason}
          />

          <Input
            label="Internal Notes (Optional)"
            placeholder="Administrative remarks"
            value={rejectNotes}
            onChangeText={setRejectNotes}
          />

          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="outline"
              size="medium"
              disabled={rejectSubmitting}
              onPress={() => setRejectModalVisible(false)}
            />
            <Button
              title="Reject Payout"
              variant="danger"
              size="medium"
              loading={rejectSubmitting}
              onPress={handleConfirmReject}
            />
          </View>
        </View>
      </Modal>

      {/* Update Commission Modal */}
      <Modal
        visible={commissionModalVisible}
        title="Configure Commission"
        onClose={() => setCommissionModalVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            Update commission rate for {selectedPayout?.partner.businessName}.
          </Text>

          <Input
            label="Commission Rate (%)"
            placeholder="e.g. 15.00"
            value={newCommissionRate}
            onChangeText={setNewCommissionRate}
          />

          <Text style={styles.commissionNote}>
            Note: Rate updates apply to future bookings and payouts. Historical earnings and completed payouts retain their snapshotted commission rate.
          </Text>

          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="outline"
              size="medium"
              disabled={commissionSubmitting}
              onPress={() => setCommissionModalVisible(false)}
            />
            <Button
              title="Save Rate"
              variant="primary"
              size="medium"
              loading={commissionSubmitting}
              onPress={handleConfirmCommission}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    paddingBottom: spacing.small,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.muted, marginTop: spacing.xxsmall },

  filterBar: {
    paddingHorizontal: spacing.medium,
    gap: spacing.xsmall,
    paddingVertical: spacing.small,
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
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  filterChipTextActive: { color: colors.surface },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.large },
  listContent: { padding: spacing.medium, paddingBottom: spacing.xxlarge },

  payoutCard: {
    marginBottom: spacing.medium,
    padding: spacing.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  partnerEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  divider: { marginVertical: spacing.small },

  bookingDetails: { marginBottom: spacing.small },
  hotelText: { fontSize: 14, fontWeight: '600', color: colors.text },
  bookingRefText: { fontSize: 12, color: colors.muted, marginTop: 2 },
  datesText: { fontSize: 12, color: colors.muted, marginTop: 2 },

  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.small,
    borderRadius: radii.small,
    marginBottom: spacing.small,
  },
  amountLabel: { fontSize: 11, color: colors.muted },
  amountValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  amountFee: { fontSize: 14, fontWeight: '600', color: colors.error, marginTop: 2 },
  amountNet: { fontSize: 15, fontWeight: '700', color: colors.success, marginTop: 2 },

  batchRefText: { fontSize: 11, color: colors.muted, marginBottom: spacing.xxsmall },

  auditInfo: {
    padding: spacing.small,
    backgroundColor: '#F0F9FF',
    borderRadius: radii.small,
    marginBottom: spacing.small,
  },
  auditTxRef: { fontSize: 12, fontWeight: '700', color: colors.primary },
  auditDate: { fontSize: 11, color: colors.muted, marginTop: 2 },

  rejectionBox: {
    padding: spacing.small,
    backgroundColor: colors.errorSubtle,
    borderRadius: radii.small,
    marginBottom: spacing.small,
  },
  rejectionTitle: { fontSize: 12, fontWeight: '700', color: colors.error },
  rejectionBody: { fontSize: 12, color: colors.error, marginTop: 2 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xsmall,
    marginTop: spacing.xxsmall,
  },

  modalBody: { gap: spacing.medium },
  modalText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  commissionNote: { fontSize: 12, color: colors.muted, fontStyle: 'italic', lineHeight: 18 },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.small,
    marginTop: spacing.small,
  },
});
