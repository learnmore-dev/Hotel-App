import type { Href } from 'expo-router';
import { Link, router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useAuthStore } from '@/store/authStore';

export default function AdminMoreScreen() {
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login' as Href);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        More
      </Text>

      <Link href={'/(admin)/coupons' as Href} style={styles.link}>
        Coupons & Offers
      </Link>

      <Link href={'/(admin)/reviews' as Href} style={styles.link}>
        Reviews Moderation
      </Link>

      <Link href={'/(admin)/payouts' as Href} style={styles.link}>
        Payouts
      </Link>

      <Link href={'/(admin)/analytics' as Href} style={styles.link}>
        Analytics
      </Link>

      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.medium,
    padding: spacing.large,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  link: {
    color: colors.primary,
    fontSize: 17,
  },
  logoutButton: {
    marginTop: spacing.large,
    backgroundColor: '#D93025',
    padding: spacing.medium,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});