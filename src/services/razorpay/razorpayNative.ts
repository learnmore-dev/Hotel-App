import { DeviceEventEmitter, NativeModules, Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

export interface RazorpayNativeSpec extends TurboModule {
  open: (options: Record<string, unknown>) => void;
}

export interface NativeCheckoutOptions {
  key: string;
  order_id: string;
  amount: number; // in subunits (paise)
  currency: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: 'upi' | 'card' | 'netbanking';
  };
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  notes?: Record<string, string>;
}

export interface NativeCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class RazorpayCancelError extends Error {
  readonly isCancelled = true;
  readonly code: number;

  constructor(message = 'Payment was cancelled by the user.', code = 0) {
    super(message);
    this.name = 'RazorpayCancelError';
    this.code = code;
  }
}

/**
 * Returns the underlying native Razorpay checkout module.
 * Works seamlessly with React Native Old Architecture, New Architecture (TurboModules),
 * and Bridgeless Interoperability mode.
 */
export function getNativeRazorpayModule(): RazorpayNativeSpec | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }

  try {
    if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
      const turboModule = TurboModuleRegistry.get<RazorpayNativeSpec>('RNRazorpayCheckout');
      if (turboModule) {
        return turboModule;
      }
    }
  } catch {
    // TurboModule lookup fallback
  }

  try {
    const nm = NativeModules as Record<string, unknown> | undefined;
    if (nm && nm.RNRazorpayCheckout) {
      return nm.RNRazorpayCheckout as RazorpayNativeSpec;
    }
  } catch {
    // NativeModules lookup fallback
  }

  return null;
}

/**
 * Checks if the official Razorpay native module is linked and active in the current runtime.
 * Returns true in custom Android development builds (expo-dev-client / debug APKs) and release builds.
 * Returns false on Web and standard Expo Go sandbox environments.
 */
export function isNativeRazorpayAvailable(): boolean {
  return getNativeRazorpayModule() !== null;
}

function processRazorpayError(error: unknown): never {
  const err = error as {
    code?: number;
    description?: string;
    error?: { description?: string; reason?: string };
    message?: string;
  };

  const code = typeof err?.code === 'number' ? err.code : -1;
  const desc =
    err?.description ||
    err?.error?.description ||
    err?.error?.reason ||
    err?.message ||
    '';

  // Razorpay native SDK returns code 0 or message containing cancelled/dismissed when user closes activity
  if (
    code === 0 ||
    /cancel|dismiss|back\s*press/i.test(desc)
  ) {
    throw new RazorpayCancelError(desc || 'Payment was cancelled by the user.', code);
  }

  throw new Error(desc || 'Native payment processing failed. Please try again.');
}

/**
 * Invokes the official Razorpay native SDK checkout activity on Android/iOS.
 * Resolves with the cryptographic signature returned by the gateway.
 * Throws RazorpayCancelError if the user dismisses the native dialog without completing payment.
 */
export async function openNativeRazorpayCheckout(
  options: NativeCheckoutOptions,
): Promise<NativeCheckoutResult> {
  const nativeModule = getNativeRazorpayModule();
  if (!nativeModule) {
    throw new Error(
      'Official Razorpay native module is not linked in this runtime environment. Please run an Android development build.',
    );
  }

  // 1. Try using the official react-native-razorpay wrapper open() method
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RazorpayCheckout = require('react-native-razorpay').default;
    if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
      const data: NativeCheckoutResult = await RazorpayCheckout.open(options);
      if (!data.razorpay_payment_id || !data.razorpay_signature) {
        throw new Error('Incomplete payment response returned from Razorpay native gateway.');
      }
      return {
        razorpay_order_id: data.razorpay_order_id || options.order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      };
    }
  } catch (wrapperError: unknown) {
    // If the error was a payment error or user cancellation thrown from the native SDK, re-throw it
    if (
      wrapperError instanceof RazorpayCancelError ||
      (wrapperError as { code?: number })?.code !== undefined ||
      /cancel|dismiss|fail/i.test((wrapperError as Error)?.message || '')
    ) {
      processRazorpayError(wrapperError);
    }
    // Otherwise fallback to direct native module invocation below
  }

  // 2. Direct native module invocation with DeviceEventEmitter (resilient fallback)
  return new Promise<NativeCheckoutResult>((resolve, reject) => {
    let successSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    const cleanup = () => {
      successSub?.remove();
      errorSub?.remove();
    };

    successSub = DeviceEventEmitter.addListener('Razorpay::PAYMENT_SUCCESS', (data: NativeCheckoutResult) => {
      cleanup();
      if (!data || !data.razorpay_payment_id || !data.razorpay_signature) {
        reject(new Error('Incomplete payment response returned from Razorpay native gateway.'));
        return;
      }
      resolve({
        razorpay_order_id: data.razorpay_order_id || options.order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      });
    });

    errorSub = DeviceEventEmitter.addListener('Razorpay::PAYMENT_ERROR', (errData: unknown) => {
      cleanup();
      try {
        processRazorpayError(errData);
      } catch (err) {
        reject(err);
      }
    });

    try {
      nativeModule.open(options as unknown as Record<string, unknown>);
    } catch (launchErr) {
      cleanup();
      reject(launchErr);
    }
  });
}
