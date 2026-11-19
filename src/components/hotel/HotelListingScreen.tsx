import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { HotelCard } from '@/components/hotel/HotelCard';
import { FilterSheet } from '@/components/hotel/FilterSheet';
import { HotelFilters } from '@/components/hotel/HotelFilters';
import { Badge } from '@/components/common/Badge';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getAdminHotels, getHotels, getPartnerHotels, updateAdminHotelFeatured, updateAdminHotelStatus, updatePartnerHotelStatus } from '@/services/api/hotelApi';
import { hotelErrorMessage } from '@/utils/hotelErrors';
import type { Hotel, HotelQuery } from '@/types/hotel';

type Mode = 'customer' | 'partner' | 'admin';
type Props = { mode: Mode };
const sorts: NonNullable<HotelQuery['sort']>[] = ['popular', 'price_asc', 'price_desc', 'rating', 'newest'];

export function HotelListingScreen({ mode }: Props) {
  const params = useLocalSearchParams<{ search?: string; destination?: string }>();
  const [search, setSearch] = useState(params.search ?? '');
  const [searchDraft, setSearchDraft] = useState(params.search ?? '');
  const [destination, setDestination] = useState(params.destination ?? '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [stars, setStars] = useState('');
  const [amenities, setAmenities] = useState('');
  const [filterDraft, setFilterDraft] = useState({ destination: '', minPrice: '', maxPrice: '', starRating: '', amenities: '' });
  const [sortIndex, setSortIndex] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo<HotelQuery>(() => ({
    search: search.trim() || undefined,
    destination: destination.trim() || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    starRating: stars ? Number(stars) : undefined,
    amenities: amenities.split(',').map((value) => value.trim()).filter(Boolean),
    sort: sorts[sortIndex],
    page: 1,
    limit: 10,
  }), [amenities, destination, maxPrice, minPrice, search, sortIndex, stars]);

  const load = useCallback(async (reset = true) => {
    setError(null);
    if (reset) { setLoading(true); setHotels([]); setTotal(0); pageRef.current = 1; }
    else setLoadingMore(true);
    try {
      const result = mode === 'partner'
        ? await getPartnerHotels({ ...query, page: reset ? 1 : pageRef.current + 1 })
        : mode === 'admin'
          ? await getAdminHotels({ ...query, page: reset ? 1 : pageRef.current + 1 })
          : await getHotels({ ...query, page: reset ? 1 : pageRef.current + 1 });
      setHotels((current) => reset ? result.items : [...current, ...result.items]);
      pageRef.current = result.pagination.page;
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (loadError) {
      setError(hotelErrorMessage(loadError, mode === 'customer' ? 'customer' : 'management'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [mode, query]);

  useEffect(() => { void load(true); }, [load]);
  const onRefresh = () => { setRefreshing(true); void load(true); };
  const title = mode === 'partner' ? 'Your hotels' : mode === 'admin' ? 'Hotel management' : 'Hotels';

  const updateHotel = async (hotel: Hotel, action: 'active' | 'featured') => {
    try {
      const updated = action === 'featured'
        ? await updateAdminHotelFeatured(hotel.id, !hotel.isFeatured)
        : mode === 'partner'
          ? await updatePartnerHotelStatus(hotel.id, false)
          : await updateAdminHotelStatus(hotel.id, !hotel.isActive);
      setHotels((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (updateError) {
      setError(hotelErrorMessage(updateError, 'management'));
    }
  };

  const renderHotel = ({ item }: { item: Hotel }) => (
    <View style={styles.hotelItem}>
      {mode !== 'customer' ? <View style={styles.badges}><Badge label={item.isActive ? 'Active' : 'Inactive'} tone={item.isActive ? 'success' : 'neutral'} />{item.isFeatured ? <Badge label="Featured" tone="gold" /> : null}</View> : null}
      <HotelCard
        hotel={item}
        badge={item.isFeatured ? 'FEATURED' : undefined}
        onPress={() => mode === 'customer'
          ? router.push({ pathname: '/(customer)/hotel/[id]', params: { id: item.id } })
          : mode === 'partner'
            ? router.push({ pathname: '/(partner)/hotel/[id]', params: { id: item.id } })
            : router.push({ pathname: '/(admin)/hotel/[id]', params: { id: item.id } })}
      />
      {mode === 'partner' ? <Button title="Edit details" variant="outline" fullWidth onPress={() => router.push({ pathname: '/(partner)/hotel/[id]', params: { id: item.id } })} /> : null}
      {mode === 'partner' && item.isActive ? <Button title="Deactivate hotel" variant="danger" fullWidth onPress={() => void updateHotel(item, 'active')} /> : null}
      {mode === 'admin' ? <View style={styles.actions}><Button title={item.isActive ? 'Deactivate' : 'Activate'} variant={item.isActive ? 'outline' : 'primary'} onPress={() => void updateHotel(item, 'active')} /><Button title={item.isFeatured ? 'Unfeature' : 'Feature'} variant="secondary" disabled={!item.isActive && !item.isFeatured} onPress={() => void updateHotel(item, 'featured')} /></View> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{mode === 'customer' ? 'Find a stay that fits your trip' : 'Manage hotel listings from your account'}</Text></View>{mode === 'partner' ? <Button title="Add hotel" size="small" onPress={() => router.push('/(partner)/hotel/create')} /> : null}</View>
      <View style={styles.searchBox}><Input label="Search hotels" accessibilityLabel="Search hotels by name or location" value={searchDraft} onChangeText={setSearchDraft} placeholder="Name, city, or address" returnKeyType="search" onSubmitEditing={() => setSearch(searchDraft.trim())} /><View style={styles.searchActions}><Button title="Search" onPress={() => setSearch(searchDraft.trim())} /><Button title="Filters" variant="outline" onPress={() => { setFilterDraft({ destination, minPrice, maxPrice, starRating: stars, amenities }); setFilterOpen(true); }} /></View></View>
      <View style={styles.resultBar}><Text style={styles.sortText}>{total} {total === 1 ? 'hotel' : 'hotels'}</Text><Pressable accessibilityRole="button" onPress={() => setSortIndex((index) => (index + 1) % sorts.length)} style={styles.sortPress}><Text style={styles.sortText}>Sort: {sorts[sortIndex].replace('_', ' ')}</Text><Text style={styles.sortAction}>Change</Text></Pressable></View>
      {error ? <ErrorView message={error} onRetry={() => void load(true)} /> : null}
      {loading ? <Loader label="Loading hotels" /> : hotels.length === 0 && !error ? <EmptyState title="No hotels found" description="Try adjusting your search or filters." /> : null}
      {!loading && hotels.length ? <FlatList
        data={hotels}
        keyExtractor={(hotel) => hotel.id}
        renderItem={renderHotel}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => { if (page < totalPages && !loading && !loadingMore) void load(false); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={page < totalPages ? <Button title={loadingMore ? 'Loading…' : 'Load more'} variant="outline" fullWidth disabled={loadingMore} onPress={() => void load(false)} /> : null}
      /> : null}
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={() => { setDestination(filterDraft.destination); setMinPrice(filterDraft.minPrice); setMaxPrice(filterDraft.maxPrice); setStars(filterDraft.starRating); setAmenities(filterDraft.amenities); setFilterOpen(false); }} onReset={() => { const reset = { destination: '', minPrice: '', maxPrice: '', starRating: '', amenities: '' }; setFilterDraft(reset); setDestination(''); setMinPrice(''); setMaxPrice(''); setStars(''); setAmenities(''); }}>
        <HotelFilters values={filterDraft} onChange={setFilterDraft} />
      </FilterSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.small, padding: spacing.medium },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  searchBox: { gap: spacing.small, paddingHorizontal: spacing.medium },
  searchActions: { flexDirection: 'row', gap: spacing.small },
  resultBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.medium, paddingVertical: spacing.small },
  sortPress: { flexDirection: 'row', alignItems: 'center', gap: spacing.xsmall },
  sortText: { color: colors.text, textTransform: 'capitalize', fontSize: 13 },
  sortAction: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  list: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxxlarge },
  hotelItem: { gap: spacing.xsmall },
  badges: { flexDirection: 'row', gap: spacing.xsmall },
  actions: { flexDirection: 'row', gap: spacing.small },
});
