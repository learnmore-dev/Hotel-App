import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { colors } from '@/constants/colors';
import { radii } from '@/constants/spacing';
import { getUnreadNotificationCount } from '@/services/api/notificationApi';
import { useAuthStore } from '@/store/authStore';

export type NotificationBellProps = {
  onPress?: () => void;
  size?: number;
  testID?: string;
};

export function NotificationBell({
  onPress,
  size = 44,
  testID = 'notification-bell',
}: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const role = useAuthStore((state) => state.user?.role);

  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.unreadCount);
    } catch {
      // Non-blocking: fail quietly
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchCount();
    }, [fetchCount]),
  );

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (role === 'PARTNER') {
      router.push('/(partner)/notifications' as any);
    } else if (role === 'ADMIN') {
      router.push('/(admin)/notifications' as any);
    } else {
      router.push('/(customer)/notifications' as any);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Notifications, ${unreadCount} unread`}
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}>
      <Text style={styles.bellIcon}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    position: 'relative',
  },
  bellIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626', // vibrant error red
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
