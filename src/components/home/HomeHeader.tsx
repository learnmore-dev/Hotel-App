import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';

type HomeHeaderProps = {
  onOpenDrawer: () => void;
};

export function HomeHeader({ onOpenDrawer }: HomeHeaderProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <View style={styles.headerContainer}>
      {/* Brand Group */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="TrumiTrip Home"
        onPress={() => router.push('/(customer)/home')}
        style={styles.brandGroup}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>T</Text>
        </View>
        <View style={styles.brandTextGroup}>
          <Text style={styles.brandTitle}>TRUMITRIP</Text>
          <Text style={styles.brandTagline}>EXPLORE MORE. EXPERIENCE BEYOND...</Text>
        </View>
      </Pressable>

      {/* Header Actions */}
      <View style={styles.actionsGroup}>
        {isAuthenticated && user ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`User profile ${user.fullName}`}
            onPress={() => router.push('/(customer)/profile')}
            style={styles.profileButton}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={16} color="#07172F" />
            </View>
            <Text numberOfLines={1} style={styles.profileName}>
              {user.fullName.split(' ')[0]}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login or Signup"
            onPress={() => router.push('/(auth)/login')}
            style={({ pressed }) => [styles.authButton, pressed && styles.authButtonPressed]}>
            <Text style={styles.authButtonText}>Login / Signup</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          onPress={onOpenDrawer}
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
          hitSlop={8}>
          <Ionicons name="menu" size={24} color="#E5B83F" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#07172F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 184, 63, 0.15)',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5B83F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E5B83F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  logoBadgeText: {
    color: '#07172F',
    fontSize: 22,
    fontWeight: '900',
  },
  brandTextGroup: {
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#E5B83F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  brandTagline: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authButton: {
    backgroundColor: 'rgba(229, 184, 63, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5B83F',
  },
  authButtonPressed: {
    backgroundColor: 'rgba(229, 184, 63, 0.25)',
  },
  authButtonText: {
    color: '#E5B83F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.3)',
    maxWidth: 120,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5B83F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  menuButtonPressed: {
    backgroundColor: 'rgba(229, 184, 63, 0.16)',
  },
});
