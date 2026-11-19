import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import type { Offer } from '@/types/coupon';

export type OfferItem = {
  id: string;
  code: string;
  badge: string;
  badgeTone?: 'gold' | 'blue' | 'purple' | 'green';
  title: string;
  description: string;
  discountSummary: string;
  minBooking?: string;
  validUntil?: string;
};

const DEFAULT_OFFERS: OfferItem[] = [
  {
    id: 'offer-1',
    code: 'LUXURY25',
    badge: 'EXCLUSIVE',
    badgeTone: 'gold',
    title: 'Flat 25% Off Luxury Suites',
    description: 'Valid on handpicked 5-Star resorts and presidential suites worldwide.',
    discountSummary: 'Save up to ₹5,000',
    minBooking: 'Min. booking ₹12,000',
    validUntil: 'Expires 30 Nov 2026',
  },
  {
    id: 'offer-2',
    code: 'TRUMI10',
    badge: 'POPULAR',
    badgeTone: 'blue',
    title: '10% Instant Savings',
    description: 'Applicable on all domestic and international hotel reservations.',
    discountSummary: 'Up to ₹1,500 off',
    minBooking: 'No min. booking',
    validUntil: 'Expires 31 Dec 2026',
  },
  {
    id: 'offer-3',
    code: 'WELCOME20',
    badge: 'NEW USER',
    badgeTone: 'green',
    title: 'Flat ₹2,000 Welcome Bonus',
    description: 'Welcome gift on your first completed booking with TrumiTrip.',
    discountSummary: 'Flat ₹2,000 Off',
    minBooking: 'Min. booking ₹6,000',
    validUntil: 'Limited time offer',
  },
  {
    id: 'offer-4',
    code: 'SUMMER20',
    badge: 'LIMITED TIME',
    badgeTone: 'purple',
    title: '20% Summer Escape',
    description: 'Escape to premier coastal, hill station and lake resorts.',
    discountSummary: 'Save up to ₹3,500',
    minBooking: 'Min. booking ₹8,000',
    validUntil: 'Valid this season',
  },
];

type OffersSectionProps = {
  activeOffers?: Offer[];
  onCodeCopied: (code: string) => void;
};

export function OffersSection({ activeOffers = [], onCodeCopied }: OffersSectionProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Map API offers into OfferItem format if available
  const displayOffers: OfferItem[] =
    activeOffers.length > 0
      ? activeOffers.map((o, idx) => ({
          id: o.id,
          code: o.code,
          badge: idx === 0 ? 'EXCLUSIVE' : idx === 1 ? 'POPULAR' : 'SPECIAL',
          badgeTone: (idx === 0 ? 'gold' : idx === 1 ? 'blue' : 'green') as OfferItem['badgeTone'],
          title: o.title || `Special Offer ${o.code}`,
          description: o.description || 'Exclusive savings on luxury hotel bookings.',
          discountSummary:
            o.discountType === 'PERCENTAGE'
              ? `${o.discountValue}% Off`
              : `Flat ₹${o.discountValue} Off`,
          minBooking:
            o.minimumBookingAmount > 0
              ? `Min. booking ₹${o.minimumBookingAmount}`
              : 'No minimum booking',
          validUntil: o.validUntil ? `Valid until ${o.validUntil.split('T')[0]}` : undefined,
        }))
      : DEFAULT_OFFERS;

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      onCodeCopied(code);
      setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
      }, 3000);
    } catch {
      // fallback
      onCodeCopied(code);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Ionicons name="gift" size={13} color="#D97706" />
          <Text style={styles.headerBadgeText}>PROMOTIONAL SAVINGS</Text>
        </View>
        <Text style={styles.title}>Exclusive Offers & Deals</Text>
        <Text style={styles.subtitle}>
          Save big on your next stay with verified member discount coupons
        </Text>
      </View>

      <FlatList
        horizontal
        data={displayOffers}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const isCopied = copiedCode === item.code;
          return (
            <View style={styles.offerCard}>
              {/* Badge & Discount */}
              <View style={styles.topRow}>
                <View
                  style={[
                    styles.badge,
                    item.badgeTone === 'gold' && styles.badgeGold,
                    item.badgeTone === 'blue' && styles.badgeBlue,
                    item.badgeTone === 'green' && styles.badgeGreen,
                    item.badgeTone === 'purple' && styles.badgePurple,
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      item.badgeTone === 'gold' && styles.badgeTextGold,
                      item.badgeTone === 'blue' && styles.badgeTextBlue,
                      item.badgeTone === 'green' && styles.badgeTextGreen,
                      item.badgeTone === 'purple' && styles.badgeTextPurple,
                    ]}>
                    {item.badge}
                  </Text>
                </View>
                <Text style={styles.discountValue}>{item.discountSummary}</Text>
              </View>

              {/* Title & Description */}
              <Text numberOfLines={1} style={styles.offerTitle}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={styles.offerDesc}>
                {item.description}
              </Text>

              {/* Terms */}
              <View style={styles.termsRow}>
                {item.minBooking ? (
                  <Text style={styles.termsText}>• {item.minBooking}</Text>
                ) : null}
                {item.validUntil ? (
                  <Text style={styles.termsText}>• {item.validUntil}</Text>
                ) : null}
              </View>

              {/* Coupon Box with Copy button */}
              <View style={styles.couponContainer}>
                <View style={styles.codeBox}>
                  <Ionicons name="pricetag" size={14} color="#E5B83F" />
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Copy coupon code ${item.code}`}
                  style={({ pressed }) => [
                    styles.copyBtn,
                    isCopied && styles.copyBtnSuccess,
                    pressed && styles.copyBtnPressed,
                  ]}
                  onPress={() => handleCopyCode(item.code)}>
                  <Ionicons
                    name={isCopied ? 'checkmark-circle' : 'copy-outline'}
                    size={14}
                    color={isCopied ? '#FFFFFF' : '#07172F'}
                  />
                  <Text
                    style={[styles.copyBtnText, isCopied && styles.copyBtnTextSuccess]}>
                    {isCopied ? 'Copied!' : 'Copy Code'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  headerBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
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
  listContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  offerCard: {
    width: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#07172F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  badgeGold: {
    backgroundColor: 'rgba(229, 184, 63, 0.2)',
  },
  badgeBlue: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgePurple: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#475569',
  },
  badgeTextGold: {
    color: '#B45309',
  },
  badgeTextBlue: {
    color: '#1D4ED8',
  },
  badgeTextGreen: {
    color: '#047857',
  },
  badgeTextPurple: {
    color: '#6D28D9',
  },
  discountValue: {
    color: '#07172F',
    fontSize: 14,
    fontWeight: '900',
  },
  offerTitle: {
    color: '#07172F',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  offerDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  termsRow: {
    marginVertical: 10,
    gap: 2,
  },
  termsText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  couponContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 6,
    paddingLeft: 10,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeText: {
    color: '#07172F',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  copyBtn: {
    backgroundColor: '#E5B83F',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnSuccess: {
    backgroundColor: '#10B981',
  },
  copyBtnPressed: {
    opacity: 0.8,
  },
  copyBtnText: {
    color: '#07172F',
    fontSize: 12,
    fontWeight: '800',
  },
  copyBtnTextSuccess: {
    color: '#FFFFFF',
  },
});
