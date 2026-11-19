import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { HotelImageGallery } from './HotelImageGallery';
import type { HotelImageSource } from './HotelImageGallery';
import { HotelRating } from './HotelRating';
import { HotelAmenities } from './HotelAmenities';
import type { Hotel } from '@/types/hotel';
import { formatCurrency } from '@/utils/currency';

type LegacyHotelCardProps = {
  hotel?: undefined;
  name: string;
  location: string;
  images: HotelImageSource[];
  rating: number;
  reviewCount?: number;
  price: number;
  currency: string;
  priceCaption?: string;
  originalPrice?: number;
  starRating?: number;
  amenities?: string[];
  badge?: string;
  favorite?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  accessibilityLabel?: string;
};

type HotelDataCardProps = {
  hotel: Hotel;
  badge?: string;
  favorite?: boolean;
  onPress?: () => void;
  onFavoritePress?: () => void;
  accessibilityLabel?: string;
};

export type HotelCardProps = LegacyHotelCardProps | HotelDataCardProps;

export function HotelCard(props: HotelCardProps) {
  const { badge, favorite = false, onPress, onFavoritePress, accessibilityLabel } = props;
  const hotel = props.hotel;
  const legacy = 'location' in props ? props : undefined;
  const name = hotel?.name ?? legacy?.name ?? 'Hotel';
  const location = hotel ? [hotel.destination, hotel.city].filter(Boolean).join(', ') : legacy?.location ?? '';
  const images = hotel
    ? [hotel.mainImage, ...hotel.galleryImages].filter((uri): uri is string => Boolean(uri)).map((uri, index) => ({ uri, alt: `${hotel.name} photo ${index + 1}` }))
    : legacy?.images ?? [];
  const rating = hotel ? Number(hotel.ratingScore ?? 0) : legacy?.rating ?? 0;
  const reviewCount = hotel?.reviewCount ?? legacy?.reviewCount;
  const price = hotel ? Number(hotel.pricePerNight) : legacy?.price ?? 0;
  const currency = hotel ? '' : legacy?.currency ?? '';
  const priceCaption = legacy?.priceCaption ?? 'per night';
  const originalPrice = hotel?.originalPrice ? Number(hotel.originalPrice) : legacy?.originalPrice;
  const starRating = hotel?.starRating ?? legacy?.starRating;
  const amenities = hotel?.amenities ?? legacy?.amenities ?? [];
  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel ?? `${name}, ${location}`} padding="small">
      <View style={styles.imageWrap}>
        <HotelImageGallery images={images} height={196} accessibilityLabel={`${name} photos`} />
        {badge ? <View style={styles.badge}><Badge label={badge} tone="gold" /></View> : null}
        {onFavoritePress ? (
          <View style={styles.favorite}>
            <IconButton
              icon={<Text style={[styles.heart, favorite && styles.heartSelected]}>{favorite ? '♥' : '♡'}</Text>}
              accessibilityLabel={favorite ? 'Remove from saved hotels' : 'Save hotel'}
              onPress={onFavoritePress}
              variant="surface"
              size={40}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.details}>
        <View style={styles.titleRow}>
          <View style={styles.nameBlock}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <Text numberOfLines={1} style={styles.location}>{location}</Text>
          </View>
          <View style={styles.ratingBlock}>{starRating ? <Text style={styles.stars}>{'★'.repeat(starRating)}</Text> : null}{rating > 0 ? <HotelRating rating={rating} reviewCount={reviewCount} /> : <Text style={styles.unrated}>New</Text>}</View>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(price, { currency: currency || undefined, minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
          {originalPrice && originalPrice > price ? <Text style={styles.originalPrice}>{formatCurrency(originalPrice, { currency: currency || undefined, minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text> : null}
          <Text style={styles.caption}>{priceCaption}</Text>
        </View>
        {amenities.length ? <HotelAmenities amenities={amenities.slice(0, 4).map((label) => ({ id: label, label }))} compact /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  imageWrap: { position: 'relative' },
  badge: { position: 'absolute', top: spacing.small, left: spacing.small },
  favorite: { position: 'absolute', top: spacing.small, right: spacing.small },
  heart: { color: colors.text, fontSize: 22, lineHeight: 26 },
  heartSelected: { color: colors.error },
  details: { paddingTop: spacing.medium, gap: spacing.medium },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.small },
  nameBlock: { flex: 1, minWidth: 0, gap: spacing.xxxsmall },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  location: { color: colors.muted, fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxsmall },
  price: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  originalPrice: { color: colors.muted, fontSize: 13, textDecorationLine: 'line-through' },
  ratingBlock: { alignItems: 'flex-end', gap: spacing.xxxsmall },
  stars: { color: colors.accent, fontSize: 11, letterSpacing: 1 },
  unrated: { color: colors.muted, fontSize: 12 },
  caption: { color: colors.muted, fontSize: 13 },
});
