import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

export type CouponInputProps = {
  code: string;
  onChangeCode: (code: string) => void;
  onApply: () => void;
  applying?: boolean;
  message?: string;
  messageTone?: 'success' | 'error' | 'neutral';
  applyLabel?: string;
};

export function CouponInput({
  code,
  onChangeCode,
  onApply,
  applying = false,
  message,
  messageTone = 'neutral',
  applyLabel = 'Apply',
}: CouponInputProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Input
          label="Promo code"
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="characters"
          editable={!applying}
          returnKeyType="done"
          onSubmitEditing={onApply}
        />
        <Button title={applyLabel} onPress={onApply} loading={applying} size="medium" />
      </View>
      {message ? (
        <Text
          accessibilityRole={messageTone === 'error' ? 'alert' : undefined}
          style={[styles.message, messageTone === 'success' && styles.success, messageTone === 'error' && styles.error]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xsmall },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.small },
  message: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  success: { color: colors.success },
  error: { color: colors.error },
});
