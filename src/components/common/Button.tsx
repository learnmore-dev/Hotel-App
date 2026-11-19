import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  accessibilityLabel?: string;
};

const variantStyles = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, textColor: colors.surface },
  secondary: { backgroundColor: colors.accentSubtle, borderColor: colors.accentSubtle, textColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderColor: colors.border, textColor: colors.primary },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent', textColor: colors.primary },
  danger: { backgroundColor: colors.error, borderColor: colors.error, textColor: colors.surface },
} as const;

const sizeStyles = {
  small: { minHeight: 40, paddingHorizontal: spacing.medium, fontSize: 14 },
  medium: { minHeight: 48, paddingHorizontal: spacing.large, fontSize: 16 },
  large: { minHeight: 56, paddingHorizontal: spacing.xlarge, fontSize: 17 },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  accessibilityLabel,
}: ButtonProps) {
  const palette = variantStyles[variant];
  const dimensions = sizeStyles[size];
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: unavailable ? colors.background : palette.backgroundColor,
          borderColor: palette.borderColor,
          minHeight: dimensions.minHeight,
          paddingHorizontal: dimensions.paddingHorizontal,
        },
        fullWidth && styles.fullWidth,
        pressed && !unavailable && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text
            style={[
              styles.label,
              { color: unavailable ? colors.muted : palette.textColor, fontSize: dimensions.fontSize },
            ]}>
            {title}
          </Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.medium,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xsmall },
  label: { fontWeight: '700', textAlign: 'center' },
});
