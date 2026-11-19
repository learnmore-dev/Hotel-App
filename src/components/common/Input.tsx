import { useId } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle, TextInputProps, ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type InputProps = {
  label: string;
  error?: string;
  helperText?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: TextInputProps['style'];
  accessibilityLabel?: string;
} & Omit<TextInputProps, 'accessibilityLabel' | 'style'>;

export function Input({
  label,
  error,
  helperText,
  leading,
  trailing,
  containerStyle,
  frameStyle,
  labelStyle,
  inputStyle,
  accessibilityLabel,
  ...inputProps
}: InputProps) {
  const inputId = useId();
  const message = error ?? helperText;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text nativeID={`${inputId}-label`} style={[styles.label, labelStyle]}>
        {label}
      </Text>
      <View style={[styles.inputFrame, frameStyle, error && styles.inputFrameError]}>
        {leading ? <View style={styles.adornment}>{leading}</View> : null}
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityLabelledBy={`${inputId}-label`}
          accessibilityState={{ disabled: inputProps.editable === false }}
          accessibilityHint={error ?? helperText}
          aria-invalid={Boolean(error)}
          placeholderTextColor={colors.muted}
          style={[styles.input, inputStyle]}
        />
        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </View>
      {message ? (
        <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.message, error && styles.error]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: spacing.xxsmall },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  inputFrame: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall,
    paddingHorizontal: spacing.medium,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  inputFrameError: { borderColor: colors.error },
  input: { flex: 1, minWidth: 0, paddingVertical: spacing.small, color: colors.text, fontSize: 16 },
  adornment: { alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.error },
});
