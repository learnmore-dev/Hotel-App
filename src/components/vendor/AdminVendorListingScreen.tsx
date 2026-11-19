
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import {
  getAdminVendors,
  type AdminVendor,
} from '@/services/api/adminApi';

type VendorStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const statuses: VendorStatus[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
];

function statusTone(status: string): 'neutral' | 'success' | 'error' | 'gold' {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'PENDING':
      return 'gold';
    default:
      return 'neutral';
  }
}

export function AdminVendorListingScreen() {
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VendorStatus>('ALL');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const pageRef = useRef(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (reset = true) => {
    setError(null);

    if (reset) {
      setLoading(true);
      pageRef.current = 1;
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await getAdminVendors({
        search: search.trim() || undefined,
        status: status === 'ALL' ? undefined : status,
        page: reset ? 1 : pageRef.current + 1,
        limit: 10,
      });

      setVendors((current) =>
        reset ? result.items : [...current, ...result.items],
      );

      pageRef.current = result.pagination.page;
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load vendors. Please try again.',
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const renderVendor = ({ item }: { item: AdminVendor }) => (
    <View style={styles.vendorCard}>
      <View style={styles.cardHeader}>
        <View style={styles.vendorInfo}>
          <Text style={styles.businessName}>{item.businessName}</Text>
          <Text style={styles.contactName}>
            {item.user.fullName || 'No contact name'}
          </Text>
        </View>

        <Badge
          label={item.status}
          tone={statusTone(item.status)}
          showDot
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.detailLabel}>Business email</Text>
      <Text style={styles.detailValue}>
        {item.businessEmail || item.user.email || 'Not provided'}
      </Text>

      <Text style={styles.detailLabel}>Phone</Text>
      <Text style={styles.detailValue}>
        {item.businessPhone || item.user.phone || 'Not provided'}
      </Text>

      <Text style={styles.detailLabel}>Address</Text>
      <Text style={styles.detailValue}>
        {item.address || 'Not provided'}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.hotelCount}</Text>
          <Text style={styles.statLabel}>Hotels</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {item.commissionRate}%
          </Text>
          <Text style={styles.statLabel}>Commission</Text>
        </View>

        <View style={styles.stat}>
          <Badge
            label={item.user.isActive ? 'Account Active' : 'Account Inactive'}
            tone={item.user.isActive ? 'success' : 'neutral'}
          />
          <Text style={styles.statLabel}>Account</Text>
        </View>
      </View>

      <View style={styles.documentsRow}>
        <Text style={styles.detailLabel}>Documents</Text>
        <Text style={styles.detailValue}>
          {item.documents?.length
            ? `${item.documents.length} document(s) uploaded`
            : 'No documents uploaded'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Management</Text>
        <Text style={styles.subtitle}>
          Review and monitor registered business partners
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Input
          label="Search vendors"
          accessibilityLabel="Search vendors by business or contact details"
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Business name, email, or phone"
          returnKeyType="search"
          onSubmitEditing={() => setSearch(searchDraft.trim())}
        />

        <Button
          title="Search"
          onPress={() => setSearch(searchDraft.trim())}
          fullWidth
        />
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Vendor status</Text>

        <View style={styles.filters}>
          {statuses.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: status === item }}
              onPress={() => setStatus(item)}
              style={[
                styles.filterButton,
                status === item && styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  status === item && styles.filterTextActive,
                ]}
              >
                {item === 'ALL' ? 'All' : item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.resultBar}>
        <Text style={styles.resultText}>
          {total} {total === 1 ? 'vendor' : 'vendors'}
        </Text>
      </View>

      {error ? (
        <ErrorView message={error} onRetry={() => void load(true)} />
      ) : null}

      {loading ? (
        <Loader label="Loading vendors" />
      ) : vendors.length === 0 && !error ? (
        <EmptyState
          title="No vendors found"
          description="Try changing your search or status filter."
        />
      ) : null}

      {!loading && vendors.length > 0 ? (
        <FlatList
          data={vendors}
          keyExtractor={(vendor) => vendor.id}
          renderItem={renderVendor}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          onEndReached={() => {
            if (page < totalPages && !loading && !loadingMore) {
              void load(false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            page < totalPages ? (
              <Button
                title={loadingMore ? 'Loading...' : 'Load more'}
                variant="outline"
                fullWidth
                disabled={loadingMore}
                onPress={() => void load(false)}
              />
            ) : null
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.medium,
    gap: spacing.xxsmall,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  searchBox: {
    paddingHorizontal: spacing.medium,
    gap: spacing.small,
  },
  filterSection: {
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  filterTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xsmall,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.surface,
  },
  resultBar: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
  },
  resultText: {
    color: colors.text,
    fontWeight: '700',
  },
  list: {
    padding: spacing.medium,
    gap: spacing.medium,
    paddingBottom: spacing.xxxlarge,
  },
  vendorCard: {
    padding: spacing.medium,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xsmall,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.small,
  },
  vendorInfo: {
    flex: 1,
    gap: spacing.xxsmall,
  },
  businessName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  contactName: {
    color: colors.muted,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xsmall,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.small,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  stat: {
    gap: spacing.xxsmall,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  documentsRow: {
    marginTop: spacing.small,
    gap: spacing.xxsmall,
  },
});
