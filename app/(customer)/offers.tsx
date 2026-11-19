import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import * as couponApi from '@/services/api/couponApi';
import type { Offer } from '@/types/coupon';
import { formatCurrency } from '@/utils/currency';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function OffersScreen() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    try {
      setError(null);
      const data = await couponApi.getActiveOffers();
      setOffers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load promotional offers.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchOffers();
  };

  const handleCopyCode = (code: string) => {
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const handleBookNow = () => {
    router.push('/(customer)/search');
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <Loader label="Loading offers & deals…" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && offers.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <ErrorView message={error} onRetry={() => void fetchOffers()} />
        </View>
      </SafeAreaView>
    );
  }

  const renderOffer = ({ item }: { item: Offer }) => {
    const discountLabel =
      item.discountType === 'PERCENTAGE'
        ? `${item.discountValue}% OFF`
        : `${formatCurrency(item.discountValue)} OFF`;

    const isCopied = copiedCode === item.code;

    return (
      <Card padding="medium">
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <Badge label={discountLabel} tone="success" />
            <TouchableOpacity
              style={styles.codePill}
              onPress={() => handleCopyCode(item.code)}
              activeOpacity={0.7}
            >
              <Text style={styles.codeText}>{item.code}</Text>
              <Text style={styles.copyAction}>{isCopied ? 'COPIED!' : 'TAP TO COPY'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.offerTitle}>{item.title}</Text>
          <Text style={styles.offerDescription}>{item.description}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Min Spend</Text>
              <Text style={styles.detailValue}>
                {formatCurrency(item.minimumBookingAmount)}
              </Text>
            </View>

            {item.maximumDiscount ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Max Discount</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(item.maximumDiscount)}
                </Text>
              </View>
            ) : null}

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Valid Until</Text>
              <Text style={styles.detailValue}>{formatDate(item.validUntil)}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Button
              title="Book Stays with Offer"
              size="medium"
              onPress={handleBookNow}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Offers & Deals
          </Text>
          <Text style={styles.subtitle}>
            Explore exclusive discounts for your upcoming hotel getaways
          </Text>
        </View>

        <FlatList
          data={offers}
          keyExtractor={(item) => item.id}
          renderItem={renderOffer}
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
              title="No active offers"
              description="Check back soon for new seasonal deals, holiday promos, and special getaway packages!"
              actionLabel="Browse Hotels"
              onAction={() => router.push('/(customer)/search')}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.large },
  header: { paddingHorizontal: spacing.medium, paddingTop: spacing.medium, paddingBottom: spacing.small },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  listContent: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxlarge },
  cardInner: { gap: spacing.small },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codePill: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xxsmall,
    alignItems: 'flex-end',
  },
  codeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  copyAction: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  offerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  offerDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.small,
    borderRadius: radii.medium,
  },
  detailItem: { gap: spacing.xxxsmall },
  detailLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actionRow: { marginTop: spacing.xxxsmall },
});
