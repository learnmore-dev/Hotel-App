import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type HomeFooterProps = {
  onNavigateToOffers?: () => void;
  onNavigateToDestinations?: () => void;
};

export function HomeFooter({
  onNavigateToOffers,
  onNavigateToDestinations,
}: HomeFooterProps) {
  const router = useRouter();

  return (
    <View style={styles.footerContainer}>
      {/* Brand Identity */}
      <View style={styles.brandGroup}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>T</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>TRUMITRIP</Text>
            <Text style={styles.brandTagline}>EXPLORE MORE. EXPERIENCE BEYOND...</Text>
          </View>
        </View>

        <Text style={styles.brandDescription}>
          TrumiTrip is premier luxury hotel-booking technology crafted for seamless escapes.
          Discover handpicked 5-star resorts, heritage palaces, and coastal retreats with best
          rates guaranteed.
        </Text>
      </View>

      {/* Quick Navigation Links */}
      <View style={styles.linksSection}>
        <Text style={styles.linksHeader}>QUICK NAVIGATION</Text>
        <View style={styles.linksGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore Destinations"
            style={styles.linkItem}
            onPress={() => {
              if (onNavigateToDestinations) onNavigateToDestinations();
              else router.push('/(customer)/search');
            }}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>Popular Destinations</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search Hotels"
            style={styles.linkItem}
            onPress={() => router.push('/(customer)/search')}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>Luxury Hotel Stays</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Special Deals & Offers"
            style={styles.linkItem}
            onPress={() => {
              if (onNavigateToOffers) onNavigateToOffers();
              else router.push('/(customer)/search');
            }}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>Exclusive Offers & Deals</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage Bookings"
            style={styles.linkItem}
            onPress={() => router.push('/(customer)/bookings')}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>Manage Bookings</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="List Your Property as Partner"
            style={styles.linkItem}
            onPress={() => router.push('/(partner)/dashboard')}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>Partner Property Portal</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="24/7 Concierge Support"
            style={styles.linkItem}
            onPress={() => router.push('/(customer)/support')}>
            <Ionicons name="chevron-forward" size={12} color="#E5B83F" />
            <Text style={styles.linkText}>24/7 Concierge Support</Text>
          </Pressable>
        </View>
      </View>

      {/* Customer Concierge Contacts */}
      <View style={styles.contactCard}>
        <Text style={styles.contactHeader}>24/7 TRAVEL CONCIERGE</Text>
        <View style={styles.contactItem}>
          <Ionicons name="call" size={16} color="#E5B83F" />
          <Text style={styles.contactValue}>1800-TRUMI-TRIP (Toll-Free)</Text>
        </View>
        <View style={styles.contactItem}>
          <Ionicons name="mail" size={16} color="#E5B83F" />
          <Text style={styles.contactValue}>support@trumitrip.com</Text>
        </View>
        <View style={styles.contactItem}>
          <Ionicons name="location" size={16} color="#E5B83F" />
          <Text style={styles.contactValue}>
            TrumiTrip Hospitality HQ, Bengaluru, India
          </Text>
        </View>
      </View>

      {/* Social Badges */}
      <View style={styles.socialRow}>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-instagram" size={18} color="#E5B83F" />
        </View>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-facebook" size={18} color="#E5B83F" />
        </View>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-twitter" size={18} color="#E5B83F" />
        </View>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-linkedin" size={18} color="#E5B83F" />
        </View>
      </View>

      {/* Copyright */}
      <View style={styles.bottomLegal}>
        <Text style={styles.complianceText}>
          ISO 27001 Certified · PCI-DSS Compliant · Bank-Grade Encryption
        </Text>
        <Text style={styles.copyrightText}>
          © 2026 TRUMITRIP Hospitality Services Private Limited. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    backgroundColor: '#07172F',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 184, 63, 0.25)',
  },
  brandGroup: {
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5B83F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#07172F',
    fontSize: 20,
    fontWeight: '900',
  },
  brandTitle: {
    color: '#E5B83F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandTagline: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  linksSection: {
    marginBottom: 24,
  },
  linksHeader: {
    color: '#E5B83F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  linksGrid: {
    gap: 10,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  linkText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  contactCard: {
    backgroundColor: '#10243D',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  contactHeader: {
    color: '#E5B83F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  contactValue: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  socialCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLegal: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  complianceText: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 6,
  },
  copyrightText: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
  },
});
