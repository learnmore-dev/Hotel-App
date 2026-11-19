import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { HotelCard } from '@/components/hotel/HotelCard';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { NotificationBell } from '@/components/notification/NotificationBell';
import { getDestinations, getFeaturedHotels } from '@/services/api/hotelApi';
import { hotelErrorMessage } from '@/utils/hotelErrors';
import type { Hotel } from '@/types/hotel';

export function HotelHomeScreen() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setLoading(true); setError(null);
    Promise.all([getFeaturedHotels({ limit: 6 }), getDestinations()])
      .then(([featured, places]) => { setHotels(featured.items); setDestinations(places); })
      .catch((reason: unknown) => { setError(hotelErrorMessage(reason)); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const openSearch = (destination?: string) => router.push({ pathname: '/(customer)/search', params: destination ? { destination } : {} });
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TrumiTrip</Text>
            <Text style={styles.kicker}>YOUR JOURNEY, WELL STAYED</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.navigate('/(customer)/profile')}
              style={styles.profile}>
              <Text style={styles.headerGlyph}>●</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.hero}><Text style={styles.eyebrow}>PLAN YOUR NEXT ESCAPE</Text><Text accessibilityRole="header" style={styles.heroTitle}>Where do you want to stay?</Text><Text style={styles.heroCaption}>Explore hotel listings and current availability.</Text><Pressable accessibilityRole="button" onPress={() => openSearch()} style={styles.search}><Text style={styles.searchMark}>⌕</Text><View><Text style={styles.searchTitle}>Search destinations and hotels</Text><Text style={styles.searchCaption}>City, hotel, or address</Text></View></Pressable><View style={styles.tripDetails}><TripDetail label="CHECK-IN" /><TripDetail label="CHECK-OUT" /><TripDetail label="GUESTS" value="2 guests" /><TripDetail label="ROOMS" value="1 room" /></View><Button title="Search Hotels" onPress={() => openSearch()} fullWidth /><Text style={styles.tripNote}>Date selection and booking are coming in a later phase.</Text></View>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Popular Destinations</Text><Text style={styles.sectionCaption}>Destinations with active hotel listings</Text></View></View>
        {error ? <ErrorView message={error} onRetry={load} /> : null}
        {loading ? <Loader label="Loading travel options" /> : destinations.length ? <FlatList horizontal data={destinations} keyExtractor={(place) => place} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinations} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => openSearch(item)} style={({ pressed }) => [styles.destination, pressed && styles.pressed]}><Text style={styles.destinationMark}>⌖</Text><Text style={styles.destinationName}>{item}</Text><Text style={styles.destinationLink}>Explore stays →</Text></Pressable>} /> : <EmptyState title="Destinations will appear here" description="There are no active hotel destinations yet." />}
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Featured stays</Text><Text style={styles.sectionCaption}>Active hotels selected by our team</Text></View></View>
        {!loading && !error ? hotels.length ? <FlatList horizontal data={hotels} keyExtractor={(hotel) => hotel.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredList} renderItem={({ item: hotel }) => <View style={styles.featuredCard}><HotelCard hotel={hotel} badge="FEATURED" onPress={() => router.push({ pathname: '/(customer)/hotel/[id]', params: { id: hotel.id } })} /></View>} /> : <EmptyState title="No featured hotels yet" description="New featured stays will appear here when available." /> : null}
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Special offers</Text></View></View>
        <EmptyState title="No offers available" description="Offer data is not available from the current hotel API." />
        <View style={styles.infoCard}><Text style={styles.infoTitle}>Why book with TrumiTrip?</Text><Text style={styles.infoBody}>Browse live hotel listings and review stay details before booking.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TripDetail({ label, value = 'Add details' }: { label: string; value?: string }) {
  return <View style={styles.tripDetail}><Text style={styles.tripLabel}>{label}</Text><Text style={styles.tripValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxxlarge }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.small }, brand: { color: colors.primary, fontWeight: '800', fontSize: 22 }, kicker: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 3 }, profile: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, headerGlyph: { color: colors.accent, fontSize: 22 }, hero: { backgroundColor: colors.primary, padding: spacing.large, borderRadius: radii.large, gap: spacing.small }, eyebrow: { color: '#E5CF9B', fontWeight: '800', fontSize: 10, letterSpacing: 1 }, heroTitle: { color: colors.surface, fontSize: 28, lineHeight: 34, fontWeight: '800' }, heroCaption: { color: '#D7DEE7', fontSize: 13 }, search: { backgroundColor: colors.surface, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.small, paddingHorizontal: spacing.medium, borderRadius: radii.medium, marginTop: spacing.small }, searchMark: { color: colors.accent, fontSize: 29 }, searchTitle: { color: colors.text, fontSize: 14, fontWeight: '700' }, searchCaption: { color: colors.muted, fontSize: 12, marginTop: 3 }, tripDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xsmall }, tripDetail: { width: '48%', gap: 3, paddingVertical: spacing.xsmall }, tripLabel: { color: '#AEBACA', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }, tripValue: { color: colors.surface, fontSize: 12, fontWeight: '600' }, tripNote: { color: '#D7DEE7', fontSize: 11 }, sectionHeader: { marginTop: spacing.small }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' }, sectionCaption: { color: colors.muted, fontSize: 12, marginTop: 4 }, destinations: { gap: spacing.small }, destination: { width: 160, padding: spacing.medium, borderRadius: radii.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.small }, destinationMark: { color: colors.accent, fontSize: 25 }, destinationName: { color: colors.text, fontSize: 15, fontWeight: '800' }, destinationLink: { color: colors.primary, fontSize: 11, fontWeight: '700' }, featuredList: { gap: spacing.small }, featuredCard: { width: 300 }, infoCard: { padding: spacing.medium, borderRadius: radii.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, infoTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, infoBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xsmall }, pressed: { opacity: 0.82 } });
