import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { CreateCustomerAccountScreen } from '@/components/auth/CreateCustomerAccountScreen';
import { useAuthStore } from '@/store/authStore';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.setTimeout(15000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
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

describe('CreateCustomerAccountScreen', () => {
  it('renders the luxury header, subtitle, and close button', async () => {
    const { getByRole, getByText } = await render(<CreateCustomerAccountScreen />);

    expect(getByRole('header')).toBeTruthy();
    expect(getByText('Create Customer Account')).toBeTruthy();
    expect(getByText('TRUMITRIP Luxury Hotel Booking Portal')).toBeTruthy();
    expect(getByRole('button', { name: 'Close registration' })).toBeTruthy();
  });

  it('renders all four input fields in correct order with placeholders', async () => {
    const { getByPlaceholderText, getByText } = await render(<CreateCustomerAccountScreen />);

    expect(getByText(/Full Name/)).toBeTruthy();
    expect(getByPlaceholderText('e.g. Alt af Fateh')).toBeTruthy();

    expect(getByText(/Email Address/)).toBeTruthy();
    expect(getByPlaceholderText('name@domain.com')).toBeTruthy();

    expect(getByText('Mobile Phone Number')).toBeTruthy();
    expect(getByPlaceholderText('Enter mobile number')).toBeTruthy();

    expect(getByText(/Create Password/)).toBeTruthy();
    expect(getByPlaceholderText('Enter password')).toBeTruthy();
  });

  it('renders the Complete Registration button and Login Instead navigation link', async () => {
    const { getByRole, getByText } = await render(<CreateCustomerAccountScreen />);

    expect(getByRole('button', { name: 'Complete Registration' })).toBeTruthy();
    expect(getByText('Already have an account? ')).toBeTruthy();
    expect(getByText('Login Instead')).toBeTruthy();
  });

  it('validates required fields on submission', async () => {
    const { getByRole, getByText } = await render(<CreateCustomerAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Complete Registration' }));

    await waitFor(() => {
      expect(getByText('Full name is required.')).toBeTruthy();
      expect(getByText('Email address is required.')).toBeTruthy();
      expect(getByText('Enter your password.')).toBeTruthy();
    });
  });

  it('validates email format, phone format, and password requirements', async () => {
    const { getByPlaceholderText, getByRole, getByText } = await render(
      <CreateCustomerAccountScreen />
    );

    await fireEvent.changeText(getByPlaceholderText('e.g. Alt af Fateh'), 'Altaf Fateh');
    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), 'invalid-email');
    await fireEvent.changeText(getByPlaceholderText('Enter mobile number'), 'abc123');
    await fireEvent.changeText(getByPlaceholderText('Enter password'), 'weak');

    await fireEvent.press(getByRole('button', { name: 'Complete Registration' }));

    await waitFor(() => {
      expect(getByText('Enter a valid email address.')).toBeTruthy();
      expect(getByText('Enter a valid phone number.')).toBeTruthy();
      expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
    });

    await fireEvent.changeText(getByPlaceholderText('Enter password'), 'nouppercase1');
    await fireEvent.press(getByRole('button', { name: 'Complete Registration' }));

    await waitFor(() => {
      expect(getByText('Password must include uppercase, lowercase, and a number.')).toBeTruthy();
    });
  });

  it('toggles password visibility', async () => {
    const { getByLabelText, getByPlaceholderText } = await render(<CreateCustomerAccountScreen />);
    const passwordInput = getByPlaceholderText('Enter password');
    const toggleButton = getByLabelText('Show password');

    expect(passwordInput.props.secureTextEntry).toBe(true);

    await fireEvent.press(toggleButton);
    expect(passwordInput.props.secureTextEntry).toBe(false);

    await fireEvent.press(getByLabelText('Hide password'));
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('navigates back or to home when close button is pressed', async () => {
    const { getByRole } = await render(<CreateCustomerAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Close registration' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to Login screen when Login Instead is pressed', async () => {
    const { getByText } = await render(<CreateCustomerAccountScreen />);

    await fireEvent.press(getByText('Login Instead'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('submits registration successfully and navigates to user home', async () => {
    const registerMock = jest.fn().mockImplementation(async () => {
      useAuthStore.setState({
        user: {
          id: 'u1',
          fullName: 'Altaf Fateh',
          email: 'altaf@example.com',
          phone: '+15551234567',
          role: 'CUSTOMER',
          avatar: null,
          isActive: true,
          isEmailVerified: true,
          createdAt: '2026-10-30T00:00:00.000Z',
          updatedAt: '2026-10-30T00:00:00.000Z',
        },
        token: 'test-token',
        isAuthenticated: true,
      });
    });

    useAuthStore.setState({ register: registerMock });

    const { getByPlaceholderText, getByRole } = await render(<CreateCustomerAccountScreen />);

    await fireEvent.changeText(getByPlaceholderText('e.g. Alt af Fateh'), 'Altaf Fateh');
    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), 'altaf@example.com');
    await fireEvent.changeText(getByPlaceholderText('Enter mobile number'), '+15551234567');
    await fireEvent.changeText(getByPlaceholderText('Enter password'), 'Password123!');

    await fireEvent.press(getByRole('button', { name: 'Complete Registration' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        fullName: 'Altaf Fateh',
        email: 'altaf@example.com',
        phone: '+15551234567',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      expect(mockReplace).toHaveBeenCalledWith('/(customer)/home');
    });
  });
});
