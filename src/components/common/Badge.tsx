import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type BadgeTone = 'neutral' | 'gold' | 'success' | 'error' | 'primary';
export type BadgeProps = { label: string; tone?: BadgeTone; showDot?: boolean };

const tones = {
  neutral: { background: colors.background, foreground: colors.text, dot: colors.muted },
  gold: { background: colors.accentSubtle, foreground: colors.primary, dot: colors.accent },
  success: { background: colors.successSubtle, foreground: colors.success, dot: colors.success },
  error: { background: colors.errorSubtle, foreground: colors.error, dot: colors.error },
  primary: { background: '#EAF0F7', foreground: colors.primary, dot: colors.primary },
} as const;

export function Badge({ label, tone = 'neutral', showDot = false }: BadgeProps) {
  const palette = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      {showDot ? <View style={[styles.dot, { backgroundColor: palette.dot }]} /> : null}
      <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xxsmall, paddingHorizontal: spacing.small, paddingVertical: spacing.xxsmall, borderRadius: radii.pill },
  dot: { width: 6, height: 6, borderRadius: radii.pill },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
