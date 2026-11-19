import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { Button } from './Button';

export type EmptyStateProps = {
  title: string;
  description?: string;
  illustration?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, illustration, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="outline" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.small, padding: spacing.xlarge },
  illustration: { marginBottom: spacing.small },
  title: { color: colors.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  description: { maxWidth: 420, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
