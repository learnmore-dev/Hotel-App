import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FeatureItem = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
};

const FEATURES: FeatureItem[] = [
  {
    id: 'best-price',
    title: 'Best Price Guarantee',
    description: 'Get guaranteed lowest hotel rates with zero hidden charges or fees.',
    icon: 'pricetag',
    iconColor: '#D97706',
    bgColor: '#FEF3C7',
  },
  {
    id: 'secure-booking',
    title: '100% Secure Booking',
    description: 'Bank-grade 256-bit SSL encryption & instant digital voucher confirmation.',
    icon: 'shield-checkmark',
    iconColor: '#059669',
    bgColor: '#D1FAE5',
  },
  {
    id: 'support-24-7',
    title: '24/7 VIP Concierge',
    description: 'Dedicated round-the-clock travel assistance anytime, anywhere you stay.',
    icon: 'headset',
    iconColor: '#2563EB',
    bgColor: '#DBEAFE',
  },
  {
    id: 'free-cancellation',
    title: 'Free Cancellation',
    description: 'Flexible refund and modification policies on thousands of curated hotels.',
    icon: 'calendar',
    iconColor: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  {
    id: 'trusted-millions',
    title: 'Trusted By Millions',
    description: 'Over 10 million satisfied travelers booking stays with 4.9★ satisfaction.',
    icon: 'star',
    iconColor: '#EA580C',
    bgColor: '#FFEDD5',
  },
  {
    id: 'member-deals',
    title: 'Exclusive Member Deals',
    description: 'Unlock secret rates and extra discounts up to 30% on top luxury suites.',
    icon: 'sparkles',
    iconColor: '#0891B2',
    bgColor: '#CFFAFE',
  },
];

export function WhyBookWithUs() {
  return (
    <View style={styles.container}>
      <View style={styles.headerGroup}>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>THE TRUMITRIP PROMISE</Text>
        </View>
        <Text style={styles.sectionTitle}>Why Book With Us?</Text>
        <Text style={styles.sectionSubtitle}>
          Experience unparalleled comfort, security, and world-class luxury on every getaway.
        </Text>
      </View>

      <View style={styles.grid}>
        {FEATURES.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon} size={22} color={item.iconColor} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
  },
  headerGroup: {
    marginBottom: 20,
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: 'rgba(229, 184, 63, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgePillText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionTitle: {
    color: '#07172F',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sectionSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: '90%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#07172F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#07172F',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  cardDescription: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
});
