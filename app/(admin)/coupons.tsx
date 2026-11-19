import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import * as couponApi from '@/services/api/couponApi';
import type { Coupon } from '@/types/coupon';
import { formatCurrency, getCurrencySymbol } from '@/utils/currency';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function AdminCouponsScreen() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Create Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMinAmount, setFormMinAmount] = useState('0');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formPerUserLimit, setFormPerUserLimit] = useState('1');
  const [formValidityDays, setFormValidityDays] = useState('30');

  const fetchCoupons = useCallback(async () => {
    try {
      setError(null);
      const isActiveParam = statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;
      const res = await couponApi.getAdminCoupons({
        search: search.trim() || undefined,
        isActive: isActiveParam,
        limit: 50,
      });
      setCoupons(res.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load coupons';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchCoupons();
  };

  const handleToggleActive = async (item: Coupon) => {
    try {
      await couponApi.updateAdminCoupon(item.id, { isActive: !item.isActive });
      void fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update coupon';
      alert(msg);
    }
  };

  const handleCreateCoupon = async () => {
    if (!formCode.trim()) {
      setFormError('Coupon code is required');
      return;
    }
    const val = Number(formDiscountValue);
    if (!val || val <= 0) {
      setFormError('Discount value must be greater than 0');
      return;
    }
    if (formDiscountType === 'PERCENTAGE' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%');
      return;
    }

    const days = Number(formValidityDays) || 30;
    const now = new Date();
    const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    setIsSubmitting(true);
    setFormError(null);

    try {
      await couponApi.createAdminCoupon({
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim() || null,
        discountType: formDiscountType,
        discountValue: val,
        minimumBookingAmount: Number(formMinAmount) || 0,
        maximumDiscount: formMaxDiscount ? Number(formMaxDiscount) : null,
        validFrom: now.toISOString(),
        validUntil: validUntil.toISOString(),
        usageLimit: formUsageLimit ? Number(formUsageLimit) : null,
        perUserLimit: formPerUserLimit ? Number(formPerUserLimit) : null,
        isActive: true,
      });

      setModalVisible(false);
      // Reset form
      setFormCode('');
      setFormDescription('');
      setFormDiscountValue('');
      setFormMaxDiscount('');
      setFormUsageLimit('');
      void fetchCoupons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create coupon';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCouponItem = ({ item }: { item: Coupon }) => {
    const isPercentage = item.discountType === 'PERCENTAGE';
    const discountText = isPercentage ? `${item.discountValue}% OFF` : `${formatCurrency(item.discountValue)} OFF`;

    return (
      <Card padding="medium">
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.codeWrap}>
              <Text style={styles.couponCode}>{item.code}</Text>
              <Badge
                label={item.isActive ? 'ACTIVE' : 'INACTIVE'}
                tone={item.isActive ? 'success' : 'neutral'}
              />
            </View>
            <Badge label={discountText} tone="gold" />
          </View>

          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Usage</Text>
              <Text style={styles.statValue}>
                {item.usedCount ?? 0} / {item.usageLimit ?? '∞'}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Min Spend</Text>
              <Text style={styles.statValue}>{formatCurrency(item.minimumBookingAmount)}</Text>
            </View>
            {item.maximumDiscount ? (
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Max Cap</Text>
                <Text style={styles.statValue}>{formatCurrency(item.maximumDiscount)}</Text>
              </View>
            ) : null}
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Per User</Text>
              <Text style={styles.statValue}>{item.perUserLimit ?? '∞'}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Button
              title={item.isActive ? 'Deactivate' : 'Activate'}
              variant={item.isActive ? 'outline' : 'primary'}
              size="small"
              onPress={() => void handleToggleActive(item)}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              Coupon Management
            </Text>
            <Text style={styles.headerSubtitle}>Create, configure and monitor promotional codes</Text>
          </View>
          <Button
            title="+ New Coupon"
            size="medium"
            onPress={() => {
              setFormError(null);
              setModalVisible(true);
            }}
          />
        </View>

        {/* Search & Tabs */}
        <View style={styles.controlsSection}>
          <Input
            label="Search coupons"
            placeholder="Search code or description…"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <View style={styles.tabRow}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, statusFilter === tab && styles.activeTab]}
                onPress={() => setStatusFilter(tab)}
              >
                <Text style={[styles.tabText, statusFilter === tab && styles.activeTabText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Coupon List */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <Loader label="Loading coupons…" />
          </View>
        ) : error && coupons.length === 0 ? (
          <View style={styles.centerContainer}>
            <ErrorView message={error} onRetry={() => void fetchCoupons()} />
          </View>
        ) : (
          <FlatList
            data={coupons}
            keyExtractor={(item) => item.id}
            renderItem={renderCouponItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No coupons found"
                description="Create a promotional coupon or adjust your search filter."
                actionLabel="Create Coupon"
                onAction={() => setModalVisible(true)}
              />
            }
          />
        )}

        {/* Create Coupon Modal */}
        <Modal
          visible={modalVisible}
          title="Create New Coupon"
          onClose={() => setModalVisible(false)}
        >
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {formError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Input
              label="Coupon Code *"
              placeholder="e.g. SUMMER25"
              value={formCode}
              onChangeText={setFormCode}
              autoCapitalize="characters"
            />

            <Input
              label="Description (optional)"
              placeholder="e.g. 25% discount on beach resort stays"
              value={formDescription}
              onChangeText={setFormDescription}
            />

            {/* Discount Type Selector */}
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formDiscountType === 'PERCENTAGE' && styles.typeButtonActive,
                ]}
                onPress={() => setFormDiscountType('PERCENTAGE')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formDiscountType === 'PERCENTAGE' && styles.typeButtonTextActive,
                  ]}
                >
                  Percentage (%)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formDiscountType === 'FIXED_AMOUNT' && styles.typeButtonActive,
                ]}
                onPress={() => setFormDiscountType('FIXED_AMOUNT')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    formDiscountType === 'FIXED_AMOUNT' && styles.typeButtonTextActive,
                  ]}
                >
                  Fixed Amount ({getCurrencySymbol()})
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label={`Discount Value (${formDiscountType === 'PERCENTAGE' ? '%' : getCurrencySymbol()}) *`}
              placeholder={formDiscountType === 'PERCENTAGE' ? 'e.g. 15' : 'e.g. 50'}
              value={formDiscountValue}
              onChangeText={setFormDiscountValue}
              keyboardType="numeric"
            />

            {formDiscountType === 'PERCENTAGE' ? (
              <Input
                label={`Maximum Discount Cap (${getCurrencySymbol()}) (optional)`}
                placeholder="e.g. 100"
                value={formMaxDiscount}
                onChangeText={setFormMaxDiscount}
                keyboardType="numeric"
              />
            ) : null}

            <Input
              label={`Minimum Booking Amount (${getCurrencySymbol()})`}
              placeholder="0"
              value={formMinAmount}
              onChangeText={setFormMinAmount}
              keyboardType="numeric"
            />

            <Input
              label="Global Usage Limit (optional)"
              placeholder="e.g. 500 (blank for unlimited)"
              value={formUsageLimit}
              onChangeText={setFormUsageLimit}
              keyboardType="numeric"
            />

            <Input
              label="Per-Customer Usage Limit"
              placeholder="1"
              value={formPerUserLimit}
              onChangeText={setFormPerUserLimit}
              keyboardType="numeric"
            />

            <Input
              label="Validity Duration (Days)"
              placeholder="30"
              value={formValidityDays}
              onChangeText={setFormValidityDays}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="large"
                onPress={() => setModalVisible(false)}
              />
              <Button
                title={isSubmitting ? 'Creating…' : 'Save Coupon'}
                size="large"
                loading={isSubmitting}
                onPress={() => void handleCreateCoupon()}
              />
            </View>
          </ScrollView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.large },
  header: {
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    paddingBottom: spacing.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  controlsSection: { paddingHorizontal: spacing.medium, gap: spacing.small, marginBottom: spacing.small },
  tabRow: { flexDirection: 'row', gap: spacing.small },
  tab: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
  },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  activeTabText: { color: '#FFFFFF' },
  listContent: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  cardInner: { gap: spacing.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  couponCode: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.small,
    borderRadius: radii.medium,
  },
  statCol: { gap: 2 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalScroll: { gap: spacing.medium, paddingBottom: spacing.medium },
  modalErrorBox: {
    padding: spacing.small,
    borderRadius: radii.small,
    backgroundColor: colors.errorSubtle,
    borderWidth: 1,
    borderColor: colors.error,
  },
  modalErrorText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  typeSelectorRow: { flexDirection: 'row', gap: spacing.small },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.small,
    alignItems: 'center',
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.accentSubtle,
  },
  typeButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  typeButtonTextActive: { color: colors.primary },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.small, marginTop: spacing.small },
});
