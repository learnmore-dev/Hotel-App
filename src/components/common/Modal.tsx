import type { ReactNode } from 'react';
import { Modal as NativeModal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { IconButton } from './IconButton';

export type ModalProps = {
  visible: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  accessibilityLabel?: string;
  animationType?: 'none' | 'slide' | 'fade';
};

export function Modal({ visible, title, children, onClose, accessibilityLabel, animationType = 'fade' }: ModalProps) {
  return (
    <NativeModal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel ?? title}
          style={styles.dialog}>
          {title ? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <IconButton
                icon={<Text style={styles.closeGlyph}>×</Text>}
                accessibilityLabel="Close dialog"
                onPress={onClose}
              />
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </NativeModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    overflow: 'hidden',
    borderRadius: radii.large,
    backgroundColor: colors.surface,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingLeft: spacing.large,
    paddingRight: spacing.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
  closeGlyph: { color: colors.text, fontSize: 27 },
  content: { padding: spacing.large },
});
