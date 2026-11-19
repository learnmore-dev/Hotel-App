
import { Button } from '@/components/common/Button';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { useAuthStore } from '@/store/authStore';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function PartnerProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Partner Profile
      </Text>

      <View style={styles.card}>
        <Text style={styles.name}>
          {user?.fullName ?? 'Partner'}
        </Text>
        {user?.email ? (
          <Text style={styles.detail}>{user.email}</Text>
        ) : null}
        {user?.phone ? (
          <Text style={styles.detail}>{user.phone}</Text>
        ) : null}
        <Text style={styles.role}>PARTNER ACCOUNT</Text>
      </View>

      <Button
        title="Log out"
        variant="outline"
        fullWidth
        loading={isLoading}
        onPress={() => void handleLogout()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.medium,
    padding: spacing.large,
    paddingTop: spacing.xxlarge,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  card: {
    gap: spacing.xsmall,
    padding: spacing.large,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  detail: {
    color: colors.muted,
    fontSize: 15,
  },
  role: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.small,
  },
});
