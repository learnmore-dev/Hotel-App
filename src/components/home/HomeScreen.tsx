               import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeaturedHotels } from './FeaturedHotels';
import { HeroBanner } from './HeroBanner';
import { HomeDrawer } from './HomeDrawer';
import { HomeFooter } from './HomeFooter';
import { HomeHeader } from './HomeHeader';
import { HotelSearchCard, type SearchParams } from './HotelSearchCard';
import { OffersSection } from './OffersSection';
import { PlatformStatistics } from './PlatformStatistics';
import { PopularDestinations } from './PopularDestinations';
import { SecurePayments } from './SecurePayments';
import { ToastBanner } from './ToastBanner';
import { WhyBookWithUs } from './WhyBookWithUs';

import { getActiveOffers } from '@/services/api/couponApi';
import { getDestinations, getHotels } from '@/services/api/hotelApi';
import type { Offer } from '@/types/coupon';
import type { Hotel } from '@/types/hotel';

export function HomeScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  // Data states
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
  };

  const loadData = useCallback(async () => {
    try {
      const [hotelsRes, destsRes, offersRes] = await Promise.allSettled([
  getHotels({ limit: 20 }),
  getDestinations(),
  getActiveOffers(),
]);
      

   if (hotelsRes.status === 'fulfilled') {
  setHotels(hotelsRes.value.items);
} else {
  setHotels([]);
}
      if (destsRes.status === 'fulfilled') {
        setDestinations(destsRes.value);
      }

      if (offersRes.status === 'fulfilled') {
        setOffers(offersRes.value);
      }
    } catch {
      // Non-blocking catch
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = (params: SearchParams) => {
    router.push({
      pathname: '/(customer)/search',
      params: {
        destination: params.destination,
        search: params.destination,
      },
    });
  };

  const handleSelectDestination = (destinationName: string) => {
  router.push({
    pathname: '/(customer)/hotels',
    params: {
      destination: destinationName,
    },
  });
};

  const handleHotelPress = (hotelId: string) => {
    router.push({
      pathname: '/(customer)/hotel/[id]',
      params: { id: hotelId },
    });
  };

  const handleFilterPress = () => {
    router.push('/(customer)/search');
  };

  const handleCodeCopied = (code: string) => {
    showToast(`Coupon code "${code}" copied to clipboard!`, 'success');
  };

  const handleFavoriteToggle = (_hotelId: string, isFav: boolean) => {
    if (isFav) {
      showToast('Hotel added to saved favorites', 'info');
    } else {
      showToast('Hotel removed from saved favorites', 'info');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#07172F" />

      {/* Floating Toast Banner */}
      <ToastBanner
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastMessage(null)}
      />

      {/* Mobile Top Header */}
      <HomeHeader onOpenDrawer={() => setDrawerVisible(true)} />

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#E5B83F"
            colors={['#E5B83F', '#07172F']}
          />
        }>
        {/* 1. Hero Banner */}
        <HeroBanner />

        {/* 2. Floating Hotel Search Card */}
        <HotelSearchCard
          onSearch={handleSearch}
          availableDestinations={destinations}
        />

        {/* 3. Why Book With Us (6 features grid) */}
        <WhyBookWithUs />

        {/* 4. Platform Statistics (2x2 grid) */}
        <PlatformStatistics />

        {/* 5. Popular Destinations (Carousel) */}
       <PopularDestinations
  destinations={destinations}
  onSelectDestination={handleSelectDestination}
  onViewAll={() => router.push('/(customer)/hotels')}
/>

        {/* 6. Exclusive Offers & Deals */}
        <OffersSection
          activeOffers={offers}
          onCodeCopied={handleCodeCopied}
        />

        {/* 7. Top Luxury & Budget Hotels */}
        <FeaturedHotels
          hotels={hotels}
          isLoading={isLoading}
          onHotelPress={handleHotelPress}
          onFilterPress={handleFilterPress}
          onFavoriteToggle={handleFavoriteToggle}
        />

        {/* 8. 100% Secure Payments */}
        <SecurePayments />

        {/* 9. Mobile Footer */}
        <HomeFooter
          onNavigateToOffers={() => {
            showToast('Showing all active discount offers', 'info');
          }}
          onNavigateToDestinations={() => router.push('/(customer)/search')}
        />
      </ScrollView>

      {/* Slide Navigation Drawer */}
      <HomeDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigateToOffers={() => {
          showToast('Exclusive discount deals applied', 'info');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07172F',
  },
  scrollContent: {
    backgroundColor: '#F5F7FA',
    paddingBottom: 24,
  },
});
