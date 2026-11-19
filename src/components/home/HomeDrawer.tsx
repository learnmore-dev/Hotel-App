import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '@/store/authStore';

type HomeDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onNavigateToOffers?: () => void;
};

export function HomeDrawer({ visible, onClose, onNavigateToOffers }: HomeDrawerProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  console.log('Current user role:', user?.role);
  const logout = useAuthStore((state) => state.logout);

  const handleNav = (action: () => void) => {
  onClose();
  action();
};

  const handleLogout = async () => {
    onClose();
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      // silent catch
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop to dismiss */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation drawer"
          style={styles.backdrop}
          onPress={onClose}
        />

        {/* Drawer Panel */}
        <View style={styles.drawerContainer}>
          {/* Drawer Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>T</Text>
              </View>
              <View>
                <Text style={styles.brandName}>TRUMITRIP</Text>
                <Text style={styles.brandSubtitle}>LUXURY HOSPITALITY</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close drawer"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressedBtn]}
              hitSlop={8}>
              <Ionicons name="close" size={22} color="#E5B83F" />
            </Pressable>
          </View>

          {/* User Profile Card */}
          <View style={styles.userSection}>
            {isAuthenticated && user ? (
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={20} color="#07172F" />
                </View>
                <View style={styles.userInfo}>
                  <Text numberOfLines={1} style={styles.userName}>
                    {user.fullName}
                  </Text>
                  <Text numberOfLines={1} style={styles.userEmail}>
                    {user.email}
                  </Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.guestCard}>
                <Text style={styles.guestTitle}>Welcome, Guest</Text>
                <Text style={styles.guestSubtitle}>Sign in for member rates & bookings</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign in or register"
                  style={({ pressed }) => [styles.guestBtn, pressed && styles.guestBtnPressed]}
                  onPress={() => handleNav(() => router.push('/(auth)/login'))}>
                  <Text style={styles.guestBtnText}>Sign In / Register</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Nav Links */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuList}>
            <DrawerItem
              icon="home-outline"
              label="Home"
              onPress={() => handleNav(() => router.push('/(customer)/home'))}
            />
            <DrawerItem
              icon="search-outline"
              label="Search Hotels"
              onPress={() => handleNav(() => router.push('/(customer)/search'))}
            />
            <DrawerItem
              icon="calendar-outline"
              label="My Bookings"
              onPress={() => handleNav(() => router.push('/(customer)/bookings'))}
            />
            <DrawerItem
              icon="pricetag-outline"
              label="Exclusive Deals & Offers"
              badge="SAVE 25%"
              onPress={() => {
                if (onNavigateToOffers) {
                  onClose();
                  onNavigateToOffers();
                } else {
                  handleNav(() => router.push('/(customer)/search'));
                }
              }}
            />
            <DrawerItem
              icon="person-outline"
              label="Account Profile"
              onPress={() => handleNav(() => router.push('/(customer)/profile'))}
            />
            <DrawerItem
              icon="business-outline"
              label="Partner Portal"
              subtitle="List your property"
              onPress={() => handleNav(() => router.push('/(partner)/dashboard'))}
            />
            <DrawerItem
              icon="headset-outline"
              label="24/7 Concierge Support"
              subtitle="1800-TRUMI-TRIP"
              onPress={() => handleNav(() => router.push('/(customer)/support'))}
            />
          </ScrollView>

          {/* Drawer Footer */}
          <View style={styles.footer}>
            {isAuthenticated ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out of account"
                style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
                onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#F87171" />
                <Text style={styles.logoutText}>Log Out</Text>
              </Pressable>
            ) : null}

            <Text style={styles.footerVersion}>TrumiTrip Mobile v1.0.0</Text>
            <Text style={styles.footerCopyright}>© 2026 TrumiTrip Hospitality</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DrawerItem({
  icon,
  label,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}>
      <View style={styles.itemIconWrap}>
        <Ionicons name={icon} size={20} color="#E5B83F" />
      </View>
      <View style={styles.itemTextWrap}>
        <Text style={styles.itemLabel}>{label}</Text>
        {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#64748B" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: '#07172F',
    height: '100%',
    paddingTop: 48,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(229, 184, 63, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  brandName: {
    color: '#E5B83F',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  userSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#10243D',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.25)',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5B83F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229, 184, 63, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  roleText: {
    color: '#E5B83F',
    fontSize: 9,
    fontWeight: '800',
  },
  guestCard: {
    backgroundColor: '#10243D',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  guestTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  guestSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  guestBtn: {
    backgroundColor: '#E5B83F',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  guestBtnPressed: {
    backgroundColor: '#D4A62C',
  },
  guestBtnText: {
    color: '#07172F',
    fontSize: 13,
    fontWeight: '800',
  },
  menuList: {
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemIconWrap: {
    width: 32,
    alignItems: 'center',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  badgeWrap: {
    backgroundColor: '#E5B83F',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#07172F',
    fontSize: 9,
    fontWeight: '900',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  logoutBtnPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
  },
  footerVersion: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  footerCopyright: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
});
