import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { Loader } from '@/components/common/Loader';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  if (!isInitialized) return <Loader fullScreen label="Restoring your session" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && role === 'CUSTOMER'}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && role === 'PARTNER'}>
        <Stack.Screen name="(partner)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && role === 'ADMIN'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}
