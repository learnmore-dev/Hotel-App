import { Stack } from 'expo-router';
import { AdminHotelDetailsScreen } from '@/components/hotel/AdminHotelDetailsScreen';

export default function AdminHotelDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Hotel Verification' }} />
      <AdminHotelDetailsScreen />
    </>
  );
}
