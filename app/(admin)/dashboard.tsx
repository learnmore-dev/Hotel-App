
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getAdminDashboard } from '@/services/api/adminApi';
import type { AdminDashboardData } from '@/services/api/adminApi';

import { Header } from '@/components/common/Header';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Loader } from '@/components/common/Loader';
import { ErrorView } from '@/components/common/ErrorView';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <Card padding="medium" style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </Card>
  );
}

function formatCurrency(value: string | number): string {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminDashboardScreen() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const response = await getAdminDashboard();
      setDashboard(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return <Loader label="Loading admin dashboard..." fullScreen />;
  }

  if (error && !dashboard) {
    return (
      <View style={styles.errorContainer}>
        <ErrorView
          title="Dashboard unavailable"
          message={error}
          onRetry={() => loadDashboard()}
        />
      </View>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Admin Dashboard"
        subtitle="Overview of TrumiTrip"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
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

        <Text style={styles.sectionTitle}>Users</Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Users"
            value={dashboard.users.total}
            subtitle="Registered users"
            icon="people"
          />
          <StatCard
            title="Customers"
            value={dashboard.users.customers}
            subtitle="Customer accounts"
            icon="person"
          />
          <StatCard
            title="Partners"
            value={dashboard.users.partners}
            subtitle="Registered partners"
            icon="briefcase"
          />
        </View>

        <Text style={styles.sectionTitle}>Hotels</Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Hotels"
            value={dashboard.hotels.total}
            subtitle="All registered hotels"
            icon="business"
          />
          <StatCard
            title="Active Hotels"
            value={dashboard.hotels.active}
            subtitle="Currently active"
            icon="checkmark-circle"
          />
          <StatCard
            title="Featured Hotels"
            value={dashboard.hotels.featured}
            subtitle="Featured listings"
            icon="star"
          />
        </View>

        <Text style={styles.sectionTitle}>Bookings</Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Bookings"
            value={dashboard.bookings.total}
            subtitle="All bookings"
            icon="calendar"
          />
          <StatCard
            title="Confirmed"
            value={dashboard.bookings.confirmed}
            subtitle="Confirmed bookings"
            icon="checkmark-done-circle"
          />
          <StatCard
            title="Pending"
            value={dashboard.bookings.pending}
            subtitle="Awaiting confirmation"
            icon="time"
          />
          <StatCard
            title="Cancelled"
            value={dashboard.bookings.cancelled}
            subtitle="Cancelled bookings"
            icon="close-circle"
          />
        </View>

        <Text style={styles.sectionTitle}>Payments</Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Payments"
            value={dashboard.payments.total}
            subtitle="All payment records"
            icon="card"
          />
          <StatCard
            title="Successful"
            value={dashboard.payments.successful}
            subtitle="Successful payments"
            icon="checkmark-circle"
          />
          <StatCard
            title="Pending Payments"
            value={dashboard.payments.pending}
            subtitle="Awaiting payment"
            icon="hourglass"
          />
        </View>

        <Card padding="large" style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Successful Revenue</Text>
          <Text style={styles.revenueValue}>
            {formatCurrency(dashboard.payments.revenue)}
          </Text>
          <Text style={styles.revenueSubtitle}>
            Based on successful payments
          </Text>
        </Card>

        <Text style={styles.sectionTitle}>Payouts</Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Payouts"
            value={dashboard.payouts.total}
            subtitle="All payout records"
            icon="wallet"
          />
          <StatCard
            title="Pending"
            value={dashboard.payouts.pending}
            subtitle="Awaiting processing"
            icon="time"
          />
          <StatCard
            title="Failed"
            value={dashboard.payouts.failed}
            subtitle="Failed payouts"
            icon="alert-circle"
          />
        </View>

        <Button
          title="View Analytics"
          fullWidth
          onPress={() => router.push('/(admin)/analytics')}
          rightIcon={
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.surface}
            />
          }
        />

        <Text style={styles.footer}>
          TrumiTrip Administration
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  statValue: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.medium,
  },
  statSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xxsmall,
  },
  revenueCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  revenueLabel: {
    color: colors.surface,
    fontSize: 14,
  },
  revenueValue: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '800',
    marginTop: spacing.small,
  },
  revenueSubtitle: {
    color: colors.surface,
    opacity: 0.75,
    fontSize: 12,
    marginTop: spacing.xsmall,
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
