import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export type LoaderProps = {
  label?: string;
  fullScreen?: boolean;
  color?: string;
};

export function Loader({ label = 'Loading', fullScreen = false, color = colors.accent }: LoaderProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: spacing.small, padding: spacing.large },
  fullScreen: { flex: 1, backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 14 },
});
