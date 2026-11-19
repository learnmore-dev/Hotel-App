import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'trumitrip.access-token';
const REFRESH_TOKEN_KEY = 'trumitrip.refresh-token';

function ensureNativeSecureStorage(): void {
  if (Platform.OS === 'web') {
    throw new Error('Secure authentication storage is available only in the iOS and Android app.');
  }
}

export async function saveAccessToken(token: string): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  ensureNativeSecureStorage();
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function removeAccessToken(): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveRefreshToken(token: string): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  ensureNativeSecureStorage();
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function removeRefreshToken(): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
  ensureNativeSecureStorage();
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function clearAllTokens(): Promise<void> {
  ensureNativeSecureStorage();
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

/** Backward compatibility aliases for existing imports. */
export const saveToken = saveAccessToken;
export const getToken = getAccessToken;
export const removeToken = clearAllTokens;
