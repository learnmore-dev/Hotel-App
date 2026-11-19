
import {
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PopularDestinationsProps = {
  destinations: string[];
  onSelectDestination: (destinationName: string) => void;
  onViewAll: () => void;
};

const DESTINATION_IMAGES: Record<string, string> = {
  andheri:
    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80',
  'south beach':
    'https://images.unsplash.com/photo-1535498730771-e735b998cd64?auto=format&fit=crop&w=600&q=80',
  amer:
    'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=600&q=80',
  'rocky mountains':
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
  manhattan:
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80',
  whitefield:
    'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=600&q=80',
  candolim:
    'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80',
};

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80';

export function PopularDestinations({
  destinations,
  onSelectDestination,
  onViewAll,
}: PopularDestinationsProps) {
  const destinationItems = destinations.map((name) => ({
    id: name,
    name,
    imageUri:
      DESTINATION_IMAGES[name.trim().toLowerCase()] ?? DEFAULT_IMAGE,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.title}>Popular Destinations</Text>
          <Text style={styles.subtitle}>
            Explore places with available hotel stays
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all destinations"
          onPress={onViewAll}
          style={({ pressed }) => [
            styles.viewAllBtn,
            pressed && styles.viewAllBtnPressed,
          ]}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="arrow-forward" size={14} color="#D97706" />
        </Pressable>
      </View>

      {destinationItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Destinations will appear here when hotels are available.
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={destinationItems}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Explore hotels in ${item.name}`}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectDestination(item.name)}>
              <ImageBackground
                source={{ uri: item.imageUri }}
                style={styles.cardImageBg}
                imageStyle={styles.cardImage}>
                <View style={styles.cardOverlay}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>EXPLORE HOTELS</Text>
                  </View>

                  <View style={styles.infoBottom}>
                    <Text style={styles.destName}>{item.name}</Text>
                    <Text style={styles.destTag}>
                      Find your perfect stay
                    </Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  headerTextGroup: {
    flex: 1,
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
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllBtnPressed: {
    opacity: 0.7,
  },
  viewAllText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    width: 200,
    height: 260,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#07172F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: '#07172F',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardImageBg: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    borderRadius: 18,
  },
  cardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 23, 47, 0.45)',
    justifyContent: 'space-between',
    padding: 14,
  },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(7, 23, 47, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#E5B83F',
    fontSize: 10,
    fontWeight: '800',
  },
  infoBottom: {
    backgroundColor: 'rgba(7, 23, 47, 0.8)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  destName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  destTag: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
});
