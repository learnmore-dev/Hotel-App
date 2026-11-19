import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { LoginAccountScreen } from '@/components/auth/LoginAccountScreen';
import { ApiRequestError } from '@/services/api/client';
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

describe('LoginAccountScreen', () => {
  it('renders the luxury header, subtitle, and close button', async () => {
    const { getByRole, getByText } = await render(<LoginAccountScreen />);

    expect(getByRole('header')).toBeTruthy();
    expect(getByText('Account Login')).toBeTruthy();
    expect(getByText('TRUMITRIP Luxury Hotel Booking Portal')).toBeTruthy();
    expect(getByRole('button', { name: 'Close login' })).toBeTruthy();
  });

  it('renders email and password input fields with correct placeholders', async () => {
    const { getByPlaceholderText, getByText } = await render(<LoginAccountScreen />);

    expect(getByText('Email Address')).toBeTruthy();
    expect(getByPlaceholderText('name@domain.com')).toBeTruthy();

    expect(getByText('Password')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();

    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('renders the Sign In To Account button and Sign Up Now navigation link', async () => {
    const { getByRole, getByText } = await render(<LoginAccountScreen />);

    expect(getByRole('button', { name: 'Sign In To Account' })).toBeTruthy();
    expect(getByText("Don't have an account? ")).toBeTruthy();
    expect(getByText('Sign Up Now')).toBeTruthy();
  });

  it('validates required fields on submission', async () => {
    const { getByRole, getByText } = await render(<LoginAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Sign In To Account' }));

    await waitFor(() => {
      expect(getByText('Enter your email address.')).toBeTruthy();
      expect(getByText('Enter your password.')).toBeTruthy();
    });
  });

  it('validates email format and clears error on input', async () => {
    const { getByPlaceholderText, getByRole, getByText, queryByText } = await render(
      <LoginAccountScreen />
    );

    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), 'invalid-email');
    await fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Pass1234');
    await fireEvent.press(getByRole('button', { name: 'Sign In To Account' }));

    await waitFor(() => {
      expect(getByText('Enter a valid email address.')).toBeTruthy();
    });

    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), 'valid@domain.com');
    expect(queryByText('Enter a valid email address.')).toBeNull();
  });

  it('toggles password visibility', async () => {
    const { getByLabelText, getByPlaceholderText } = await render(<LoginAccountScreen />);
    const passwordInput = getByPlaceholderText('Enter your password');
    const toggleButton = getByLabelText('Show password');

    expect(passwordInput.props.secureTextEntry).toBe(true);

    await fireEvent.press(toggleButton);
    expect(passwordInput.props.secureTextEntry).toBe(false);

    await fireEvent.press(getByLabelText('Hide password'));
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('navigates back when close button is pressed', async () => {
    const { getByRole } = await render(<LoginAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Close login' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to Forgot Password when link is pressed', async () => {
    const { getByRole } = await render(<LoginAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Forgot password?' }));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('navigates to Sign Up screen when Sign Up Now is pressed', async () => {
    const { getByRole } = await render(<LoginAccountScreen />);

    await fireEvent.press(getByRole('button', { name: 'Sign Up Now' }));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/signup');
  });

  it('submits login successfully and navigates to user home', async () => {
    const loginMock = jest.fn().mockImplementation(async () => {
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
        token: 'test-access-token',
        isAuthenticated: true,
      });
    });

    useAuthStore.setState({ login: loginMock });

    const { getByPlaceholderText, getByRole } = await render(<LoginAccountScreen />);

    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), ' Altaf@Example.com ');
    await fireEvent.changeText(getByPlaceholderText('Enter your password'), 'Secret123!');

    await fireEvent.press(getByRole('button', { name: 'Sign In To Account' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: 'altaf@example.com',
        password: 'Secret123!',
      });
      expect(mockReplace).toHaveBeenCalledWith('/(customer)/home');
    });
  });

  it('displays API error banner when login fails', async () => {
    const loginMock = jest.fn().mockImplementation(async () => {
      throw new ApiRequestError('Invalid credentials. Please verify your email and password.', 401);
    });

    useAuthStore.setState({ login: loginMock });

    const { getByPlaceholderText, getByRole, getByText } = await render(<LoginAccountScreen />);

    await fireEvent.changeText(getByPlaceholderText('name@domain.com'), 'user@domain.com');
    await fireEvent.changeText(getByPlaceholderText('Enter your password'), 'WrongPassword1');

    await fireEvent.press(getByRole('button', { name: 'Sign In To Account' }));

    await waitFor(() => {
      expect(
        getByText('Invalid credentials. Please verify your email and password.')
      ).toBeTruthy();
    });
  });
});
