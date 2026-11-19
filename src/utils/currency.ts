/**
 * Universal Currency Formatter for TrumiTrip.
 * Ensures consistent currency and amount formatting across checkout, booking details,
 * payment history, partner earnings, refunds, and confirmation screens.
 *
 * Uses INR formatting (₹) for INR amounts with standard numbering,
 * while preserving appropriate symbols and codes for USD ($), EUR (€), GBP (£), etc.
 */

export const DEFAULT_CURRENCY = 'INR';

export interface CurrencyFormatOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showCode?: boolean;
}

const SYMBOL_MAP: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
  AED: 'AED',
  SGD: 'S$',
};

/**
 * Returns the currency symbol for a given 3-letter currency code.
 * Defaults to INR (₹) when no currency code is provided.
 */
export function getCurrencySymbol(currency?: string): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase().trim();
  return SYMBOL_MAP[code] || code;
}

/**
 * Formats a monetary amount into a localized currency string.
 *
 * Examples:
 *   formatCurrency(840, 'INR')        => "₹840.00"
 *   formatCurrency(840, 'USD')        => "$840.00"
 *   formatCurrency(840)               => "₹840.00"
 *   formatCurrency(84000, { currency: 'INR', minimumFractionDigits: 0 }) => "₹84,000"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyOrOptions?: string | CurrencyFormatOptions,
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '—';
  }

  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) {
    return '—';
  }

  const options: CurrencyFormatOptions =
    typeof currencyOrOptions === 'string'
      ? { currency: currencyOrOptions }
      : (currencyOrOptions ?? {});

  const currencyCode = (options.currency || DEFAULT_CURRENCY).toUpperCase().trim();
  const minDecimals = options.minimumFractionDigits ?? 2;
  const maxDecimals = options.maximumFractionDigits ?? 2;

  let formattedNumber: string;
  try {
    const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    formattedNumber = num.toLocaleString(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
  } catch {
    formattedNumber = num.toFixed(maxDecimals);
  }

  const symbol = getCurrencySymbol(currencyCode);

  // If the symbol is the 3-letter code itself (e.g. AED, SGD), include a space
  if (symbol === currencyCode) {
    return `${currencyCode} ${formattedNumber}`;
  }

  if (options.showCode) {
    return `${symbol}${formattedNumber} ${currencyCode}`;
  }

  return `${symbol}${formattedNumber}`;
}
