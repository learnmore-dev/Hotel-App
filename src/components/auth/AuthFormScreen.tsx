import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Header } from '@/components/common/Header';
import { Input } from '@/components/common/Input';
import { colors } from '@/constants/colors';
import { radii, spacing } from '@/constants/spacing';
import { ApiRequestError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorDetail, UserRole } from '@/types/auth';
import { roleHome } from '@/utils/authNavigation';

type AuthFormMode = 'login' | 'signup';

type AuthFormScreenProps = { mode: AuthFormMode };

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

function roleRoute(role: UserRole): Href {
  return roleHome(role);
}

export function AuthFormScreen({ mode }: AuthFormScreenProps) {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');

  const isSignup = mode === 'signup';
  const switchRoute = isSignup ? '/(auth)/login' : '/(auth)/signup';
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (isSignup && !fullName.trim()) next.fullName = 'Enter your full name.';
    if (!emailPattern.test(email.trim())) next.email = 'Enter a valid email address.';
    if (isSignup && phone.trim() && !phonePattern.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!password) next.password = 'Enter your password.';
    else if (isSignup && password.length < 8) next.password = 'Use at least 8 characters.';
    else if (isSignup && !passwordPattern.test(password)) {
      next.password = 'Include uppercase, lowercase, and a number.';
    } else if (isSignup && utf8ByteLength(password) > 72) {
      next.password = 'Password must be 72 bytes or fewer.';
    }
    if (isSignup && password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setRequestError('');
    if (!validate()) return;

    try {
      if (isSignup) {
        await register({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          password,
          confirmPassword,
        });
      } else {
        await login({ email: email.trim().toLowerCase(), password });
      }
      const user = useAuthStore.getState().user;
      if (user) router.replace(roleRoute(user.role));
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(messageByField(error.errors));
        setRequestError(error.errors.length ? '' : error.message);
      } else {
        setRequestError(error instanceof Error ? error.message : 'Unable to continue. Please try again.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Header title="TrumiTrip" subtitle="Your next stay starts here" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{isSignup ? 'Create account' : 'Welcome back'}</Text>
        <Text style={styles.description}>
          {isSignup ? 'Set up your account to start planning your next stay.' : 'Log in to continue your travel plans.'}
        </Text>

        {requestError ? <Text accessibilityRole="alert" style={styles.errorBanner}>{requestError}</Text> : null}

        {isSignup ? (
          <Input
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            error={errors.fullName}
          />
        ) : null}
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          error={errors.email}
        />
        {isSignup ? (
          <Input
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            error={errors.phone}
          />
        ) : null}
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          textContentType={isSignup ? 'newPassword' : 'password'}
          returnKeyType={isSignup ? 'next' : 'done'}
          onSubmitEditing={!isSignup ? () => void submit() : undefined}
          error={errors.password}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((visible) => !visible)}
              hitSlop={8}>
              <Text style={styles.visibility}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          }
        />
        {isSignup ? (
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={errors.confirmPassword}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'}
                onPress={() => setShowConfirmPassword((visible) => !visible)}
                hitSlop={8}>
                <Text style={styles.visibility}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />
        ) : null}

        {!isSignup ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        ) : (
          <Text style={styles.passwordHint}>Use at least 8 characters, with uppercase, lowercase, and a number.</Text>
        )}

        <Button
          title={isSignup ? 'Create account' : 'Login'}
          onPress={() => void submit()}
          fullWidth
          size="large"
          loading={isLoading}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{isSignup ? 'Already have an account?' : 'New to TrumiTrip?'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace(switchRoute)}>
            <Text style={styles.link}>{isSignup ? 'Login' : 'Create account'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, gap: spacing.medium, padding: spacing.large, paddingBottom: spacing.xxlarge },
  brandMark: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radii.large, backgroundColor: colors.accentSubtle },
  brandMarkText: { color: colors.primary, fontSize: 29, fontWeight: '800' },
  title: { marginTop: spacing.small, color: colors.primary, fontSize: 29, fontWeight: '800' },
  description: { marginTop: -spacing.small, marginBottom: spacing.small, color: colors.muted, fontSize: 15, lineHeight: 22 },
  errorBanner: { padding: spacing.medium, borderRadius: radii.medium, backgroundColor: colors.errorSubtle, color: colors.error, lineHeight: 20 },
  visibility: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: spacing.xsmall },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  passwordHint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xsmall, paddingTop: spacing.small },
  switchText: { color: colors.muted, fontSize: 14 },
});
