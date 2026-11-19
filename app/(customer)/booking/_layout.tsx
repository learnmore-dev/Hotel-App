import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function CustomerBookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="payment" options={{ title: 'Payment' }} />
      <Stack.Screen
        name="success"
        options={{
          title: 'Booking Confirmed',
          headerBackVisible: false,
        }}
      />
      <Stack.Screen name="[bookingId]" options={{ title: 'Booking Details' }} />
    </Stack>
  );
}
