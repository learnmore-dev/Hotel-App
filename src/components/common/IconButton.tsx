import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type IconButtonProps = {
  icon: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  variant?: 'plain' | 'surface' | 'outline';
  testID?: string;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  size = 44,
  variant = 'plain',
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        variant === 'surface' && styles.surface,
        variant === 'outline' && styles.outline,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <View pointerEvents="none">{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  surface: { backgroundColor: colors.surface },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: colors.accentSubtle, transform: [{ scale: 0.96 }] },
});
