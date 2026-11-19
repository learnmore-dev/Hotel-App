import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/ErrorView';
import { Loader } from '@/components/common/Loader';
import { HotelImageGallery } from '@/components/hotel/HotelImageGallery';
import { HotelAmenities } from '@/components/hotel/HotelAmenities';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { getAdminHotel, updateAdminHotelStatus, updateAdminHotelFeatured } from '@/services/api/hotelApi';
import { hotelErrorMessage } from '@/utils/hotelErrors';
import type { Hotel } from '@/types/hotel';

export function AdminHotelDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = () => { if (!id) return; setLoading(true); setError(null); getAdminHotel(id).then(setHotel).catch((reason: unknown) => setError(hotelErrorMessage(reason, 'management'))).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [id]);
  const mutate = async (kind: 'active' | 'featured') => {
    if (!hotel) return;
    setSaving(true); setError(null);
    try { setHotel(kind === 'active' ? await updateAdminHotelStatus(hotel.id, !hotel.isActive) : await updateAdminHotelFeatured(hotel.id, !hotel.isFeatured)); }
    catch (reason) { setError(hotelErrorMessage(reason, 'management')); }
    finally { setSaving(false); }
  };
  if (loading) return <Loader label="Loading hotel" fullScreen />;
  if (!hotel) return <SafeAreaView style={styles.safe}><ErrorView message={error ?? 'Hotel not found'} onRetry={load} /></SafeAreaView>;
  const imageUris = [hotel.mainImage, ...hotel.galleryImages].filter((uri): uri is string => Boolean(uri));
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    {error ? <ErrorView message={error} /> : null}
    <HotelImageGallery images={imageUris.map((uri, index) => ({ uri, alt: `${hotel.name} photo ${index + 1}` }))} />
    <Text accessibilityRole="header" style={styles.title}>{hotel.name}</Text><Text style={styles.copy}>{hotel.address}, {hotel.city}</Text><Text style={styles.copy}>Partner: {hotel.partner.businessName}</Text>
    <Badge label={hotel.isActive ? 'Active' : 'Inactive'} tone={hotel.isActive ? 'success' : 'neutral'} />
    <Text style={styles.copy}>{hotel.description ?? 'No description provided.'}</Text>
    <Text style={styles.copy}>{Number(hotel.pricePerNight).toLocaleString()} per night</Text>
    <Text style={styles.roomHeading}>Rooms ({hotel.rooms?.length ?? 0})</Text>
    {hotel.rooms?.map((room) => <Text key={room.id} style={styles.copy}>{room.roomType} · {room.maxGuests} guests · {Number(room.pricePerNight).toLocaleString()} / night</Text>)}
    {hotel.amenities.length ? <HotelAmenities amenities={hotel.amenities.map((label) => ({ id: label, label }))} /> : null}
    <Button title={hotel.isActive ? 'Deactivate hotel' : 'Activate hotel'} variant={hotel.isActive ? 'danger' : 'primary'} onPress={() => void mutate('active')} loading={saving} fullWidth />
    <Button title={hotel.isFeatured ? 'Remove featured status' : 'Feature hotel'} variant="secondary" onPress={() => void mutate('featured')} disabled={saving || (!hotel.isActive && !hotel.isFeatured)} fullWidth />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.medium, gap: spacing.medium, paddingBottom: spacing.xxxlarge }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, roomHeading: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.small }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21 } });
