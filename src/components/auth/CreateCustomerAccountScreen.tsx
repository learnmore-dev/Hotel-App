import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ApiRequestError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorDetail } from '@/types/auth';
import { roleHome } from '@/utils/authNavigation';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s().-]{7,20}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function messageByField(details: ApiErrorDetail[]): Record<string, string> {
  return details.reduce<Record<string, string>>((result, detail) => {
    if (detail.field) result[detail.field] = detail.message;
    return result;
  }, {});
}

type FocusedField = 'fullName' | 'email' | 'phone' | 'password' | null;

export function CreateCustomerAccountScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!fullName.trim()) {
      next.fullName = 'Full name is required.';
    } else if (fullName.trim().length > 160) {
      next.fullName = 'Full name must be 160 characters or fewer.';
    }

    if (!email.trim()) {
      next.email = 'Email address is required.';
    } else if (!emailPattern.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }

    if (phone.trim() && !phonePattern.test(phone.trim())) {
      next.phone = 'Enter a valid phone number.';
    }

    if (!password) {
      next.password = 'Enter your password.';
    } else if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    } else if (!passwordPattern.test(password)) {
      next.password = 'Password must include uppercase, lowercase, and a number.';
    } else if (utf8ByteLength(password) > 72) {
      next.password = 'Password must be 72 bytes or fewer.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setRequestError('');
    if (!validate()) return;

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        password,
        confirmPassword: password,
      });

      const user = useAuthStore.getState().user;
      if (user) {
        router.replace(roleHome(user.role));
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(messageByField(error.errors));
        setRequestError(error.errors.length ? '' : error.message);
      } else {
        setRequestError(error instanceof Error ? error.message : 'Unable to complete registration. Please try again.');
      }
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.mainCard}>
            {/* 2. Registration Header */}
            <View style={styles.header}>
              <View style={styles.headerTextGroup}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Create Customer Account
                </Text>
                <Text style={styles.subtitle}>TRUMITRIP Luxury Hotel Booking Portal</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close registration"
                onPress={handleClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                hitSlop={8}>
                <Ionicons name="close" size={20} color="#E5B83F" />
              </Pressable>
            </View>

            {/* 3. Registration Form Fields */}
            <View style={styles.formCard}>
              {requestError ? (
                <View style={styles.errorBannerContainer}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                  <Text accessibilityRole="alert" style={styles.errorBannerText}>
                    {requestError}
                  </Text>
                </View>
              ) : null}

              {/* Full Name * */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  Full Name <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputFrame,
                    focusedField === 'fullName' && styles.inputFrameFocused,
                    Boolean(errors.fullName) && styles.inputFrameError,
                  ]}>
                  <Ionicons name="person-outline" size={19} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    onFocus={() => setFocusedField('fullName')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. Alt af Fateh"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                </View>
                {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
              </View>

              {/* Email Address * */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  Email Address <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputFrame,
                    focusedField === 'email' && styles.inputFrameFocused,
                    Boolean(errors.email) && styles.inputFrameError,
                  ]}>
                  <Ionicons name="mail-outline" size={19} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="name@domain.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Mobile Phone Number */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Mobile Phone Number</Text>
                <View
                  style={[
                    styles.inputFrame,
                    focusedField === 'phone' && styles.inputFrameFocused,
                    Boolean(errors.phone) && styles.inputFrameError,
                  ]}>
                  <Ionicons name="call-outline" size={19} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter mobile number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>

              {/* Create Password * */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  Create Password <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputFrame,
                    focusedField === 'password' && styles.inputFrameFocused,
                    Boolean(errors.password) && styles.inputFrameError,
                  ]}>
                  <Ionicons name="lock-closed-outline" size={19} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                    editable={!isLoading}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={8}
                    style={styles.visibilityButton}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </Pressable>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : (
                  <Text style={styles.hintText}>
                    Use at least 8 characters with uppercase, lowercase, and a number.
                  </Text>
                )}
              </View>

              {/* 4. Registration Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Complete Registration"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                disabled={isLoading}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !isLoading && styles.submitButtonPressed,
                  isLoading && styles.submitButtonDisabled,
                ]}>
                {isLoading ? (
                  <ActivityIndicator color="#E5B83F" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Complete Registration</Text>
                )}
              </Pressable>

              {/* 5. Login Navigation */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace('/(auth)/login')}
                  hitSlop={8}>
                  <Text style={styles.loginLink}>Login Instead</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1930',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  mainCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  header: {
    backgroundColor: '#0B1930',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  heading: {
    color: '#E5B83F',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(229, 184, 63, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    gap: 16,
  },
  errorBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  requiredAsterisk: {
    color: '#E5B83F',
    fontWeight: '700',
  },
  inputFrame: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
  },
  inputFrameFocused: {
    borderColor: '#E5B83F',
    borderWidth: 1.5,
  },
  inputFrameError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  fieldIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    color: '#0F172A',
    fontSize: 15,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    height: '100%',
  },
  visibilityButton: {
    padding: 4,
    marginLeft: 6,
  },
  hintText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  submitButton: {
    minHeight: 52,
    backgroundColor: '#0B1930',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0B1930',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    color: '#E5B83F',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingTop: 8,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  loginLink: {
    color: '#E5B83F',
    fontSize: 14,
    fontWeight: '700',
  },
});
