import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import type { Hotel } from '@/types/hotel';

type FilterCategory = 'All' | 'Luxury' | 'Budget' | '5 Star' | '4 Star' | '3 Star';

const FILTER_CATEGORIES: FilterCategory[] = [
  'All',
  'Luxury',
  'Budget',
  '5 Star',
  '4 Star',
  '3 Star',
];


type FeaturedHotelsProps = {
  hotels?: Hotel[];
  isLoading?: boolean;
  onHotelPress: (hotelId: string) => void;
  onFilterPress: () => void;
  onFavoriteToggle?: (hotelId: string, isFav: boolean) => void;
};

export function FeaturedHotels({
  hotels = [],
  isLoading = false,
  onHotelPress,
  onFilterPress,
  onFavoriteToggle,
}: FeaturedHotelsProps) {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('All');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  // Merge loaded hotels with fallbacks to ensure rich coverage across all tiers
 // Display only hotels received from the Featured Hotels API.
const combinedHotels: Partial<Hotel>[] = hotels.filter(
  (hotel) => hotel.isActive !== false
);

  // Filter strictly based on selected category chip
  const filteredHotels = combinedHotels.filter((hotel) => {
    const star = hotel.starRating ?? 4;
    const price = Number(hotel.pricePerNight ?? 0);

    switch (selectedCategory) {
      case 'Luxury':
        // 5-star luxury resorts, or premier 4-star properties with higher rate
        return star >= 5 || (star === 4 && (price >= 200 || price >= 5000));
      case 'Budget':
        // 3-star or lower stays, or affordable stays under budget price threshold (strictly excluding 5-star)
        return (star <= 3 || (star === 4 && (price <= 100 || (price > 500 && price <= 2500)))) && star < 5;
      case '5 Star':
        return star === 5;
      case '4 Star':
        return star === 4;
      case '3 Star':
        return star === 3;
      case 'All':
      default:
        return true;
    }
  });

  const toggleFavorite = (id?: string) => {
    if (!id) return;
    const newState = !favorites[id];
    setFavorites((prev) => ({ ...prev, [id]: newState }));
    onFavoriteToggle?.(id, newState);
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Top Luxury & Budget Stays</Text>
          <Text style={styles.subtitle}>
            Verified accommodations hand-picked for your travel comfort
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter hotels"
          style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]}
          onPress={onFilterPress}>
          <Ionicons name="options-outline" size={16} color="#07172F" />
          <Text style={styles.filterBtnText}>Filters</Text>
        </Pressable>
      </View>

      {/* Filter Categories Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}>
        {FILTER_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <Pressable
              key={cat}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${cat}`}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setSelectedCategory(cat)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Hotel Cards List */}
      <View style={styles.list}>
        {filteredHotels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bed-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No stays in {selectedCategory}</Text>
            <Text style={styles.emptySubtitle}>
              Try browsing all accommodations or check other categories.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show all stays"
              style={({ pressed }) => [
                styles.emptyResetBtn,
                pressed && styles.emptyResetBtnPressed,
              ]}
              onPress={() => setSelectedCategory('All')}>
              <Text style={styles.emptyResetText}>Show All Stays</Text>
            </Pressable>
          </View>
        ) : (
          filteredHotels.map((item, index) => {
            const hotelId = item.id || `hotel-${index}`;
            const isFav = !!favorites[hotelId];
            const price = Number(item.pricePerNight ?? 3999);
            const original = item.originalPrice ? Number(item.originalPrice) : null;
            const stars = item.starRating ?? 4;
            const ratingScore = item.ratingScore ? String(item.ratingScore) : '4.8';
            const reviews = item.reviewCount ?? 120;
            const location = [item.destination, item.city].filter(Boolean).join(', ') || 'India';
            const imageUri =
              item.mainImage ||
              'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=700&q=80';
            const amenities = (item.amenities || ['Free WiFi', 'Pool', 'Breakfast']).slice(0, 4);

            return (
              <View key={hotelId} style={styles.card}>
                {/* Hotel Image with Badges */}
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.hotelImage} />

                  {/* Badge (Luxury / Budget / Featured) */}
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badgeText}>
                      {stars === 5
                        ? '5-STAR LUXURY'
                        : stars <= 3
                        ? 'BUDGET STAY'
                        : item.isFeatured
                        ? 'FEATURED STAY'
                        : 'BEST VALUE'}
                    </Text>
                  </View>

                {/* Favorite Heart Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isFav ? 'Remove from favorites' : 'Save to favorites'}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.favBtn,
                    isFav && styles.favBtnActive,
                    pressed && styles.favBtnPressed,
                  ]}
                  onPress={() => toggleFavorite(hotelId)}>
                  <Ionicons
                    name={isFav ? 'heart' : 'heart-outline'}
                    size={18}
                    color={isFav ? '#EF4444' : '#07172F'}
                  />
                </Pressable>
              </View>

              {/* Hotel Details Body */}
              <View style={styles.detailsBody}>
                {/* Rating and Stars */}
                <View style={styles.ratingRow}>
                  <View style={styles.starsBox}>
                    <Text style={styles.starGlyphs}>{'★'.repeat(stars)}</Text>
                  </View>
                  <View style={styles.ratingScoreBox}>
                    <Ionicons name="star" size={12} color="#E5B83F" />
                    <Text style={styles.ratingScoreText}>{ratingScore}</Text>
                    <Text style={styles.reviewCountText}>({reviews})</Text>
                  </View>
                </View>

                {/* Hotel Name & Location */}
                <Text numberOfLines={1} style={styles.hotelName}>
                  {item.name}
                </Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#64748B" />
                  <Text numberOfLines={1} style={styles.locationText}>
                    {location}
                  </Text>
                </View>

                {/* Amenities Chips */}
                <View style={styles.amenitiesRow}>
                  {amenities.map((amenity, idx) => (
                    <View key={idx} style={styles.amenityPill}>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>

                {/* Pricing & CTA Row */}
                <View style={styles.footerRow}>
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceAmount}>₹{price.toLocaleString('en-IN')}</Text>
                    {original && original > price ? (
                      <Text style={styles.originalPrice}>₹{original.toLocaleString('en-IN')}</Text>
                    ) : null}
                    <Text style={styles.nightLabel}>/ night</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${item.name}`}
                    style={({ pressed }) => [
                      styles.viewDetailsBtn,
                      pressed && styles.viewDetailsBtnPressed,
                    ]}
                    onPress={() => onHotelPress(hotelId)}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Ionicons name="arrow-forward" size={14} color="#07172F" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: '#07172F',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterBtnPressed: {
    backgroundColor: '#F1F5F9',
  },
  filterBtnText: {
    color: '#07172F',
    fontSize: 12,
    fontWeight: '800',
  },
  chipsContainer: {
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#07172F',
    borderColor: '#07172F',
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#E5B83F',
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#07172F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    position: 'relative',
    height: 190,
    width: '100%',
    backgroundColor: '#07172F',
  },
  hotelImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badgeWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(7, 23, 47, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#E5B83F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  favBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  favBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  favBtnPressed: {
    opacity: 0.8,
  },
  detailsBody: {
    padding: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  starsBox: {
    flexDirection: 'row',
  },
  starGlyphs: {
    color: '#E5B83F',
    fontSize: 13,
    letterSpacing: 1,
  },
  ratingScoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScoreText: {
    color: '#07172F',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewCountText: {
    color: '#64748B',
    fontSize: 12,
  },
  hotelName: {
    color: '#07172F',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 12,
  },
  amenityPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  amenityText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceAmount: {
    color: '#07172F',
    fontSize: 19,
    fontWeight: '900',
  },
  originalPrice: {
    color: '#94A3B8',
    fontSize: 13,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  nightLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  viewDetailsBtn: {
    backgroundColor: '#E5B83F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#E5B83F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  viewDetailsBtnPressed: {
    backgroundColor: '#D4A62C',
  },
  viewDetailsText: {
    color: '#07172F',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyTitle: {
    color: '#07172F',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    maxWidth: 260,
  },
  emptyResetBtn: {
    backgroundColor: '#07172F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyResetBtnPressed: {
    opacity: 0.85,
  },
  emptyResetText: {
    color: '#E5B83F',
    fontSize: 13,
    fontWeight: '800',
  },
});
