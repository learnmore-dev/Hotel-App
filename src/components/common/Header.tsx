import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { IconButton } from './IconButton';

export type HeaderProps = {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightAction?: ReactNode;
  accessibilityLabel?: string;
};

export function Header({ title, subtitle, onBackPress, rightAction, accessibilityLabel }: HeaderProps) {
  return (
    <View style={styles.container}>
      {onBackPress ? (
        <IconButton
          icon={<Text style={styles.backGlyph}>‹</Text>}
          accessibilityLabel="Go back"
          testID="header-back-button"
          onPress={onBackPress}
        />
      ) : null}
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" accessibilityLabel={accessibilityLabel} style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.background,
  },
  titleGroup: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: spacing.xxxsmall, color: colors.muted, fontSize: 13 },
  backGlyph: { marginTop: -4, color: colors.text, fontSize: 36, lineHeight: 40 },
  action: { flexShrink: 0 },
});
