import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { HomeScreen } from '@/components/home/HomeScreen';
import { FeaturedHotels } from '@/components/home/FeaturedHotels';
import { useAuthStore } from '@/store/authStore';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/services/api/hotelApi', () => ({
  getHotels: jest.fn().mockResolvedValue({
    items: [
      {
        id: 'hotel-test-1',
        name: 'The Grand Azure Resort & Spa',
        city: 'South Beach',
        destination: 'Miami',
        starRating: 5,
        ratingScore: '4.9',
        reviewCount: 312,
        pricePerNight: 7499,
        originalPrice: 10999,
        mainImage: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
        amenities: ['Private Beach', 'Infinity Pool', 'Spa'],
        isFeatured: true,
      },
    ],
    pagination: { total: 1 },
  }),
  getFeaturedHotels: jest.fn().mockResolvedValue({
    items: [
      {
        id: 'hotel-test-1',
        name: 'The Grand Azure Resort & Spa',
        city: 'South Beach',
        destination: 'Miami',
        starRating: 5,
        ratingScore: '4.9',
        reviewCount: 312,
        pricePerNight: 7499,
        originalPrice: 10999,
        mainImage: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
        amenities: ['Private Beach', 'Infinity Pool', 'Spa'],
        isFeatured: true,
      },
    ],
    pagination: { total: 1 },
  }),
  getDestinations: jest.fn().mockResolvedValue(['Goa', 'Dubai', 'Manali', 'Paris']),
}));

jest.mock('@/services/api/couponApi', () => ({
  getActiveOffers: jest.fn().mockResolvedValue([
    {
      id: 'offer-live-1',
      code: 'LUXURY25',
      title: 'Flat 25% Off Luxury Suites',
      description: 'Valid on handpicked 5-Star resorts',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      minimumBookingAmount: 12000,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    },
  ]),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  });

  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
});

describe('HomeScreen', () => {
  it('renders the branding, title, and key sections', async () => {
    const { getByText, getAllByText } = await render(<HomeScreen />);

    // Brand header
    expect(getAllByText('TRUMITRIP').length).toBeGreaterThan(0);
    expect(getAllByText('EXPLORE MORE. EXPERIENCE BEYOND...').length).toBeGreaterThan(0);

    // Hero title
    expect(getByText(/Find the Perfect Stay/)).toBeTruthy();
    expect(getByText('for Your Next Trip')).toBeTruthy();

    // Why book with us
    expect(getByText('Why Book With Us?')).toBeTruthy();
    expect(getAllByText('Best Price Guarantee').length).toBeGreaterThan(0);
    expect(getByText('100% Secure Booking')).toBeTruthy();

    // Stats
    expect(getByText('100,000+')).toBeTruthy();
    expect(getByText('10M+')).toBeTruthy();

    // Popular destinations
    expect(getAllByText('Popular Destinations').length).toBeGreaterThan(0);

    // Offers
    expect(getAllByText('Exclusive Offers & Deals').length).toBeGreaterThan(0);

    // Top hotels
    expect(getByText('Top Luxury & Budget Stays')).toBeTruthy();

    // Secure payments
    expect(getByText('100% Safe & Secure Payments')).toBeTruthy();

    // Footer
    expect(getByText('24/7 TRAVEL CONCIERGE')).toBeTruthy();
  });

  it('navigates to search when Search Hotels button is pressed', async () => {
    const { getAllByRole } = await render(<HomeScreen />);

    const searchButtons = getAllByRole('button', { name: 'Search Hotels' });
    fireEvent.press(searchButtons[0]);

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(customer)/search',
      }),
    );
  });

  it('opens and closes the navigation drawer', async () => {
    const { getByRole, findByLabelText } = await render(<HomeScreen />);

    const menuBtn = getByRole('button', { name: 'Open navigation menu' });
    fireEvent.press(menuBtn);

    // Wait for Drawer modal to open
    const closeBtn = await findByLabelText('Close drawer');
    expect(closeBtn).toBeTruthy();

    fireEvent.press(closeBtn);
  });

  it('allows copying coupon code to clipboard with visual feedback', async () => {
    const { getAllByText, findByText } = await render(<HomeScreen />);

    // Find Copy Code button
    const copyButtons = getAllByText('Copy Code');
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.press(copyButtons[0]);

    expect(Clipboard.setStringAsync).toHaveBeenCalled();
    // Toast should appear
    await waitFor(() => {
      expect(findByText(/copied to clipboard/)).toBeTruthy();
    });
  });

  it('navigates to destination search when destination card is tapped', async () => {
    const { getByLabelText } = await render(<HomeScreen />);

    const goaCard = getByLabelText(/Goa, India/);
    fireEvent.press(goaCard);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(customer)/search',
      params: {
        destination: 'Goa',
        search: 'Goa',
      },
    });
  });

  it('filters hotels when a filter chip is pressed', async () => {
    const { getByRole, getByText, queryByText } = await render(<HomeScreen />);

    // Tap Luxury chip
    const luxuryChip = getByRole('button', { name: 'Filter by Luxury' });
    fireEvent.press(luxuryChip);
    await waitFor(() => {
      expect(queryByText('Urban Comfort Suites & Inn')).toBeNull();
    });
    expect(getByText('The Grand Azure Resort & Spa')).toBeTruthy();

    // Tap Budget chip
    const budgetChip = getByRole('button', { name: 'Filter by Budget' });
    fireEvent.press(budgetChip);
    await waitFor(() => {
      expect(queryByText('The Grand Azure Resort & Spa')).toBeNull();
    });
    expect(getByText('Urban Comfort Suites & Inn')).toBeTruthy();

    // Tap All chip
    const allChip = getByRole('button', { name: 'Filter by All' });
    fireEvent.press(allChip);
    await waitFor(() => {
      expect(getByText('The Grand Azure Resort & Spa')).toBeTruthy();
      expect(getByText('Urban Comfort Suites & Inn')).toBeTruthy();
    });
  });
});
