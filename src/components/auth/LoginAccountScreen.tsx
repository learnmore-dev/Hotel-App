import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

function messageByField(details: ApiErrorDetail[]): Record<string, string> {
  return details.reduce<Record<string, string>>((result, detail) => {
    if (detail.field) result[detail.field] = detail.message;
    return result;
  }, {});
}

type FocusedField = 'email' | 'password' | null;

export function LoginAccountScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      next.email = 'Enter your email address.';
    } else if (!emailPattern.test(trimmedEmail)) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Enter your password.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setRequestError('');
    if (!validate()) return;

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
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
        setRequestError(
          error instanceof Error ? error.message : 'Unable to sign in. Please check your credentials and try again.'
        );
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
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <View style={styles.mainCard}>
            {/* 2. Login Header */}
            <View style={styles.header}>
              <View style={styles.headerTextGroup}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Account Login
                </Text>
                <Text style={styles.subtitle}>TRUMITRIP Luxury Hotel Booking Portal</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close login"
                onPress={handleClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
                hitSlop={8}>
                <Ionicons name="close" size={20} color="#E5B83F" />
              </Pressable>
            </View>

            {/* 3. Login Form */}
            <View style={styles.formCard}>
              {requestError ? (
                <View style={styles.errorBannerContainer}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                  <Text accessibilityRole="alert" style={styles.errorBannerText}>
                    {requestError}
                  </Text>
                </View>
              ) : null}

              {/* Email Address */}
              <View style={styles.fieldContainer}>
                <Pressable onPress={() => emailInputRef.current?.focus()} hitSlop={4}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                </Pressable>
                <Pressable
                  onPress={() => emailInputRef.current?.focus()}
                  style={[
                    styles.inputFrame,
                    focusedField === 'email' && styles.inputFrameFocused,
                    Boolean(errors.email) && styles.inputFrameError,
                  ]}>
                  <View pointerEvents="none" style={styles.iconWrapper}>
                    <Ionicons name="mail-outline" size={19} color="#64748B" />
                  </View>
                  <TextInput
                    ref={emailInputRef}
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
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    editable={!isLoading}
                  />
                </Pressable>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.fieldContainer}>
                <Pressable onPress={() => passwordInputRef.current?.focus()} hitSlop={4}>
                  <Text style={styles.fieldLabel}>Password</Text>
                </Pressable>
                <Pressable
                  onPress={() => passwordInputRef.current?.focus()}
                  style={[
                    styles.inputFrame,
                    focusedField === 'password' && styles.inputFrameFocused,
                    Boolean(errors.password) && styles.inputFrameError,
                  ]}>
                  <View pointerEvents="none" style={styles.iconWrapper}>
                    <Ionicons name="lock-closed-outline" size={19} color="#64748B" />
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInput}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
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
                </Pressable>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              {/* Forgot Password Link */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot password?"
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={8}
                style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>

              {/* 4. Sign In Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign In To Account"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                disabled={isLoading}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !isLoading && styles.submitButtonPressed,
                  isLoading && styles.submitButtonDisabled,
                ]}>
                {isLoading ? (
                  <ActivityIndicator color="#101828" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Sign In To Account</Text>
                )}
              </Pressable>

              {/* 5. Sign Up Navigation */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign Up Now"
                  onPress={() => router.replace('/(auth)/signup')}
                  hitSlop={8}>
                  <Text style={styles.signUpLink}>Sign Up Now</Text>
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
  inputFrame: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: '#DCE1E8',
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
  iconWrapper: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    color: '#C77A24',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#D8B23E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#D8B23E',
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
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#101828',
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
    color: '#667085',
    fontSize: 14,
  },
  signUpLink: {
    color: '#C77A24',
    fontSize: 14,
    fontWeight: '700',
  },
});
