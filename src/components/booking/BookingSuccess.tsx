import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { Button } from '@/components/common/Button';

export type BookingSuccessProps = {
  title?: string;
  message: string;
  bookingReference?: string;
  icon?: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function BookingSuccess({
  title = 'You’re all set',
  message,
  bookingReference,
  icon,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: BookingSuccessProps) {
  return (
    <View style={styles.container}>
      <View accessibilityElementsHidden style={styles.iconCircle}>
        {icon ?? <Text style={styles.check}>✓</Text>}
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {bookingReference ? (
        <View style={styles.reference}>
          <Text style={styles.referenceLabel}>Booking reference</Text>
          <Text selectable style={styles.referenceValue}>{bookingReference}</Text>
        </View>
      ) : null}
      {primaryActionLabel && onPrimaryAction ? <Button title={primaryActionLabel} onPress={onPrimaryAction} fullWidth /> : null}
      {secondaryActionLabel && onSecondaryAction ? <Button title={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" fullWidth /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.medium, padding: spacing.xlarge },
  iconCircle: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.successSubtle },
  check: { color: colors.success, fontSize: 38, fontWeight: '700' },
  title: { color: colors.primary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { maxWidth: 420, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  reference: { alignItems: 'center', gap: spacing.xxsmall, padding: spacing.medium, borderRadius: radii.medium, backgroundColor: colors.background },
  referenceLabel: { color: colors.muted, fontSize: 12 },
  referenceValue: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
