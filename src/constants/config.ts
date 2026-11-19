import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Public client configuration. Do not put credentials or private keys here. */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Web runs in host browser; if configured points to Android emulator 10.0.2.2, use localhost for web
  if (Platform.OS === 'web') {
    if (configured && !configured.includes('10.0.2.2')) {
      return configured;
    }
    return 'http://localhost:5000/api';
  }

  if (configured) {
    return configured;
  }

  // Android emulator fallback
  if (Platform.OS === 'android') {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      // Physical device over LAN has a non-loopback host IP
      if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '10.0.2.2') {
        return `http://${host}:5000/api`;
      }
    }
    return 'http://10.0.2.2:5000/api';
  }

  // iOS simulator / fallback
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:5000/api`;
    }
  }

  return 'http://localhost:5000/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

console.log('TRUMITRIP API BASE URL:', API_BASE_URL);
