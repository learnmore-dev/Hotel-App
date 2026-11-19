import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';

export type BookingSummaryLine = { id: string; label: string; value: string; subdued?: boolean };
export type BookingSummaryProps = {
  title?: string;
  lines: BookingSummaryLine[];
  totalLabel?: string;
  total: string;
  note?: string;
};

export function BookingSummary({ title = 'Price summary', lines, totalLabel = 'Total', total, note }: BookingSummaryProps) {
  return (
    <Card padding="large">
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={[styles.label, line.subdued && styles.subdued]}>{line.label}</Text>
            <Text style={[styles.value, line.subdued && styles.subdued]}>{line.value}</Text>
          </View>
        ))}
        <Divider inset={spacing.xsmall} />
        <View style={styles.row}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text style={styles.total}>{total}</Text>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.medium },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.small },
  label: { flex: 1, color: colors.text, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  subdued: { color: colors.muted },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  total: { color: colors.primary, fontSize: 19, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
