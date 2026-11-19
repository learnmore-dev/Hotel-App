import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type HeroBannerProps = {
  title?: string;
  subtitle?: string;
};

const HERO_IMAGE_URI =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';

export function HeroBanner({
  title = 'Find the Perfect Stay',
  subtitle = 'Book domestic and international hotels at best prices guaranteed!',
}: HeroBannerProps) {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: HERO_IMAGE_URI }}
        style={styles.imageBackground}
        imageStyle={styles.image}>
        {/* Dark luxury gradient overlay */}
        <View style={styles.overlay}>
          {/* Eyebrow badge */}
          <View style={styles.eyebrowBadge}>
            <Ionicons name="sparkles" size={12} color="#E5B83F" />
            <Text style={styles.eyebrowText}>LUXURY HOTEL BOOKING PORTAL</Text>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>
            {title}
            {'\n'}
            <Text style={styles.headingGold}>for Your Next Trip</Text>
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Trust points */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark" size={13} color="#E5B83F" />
              <Text style={styles.trustText}>Best Price Guarantee</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="card" size={13} color="#E5B83F" />
              <Text style={styles.trustText}>Instant Confirmation</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="headset" size={13} color="#E5B83F" />
              <Text style={styles.trustText}>24/7 Support</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#07172F',
  },
  imageBackground: {
    width: '100%',
    minHeight: 280,
    justifyContent: 'center',
  },
  image: {
    opacity: 0.38,
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 23, 47, 0.72)',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    justifyContent: 'center',
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229, 184, 63, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 12,
  },
  eyebrowText: {
    color: '#E5B83F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headingGold: {
    color: '#E5B83F',
  },
  subtitle: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: '92%',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
});
