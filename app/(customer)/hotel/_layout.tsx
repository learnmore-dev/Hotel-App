import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function CustomerHotelLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '600' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Hotel Details',
        }}
      />
    </Stack>
  );
}
