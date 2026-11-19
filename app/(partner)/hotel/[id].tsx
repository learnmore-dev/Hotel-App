import { Stack, useLocalSearchParams } from 'expo-router';
import { PartnerHotelForm } from '@/components/hotel/PartnerHotelForm';

export default function PartnerHotelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Edit Hotel' }} />
      <PartnerHotelForm hotelId={id} />
    </>
  );
}
