import { HotelListingScreen } from '@/components/hotel/HotelListingScreen';

export default function AdminHotelsScreen() {
  console.log('ADMIN HOTELS ROUTE MOUNTED');
  return <HotelListingScreen mode="admin" />;
}