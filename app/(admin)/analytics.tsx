
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAdminAnalytics } from '@/services/api/adminApi';
import type { AdminAnalyticsData } from '@/services/api/adminApi';

import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Loader } from '@/components/common/Loader';
import { ErrorView } from '@/components/common/ErrorView';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

type TrendItem = {
  date: string;
  value: number;
};

type StatusItem = {
  status: string;
  count: number;
  amount?: string;
};

function formatCurrency(value: number | string): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function formatStatus(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'PAID':
      return colors.success;

    case 'FAILED':
    case 'CANCELLED':
      return colors.error;

    case 'PENDING':
    case 'PROCESSING':
      return colors.warning;

    case 'REFUNDED':
      return colors.accent;

    default:
      return colors.primary;
  }
}

function TrendChart({
  title,
  subtitle,
  data,
  currency = false,
}: {
  title: string;
  subtitle: string;
  data: TrendItem[];
  currency?: boolean;
}) {
  const maxValue = Math.max(
    ...data.map((item) => item.value),
    1,
  );

  return (
    <Card padding="medium" style={styles.chartCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>
          No data available for this period.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chartContent}
        >
          {data.map((item) => {
            const barHeight = Math.max(
              (item.value / maxValue) * 110,
              4,
            );

            return (
              <View key={item.date} style={styles.barColumn}>
                <Text style={styles.barValue}>
                  {currency
                    ? formatCurrency(item.value)
                    : item.value}
                </Text>

                <View style={styles.barArea}>
                  <View
                    style={[
                      styles.bar,
                      { height: barHeight },
                    ]}
                  />
                </View>

                <Text style={styles.barLabel}>
                  {formatDate(item.date)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Card>
  );
}

function StatusBreakdown({
  title,
  subtitle,
  data,
  showAmount = false,
}: {
  title: string;
  subtitle: string;
  data: StatusItem[];
  showAmount?: boolean;
}) {
  const total = data.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <Card padding="medium" style={styles.statusCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>
          No status information available.
        </Text>
      ) : (
        <>
          <View style={styles.statusSummary}>
            <Text style={styles.totalLabel}>Total Records</Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>

          {data.map((item) => {
            const percentage =
              total > 0 ? (item.count / total) * 100 : 0;

            const statusColor = getStatusColor(item.status);

            return (
              <View key={item.status} style={styles.statusItem}>
                <View style={styles.statusHeader}>
                  <View style={styles.statusNameContainer}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor },
                      ]}
                    />
                    <Text style={styles.statusName}>
                      {formatStatus(item.status)}
                    </Text>
                  </View>

                  <Text style={styles.statusCount}>
                    {item.count}
                  </Text>
                </View>

                <View style={styles.progressBackground}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${percentage}%`,
                        backgroundColor: statusColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.statusFooter}>
                  <Text style={styles.percentageText}>
                    {percentage.toFixed(1)}%
                  </Text>

                  {showAmount && item.amount !== undefined ? (
                    <Text style={styles.amountText}>
                      {formatCurrency(item.amount)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </>
      )}
    </Card>
  );
}

export default function AdminAnalyticsScreen() {
  const [analytics, setAnalytics] =
    useState<AdminAnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const response = await getAdminAnalytics();

      setAnalytics(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load analytics data.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading && !analytics) {
    return (
      <Loader
        label="Loading admin analytics..."
        fullScreen
      />
    );
  }

  if (error && !analytics) {
    return (
      <View style={styles.errorContainer}>
        <ErrorView
          title="Analytics unavailable"
          message={error}
          onRetry={() => loadAnalytics()}
        />
      </View>
    );
  }

  if (!analytics) {
    return null;
  }

  const bookingTotal = analytics.bookingTrends.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const revenueTotal = analytics.revenueTrends.reduce(
    (sum, item) => sum + Number(item.revenue || 0),
    0,
  );

  const bookingTrendData = analytics.bookingTrends.map((item) => ({
    date: item.date,
    value: item.count,
  }));

  const revenueTrendData = analytics.revenueTrends.map((item) => ({
    date: item.date,
    value: Number(item.revenue || 0),
  }));

  return (
    <View style={styles.container}>
      <Header
        title="Admin Analytics"
        subtitle="TrumiTrip performance overview"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnalytics(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <Text style={styles.warningText}>
            Unable to refresh. Showing previously loaded data.
          </Text>
        ) : null}

        <Card padding="medium" style={styles.periodCard}>
          <Text style={styles.periodTitle}>
            Analytics Reporting Period
          </Text>

          <Text style={styles.periodValue}>
            {formatDate(analytics.period.startDate)}
            {' - '}
            {formatDate(analytics.period.endDate)}
          </Text>

          <Text style={styles.periodSubtitle}>
            Last {analytics.period.days} days
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>
          Performance Summary
        </Text>

        <View style={styles.summaryGrid}>
          <Card padding="medium" style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Total Bookings
            </Text>
            <Text style={styles.summaryValue}>
              {bookingTotal}
            </Text>
          </Card>

          <Card padding="medium" style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Total Revenue
            </Text>
            <Text style={[styles.summaryValue, styles.revenueValue]}>
              {formatCurrency(revenueTotal)}
            </Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>
          Booking & Revenue Trends
        </Text>

        <TrendChart
          title="Booking Trends"
          subtitle="Daily booking activity"
          data={bookingTrendData}
        />

        <TrendChart
          title="Revenue Trends"
          subtitle="Daily successful payment revenue"
          data={revenueTrendData}
          currency
        />

        <Text style={styles.sectionTitle}>
          Booking Analysis
        </Text>

        <StatusBreakdown
          title="Booking Status"
          subtitle="Distribution of booking records"
          data={analytics.bookingStatus}
        />

        <Text style={styles.sectionTitle}>
          Payment Analysis
        </Text>

        <StatusBreakdown
          title="Payment Status"
          subtitle="Payment transaction breakdown"
          data={analytics.paymentStatus}
        />

        <Text style={styles.sectionTitle}>
          Payout Analysis
        </Text>

        <StatusBreakdown
          title="Payout Status"
          subtitle="Partner payout breakdown"
          data={analytics.payoutStatus}
          showAmount
        />

        <Text style={styles.footer}>
          TrumiTrip Administration Analytics
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.medium,
    paddingBottom: spacing.xxxlarge,
    gap: spacing.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.small,
  },
  periodCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodTitle: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  periodValue: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.small,
  },
  periodSubtitle: {
    color: colors.surface,
    fontSize: 12,
    marginTop: spacing.xxsmall,
    opacity: 0.8,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  summaryCard: {
    flex: 1,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.small,
  },
  revenueValue: {
    color: colors.success,
    fontSize: 20,
  },
  chartCard: {
    width: '100%',
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xxsmall,
  },
  chartContent: {
    paddingTop: spacing.large,
    paddingBottom: spacing.small,
    gap: spacing.small,
  },
  barColumn: {
    width: 66,
    alignItems: 'center',
  },
  barValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: spacing.xsmall,
  },
  barArea: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 28,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing.small,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: spacing.large,
    textAlign: 'center',
  },
  statusCard: {
    width: '100%',
  },
  statusSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.large,
    marginBottom: spacing.medium,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  statusItem: {
    marginBottom: spacing.medium,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xsmall,
  },
  statusNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statusCount: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  progressBackground: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 10,
  },
  statusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxsmall,
  },
  percentageText: {
    color: colors.muted,
    fontSize: 11,
  },
  amountText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
  },
  footer: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.medium,
  },
});
