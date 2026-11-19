import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { useAuthStore } from '@/store/authStore';
import { roleHome } from '@/utils/authNavigation';

export default function IndexScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const requiresReauth = useAuthStore((state) => state.requiresReauth);
  const role = useAuthStore((state) => state.user?.role);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    if (isAuthenticated && role) router.replace(roleHome(role));
    else if (requiresReauth) router.replace('/(auth)/login');
  }, [isAuthenticated, requiresReauth, role, router]);

  if ((isAuthenticated && role) || requiresReauth) return null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>T</Text>
          </View>
          <Text style={styles.brandCaption}>YOUR NEXT STAY, MADE SIMPLE</Text>
        </View>

        <Animated.View style={[styles.hero, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.orbitLarge} />
          <View style={styles.orbitSmall} />
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              TRUMITRIP
            </Text>
            <Text style={styles.subtitle}>Hotel booking made simple</Text>
            <Text style={styles.description}>
              Find a place that feels right, wherever the journey takes you.
            </Text>
          </View>
          <View style={styles.tripBadge}>
            <Text style={styles.tripBadgeIcon}>✦</Text>
            <Text style={styles.tripBadgeText}>A better stay starts here</Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <Button
            title="Explore Hotels & Resorts"
            fullWidth
            size="large"
            onPress={() => router.push('/(customer)/home' as Href)}
            rightIcon={<Text style={styles.buttonArrow}>→</Text>}
          />
          <Button
            title="Login to Account"
            fullWidth
            size="large"
            variant="outline"
            onPress={() => router.push('/(auth)/login' as Href)}
          />
          <Button
            title="Create Account"
            fullWidth
            size="large"
            variant="ghost"
            onPress={() => router.push('/(auth)/signup' as Href)}
          />
        </View>

        <Text style={styles.footer}>DISCOVER MORE. TRAVEL WELL.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.large,
    paddingTop: spacing.medium,
    paddingBottom: spacing.medium,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.medium,
    backgroundColor: colors.accent,
  },
  brandMarkText: { color: colors.primary, fontSize: 21, fontWeight: '800' },
  brandCaption: { color: '#D7DEE7', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  hero: {
    minHeight: 310,
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: spacing.large,
    padding: spacing.large,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 28,
    backgroundColor: '#1B3451',
  },
  orbitLarge: {
    position: 'absolute',
    top: -72,
    right: -55,
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: 'rgba(196,163,90,0.34)',
    backgroundColor: 'rgba(196,163,90,0.07)',
  },
  orbitSmall: {
    position: 'absolute',
    top: -25,
    right: -7,
    width: 135,
    height: 135,
    borderRadius: 68,
    borderWidth: 1,
    borderColor: 'rgba(196,163,90,0.4)',
  },
  heroCopy: { maxWidth: 360, gap: spacing.small },
  title: { color: colors.surface, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: 1.1 },
  subtitle: { color: '#F5E7C3', fontSize: 20, fontWeight: '600' },
  description: { maxWidth: 290, marginTop: spacing.xsmall, color: '#D7DEE7', fontSize: 15, lineHeight: 23 },
  tripBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    marginTop: spacing.large,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tripBadgeIcon: { color: colors.accent, fontSize: 16 },
  tripBadgeText: { color: colors.surface, fontSize: 12, fontWeight: '600' },
  actions: { gap: spacing.small },
  buttonArrow: { color: colors.surface, fontSize: 22, lineHeight: 24 },
  footer: { marginTop: spacing.medium, color: '#9DAABA', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center' },
});
