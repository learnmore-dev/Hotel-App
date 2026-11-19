import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/spacing';
import { Input } from '@/components/common/Input';

export type GuestDetails = {
  fullName: string;
  email: string;
  phone: string;
};
export type GuestField = keyof GuestDetails;
export type GuestFormProps = {
  value: GuestDetails;
  onChange: (field: GuestField, value: string) => void;
  errors?: Partial<Record<GuestField, string>>;
  disabled?: boolean;
};

export function GuestForm({ value, onChange, errors = {}, disabled = false }: GuestFormProps) {
  return (
    <View style={styles.container}>
      <Input
        label="Full name"
        testID="guest-full-name"
        value={value.fullName}
        onChangeText={(next) => onChange('fullName', next)}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        editable={!disabled}
        error={errors.fullName}
        returnKeyType="next"
      />
      <Input
        label="Email address"
        testID="guest-email"
        value={value.email}
        onChangeText={(next) => onChange('email', next)}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!disabled}
        error={errors.email}
        returnKeyType="next"
      />
      <Input
        label="Phone number"
        testID="guest-phone"
        value={value.phone}
        onChangeText={(next) => onChange('phone', next)}
        autoComplete="tel"
        textContentType="telephoneNumber"
        keyboardType="phone-pad"
        editable={!disabled}
        error={errors.phone}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: spacing.medium } });
