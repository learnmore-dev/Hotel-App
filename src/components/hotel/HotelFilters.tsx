import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/common/Input';
import { spacing } from '@/constants/spacing';

export type HotelFilterValues = { destination: string; minPrice: string; maxPrice: string; starRating: string; amenities: string };
type Props = { values: HotelFilterValues; onChange: (values: HotelFilterValues) => void };

export function HotelFilters({ values, onChange }: Props) {
  const set = (key: keyof HotelFilterValues) => (value: string) => onChange({ ...values, [key]: value });
  return <View style={styles.container}>
    <Input label="Destination" value={values.destination} onChangeText={set('destination')} placeholder="City or destination" />
    <View style={styles.pair}><Input label="Minimum price" value={values.minPrice} onChangeText={set('minPrice')} keyboardType="decimal-pad" /><Input label="Maximum price" value={values.maxPrice} onChangeText={set('maxPrice')} keyboardType="decimal-pad" /></View>
    <Input label="Star rating" value={values.starRating} onChangeText={set('starRating')} keyboardType="number-pad" placeholder="1–5" />
    <Input label="Amenities" value={values.amenities} onChangeText={set('amenities')} placeholder="Wi-Fi, pool, breakfast" helperText="Separate amenities with commas" />
  </View>;
}

const styles = StyleSheet.create({ container: { gap: spacing.large }, pair: { flexDirection: 'row', gap: spacing.small } });
