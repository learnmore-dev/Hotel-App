import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { NotificationBell } from '@/components/notification/NotificationBell';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { getPartnerHotels } from '@/services/api/hotelApi';
import type { Hotel } from '@/types/hotel';
import { hotelErrorMessage } from '@/utils/hotelErrors';

export default function PartnerDashboardScreen() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setLoading(true); setError(null); getPartnerHotels({ page: 1, limit: 5 }).then((result) => {
  console.log('PARTNER DASHBOARD API RESULT:', JSON.stringify(result, null, 2));
  console.log('PARTNER DASHBOARD HOTEL COUNT:', result.items?.length);
  console.log('PARTNER DASHBOARD HOTEL NAMES:', result.items?.map((hotel) => hotel.name));

  setHotels(result.items);
  setTotal(result.pagination.total);
}).catch((reason: unknown) => setError(hotelErrorMessage(reason, 'management'))).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.headerRow}><View><Text accessibilityRole="header" style={styles.title}>Partner dashboard</Text><Text style={styles.subtitle}>Manage your hotel listings</Text></View><NotificationBell /></View>
    <View style={styles.summary}><Text style={styles.count}>{loading ? '—' : total}</Text><Text style={styles.label}>Hotels in your account</Text></View>
    <Button title="Add a hotel" onPress={() => router.push('/(partner)/hotel/create')} fullWidth />
    <View style={styles.row}><Text style={styles.section}>Recent hotels</Text><Button title="View all" variant="ghost" onPress={() => router.navigate('/(partner)/hotels')} /></View>
    {error ? <ErrorView message={error} onRetry={load} /> : null}
    {loading ? <Loader label="Loading your hotels" /> : hotels.length ? hotels.map((hotel) => <View key={hotel.id} style={styles.hotelRow}><View style={styles.copy}><Text numberOfLines={1} style={styles.hotelName}>{hotel.name}</Text><Text style={styles.location}>{hotel.city}</Text></View><Badge label={hotel.isActive ? 'Active' : 'Inactive'} tone={hotel.isActive ? 'success' : 'neutral'} /></View>) : !error ? <EmptyState title="No hotels yet" description="Create a hotel listing to get started." actionLabel="Add hotel" onAction={() => router.push('/(partner)/hotel/create')} /> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.medium, gap: spacing.medium }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 14 }, summary: { padding: spacing.large, gap: spacing.xsmall, borderRadius: radii.large, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, count: { color: colors.primary, fontSize: 32, fontWeight: '800' }, label: { color: colors.muted }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, section: { color: colors.text, fontSize: 18, fontWeight: '800' }, hotelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.medium, backgroundColor: colors.surface, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border }, copy: { flex: 1, gap: 4 }, hotelName: { color: colors.text, fontSize: 15, fontWeight: '700' }, location: { color: colors.muted, fontSize: 13 } });
