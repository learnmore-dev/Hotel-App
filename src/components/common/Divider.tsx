import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

export type DividerProps = { inset?: number; vertical?: boolean; color?: string };

export function Divider({ inset = 0, vertical = false, color = colors.border }: DividerProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.divider,
        vertical ? { width: StyleSheet.hairlineWidth, height: '100%', marginHorizontal: inset } : { height: StyleSheet.hairlineWidth, width: '100%', marginVertical: inset },
        { backgroundColor: color },
      ]}
    />
  );
}

const styles = StyleSheet.create({ divider: { flexShrink: 0 } });
