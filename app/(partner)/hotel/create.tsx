import { router, Stack } from 'expo-router';
import { PartnerHotelForm } from '@/components/hotel/PartnerHotelForm';
import type { Hotel } from '@/types/hotel';

export default function PartnerHotelCreateScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Add New Hotel' }} />
      <PartnerHotelForm
        onSaved={(hotel: Hotel) => router.replace({ pathname: '/(partner)/hotel/[id]', params: { id: hotel.id } })}
      />
    </>
  );
}
