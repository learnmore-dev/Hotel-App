import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function PartnerHotelLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="create" options={{ title: 'Add New Hotel' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit Hotel' }} />
    </Stack>
  );
}
