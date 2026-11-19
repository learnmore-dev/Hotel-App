import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/spacing';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';

export type FilterSheetProps = {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
  onApply: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
};

export function FilterSheet({
  visible,
  children,
  onClose,
  onApply,
  onReset,
  applyLabel = 'Show results',
  resetLabel = 'Reset',
}: FilterSheetProps) {
  return (
    <Modal visible={visible} title="Filters" onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.filters}>{children}</View>
        <View style={styles.actions}>
          {onReset ? <Button title={resetLabel} variant="ghost" onPress={onReset} /> : null}
          <Button title={applyLabel} onPress={onApply} fullWidth={!onReset} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.large },
  filters: { gap: spacing.large },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
});
