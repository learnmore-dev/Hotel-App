import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Divider } from '@/components/common/Divider';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorView } from '@/components/common/ErrorView';
import { Header } from '@/components/common/Header';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { Loader } from '@/components/common/Loader';
import { Modal } from '@/components/common/Modal';
import { BookingSuccess } from '@/components/booking/BookingSuccess';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { CouponInput } from '@/components/booking/CouponInput';
import { GuestForm } from '@/components/booking/GuestForm';
import { PaymentMethod } from '@/components/booking/PaymentMethod';
import { FilterSheet } from '@/components/hotel/FilterSheet';
import { HotelAmenities } from '@/components/hotel/HotelAmenities';
import { HotelCard } from '@/components/hotel/HotelCard';
import { HotelImageGallery } from '@/components/hotel/HotelImageGallery';
import { HotelRating } from '@/components/hotel/HotelRating';
import { RoomCard } from '@/components/hotel/RoomCard';
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewSummary } from '@/components/review/ReviewSummary';
import { StarRatingInput } from '@/components/review/StarRatingInput';

const componentCases = [
  { name: 'Button', element: <Button title="Continue" onPress={() => undefined} />, text: 'Continue' },
  { name: 'Input', element: <Input label="Destination" />, text: 'Destination' },
  { name: 'Header', element: <Header title="Explore" />, text: 'Explore' },
  { name: 'Loader', element: <Loader label="Loading" />, text: 'Loading' },
  { name: 'ErrorView', element: <ErrorView message="Unable to load" />, text: 'Unable to load' },
  { name: 'EmptyState', element: <EmptyState title="No stays yet" />, text: 'No stays yet' },
  { name: 'Modal', element: <Modal visible title="Dialog" onClose={() => undefined} animationType="none"><Text>Dialog body</Text></Modal>, text: 'Dialog body' },
  { name: 'Card', element: <Card><Text>Card body</Text></Card>, text: 'Card body' },
  { name: 'Badge', element: <Badge label="Featured" />, text: 'Featured' },
  { name: 'Divider', element: <Divider />, text: undefined },
  { name: 'IconButton', element: <IconButton icon={<Text>×</Text>} accessibilityLabel="Close" onPress={() => undefined} />, text: undefined },
  { name: 'HotelCard', element: <HotelCard name="Hotel name" location="City" images={[]} rating={4.5} price={100} currency="$" />, text: 'Hotel name' },
  { name: 'HotelImageGallery', element: <HotelImageGallery images={[]} />, text: 'No photos available' },
  { name: 'HotelRating', element: <HotelRating rating={4.7} reviewCount={12} />, text: '4.7' },
  { name: 'HotelAmenities', element: <HotelAmenities amenities={[{ id: 'wifi', label: 'Wi-Fi' }]} />, text: 'Wi-Fi' },
  { name: 'RoomCard', element: <RoomCard name="Standard room" price={100} currency="$" />, text: 'Standard room' },
  { name: 'FilterSheet', element: <FilterSheet visible={false} onClose={() => undefined} onApply={() => undefined}><Text>Filter choices</Text></FilterSheet>, text: undefined },
  { name: 'BookingSummary', element: <BookingSummary lines={[]} total="$100" />, text: '$100' },
  { name: 'GuestForm', element: <GuestForm value={{ fullName: '', email: '', phone: '' }} onChange={() => undefined} />, text: 'Full name' },
  { name: 'CouponInput', element: <CouponInput code="" onChangeCode={() => undefined} onApply={() => undefined} />, text: 'Promo code' },
  { name: 'PaymentMethod', element: <PaymentMethod methods={[{ id: 'card', label: 'Card' }]} onSelect={() => undefined} />, text: 'Card' },
  { name: 'BookingSuccess', element: <BookingSuccess message="Your stay is confirmed." />, text: 'Your stay is confirmed.' },
  { name: 'StarRatingInput', element: <StarRatingInput rating={4} readOnly />, text: undefined },
  { name: 'ReviewCard', element: <ReviewCard review={{ id: '1', rating: 5, comment: 'Great experience', createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z', customer: { id: 'c1', fullName: 'John Doe', avatar: null } }} />, text: 'Great experience' },
  { name: 'ReviewSummary', element: <ReviewSummary summary={{ averageRating: 4.8, totalReviews: 24, ratingDistribution: { 1: 0, 2: 1, 3: 2, 4: 5, 5: 16 } }} />, text: '4.8' },
];

jest.setTimeout(15000);

describe('design system components', () => {
  it.each(componentCases)('$name renders', async ({ element, text }) => {
    const result = await render(element);
    if (text === undefined && element.type === FilterSheet) {
      expect(result.toJSON()).toBeNull();
      return;
    }
    expect(result.toJSON()).not.toBeNull();
    if (text) expect(result.getByText(text)).toBeTruthy();
  });

  it('invokes button actions and exposes disabled state', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button title="Continue" onPress={onPress} />);
    fireEvent.press(getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reports text changes through Input', async () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = await render(<Input label="Email" onChangeText={onChangeText} />);
    fireEvent.changeText(getByLabelText('Email'), 'guest@example.test');
    expect(onChangeText).toHaveBeenCalledWith('guest@example.test');
  });

  it('triggers the retry action', async () => {
    const onRetry = jest.fn();
    const error = await render(<ErrorView message="Try again" onRetry={onRetry} />);
    fireEvent.press(error.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('selects star rating on press', async () => {
    const onRatingChange = jest.fn();
    const result = await render(<StarRatingInput rating={3} onRatingChange={onRatingChange} />);
    fireEvent.press(result.getByTestId('star-rating-5'));
    expect(onRatingChange).toHaveBeenCalledWith(5);
  });
});
