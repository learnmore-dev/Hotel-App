import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';

export type PaymentMethodOption = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};
export type PaymentMethodProps = {
  methods: PaymentMethodOption[];
  selectedMethodId?: string;
  onSelect: (methodId: string) => void;
  title?: string;
  disabled?: boolean;
};

export function PaymentMethod({
  methods,
  selectedMethodId,
  onSelect,
  title = 'Payment method',
  disabled = false,
}: PaymentMethodProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {methods.map((method) => {
          const selected = method.id === selectedMethodId;
          return (
            <Pressable
              key={method.id}
              accessibilityRole="radio"
              accessibilityLabel={method.label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(method.id)}
              style={({ pressed }) => [styles.method, selected && styles.methodSelected, disabled && styles.disabled, pressed && styles.pressed]}>
              {method.icon ? <View style={styles.icon}>{method.icon}</View> : null}
              <View style={styles.copy}>
                <Text style={styles.label}>{method.label}</Text>
                {method.description ? <Text style={styles.description}>{method.description}</Text> : null}
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.small },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  list: { gap: spacing.small },
  method: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.medium, padding: spacing.medium, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface },
  methodSelected: { borderColor: colors.accent, backgroundColor: colors.accentSubtle },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xxxsmall },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  radio: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radii.pill },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.primary },
});
