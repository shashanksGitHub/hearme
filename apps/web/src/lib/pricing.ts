import type { Locale } from '@/i18n/routing';

export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'JPY';

/** Which currency to show for each marketing locale. */
export const CURRENCY_BY_LOCALE: Record<Locale, CurrencyCode> = {
  en: 'USD',
  hi: 'INR',
  de: 'EUR',
  es: 'EUR',
  fr: 'EUR',
  ar: 'USD',
  pt: 'EUR',
  ja: 'JPY',
};

interface CurrencyConfig {
  symbol: string;
  /** Plan prices in this currency — clean local numbers, not raw FX. */
  basic: number;
  pro: number;
  /** No decimals for INR/JPY. */
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { symbol: '$', basic: 9.99, pro: 19.99, decimals: 2 },
  INR: { symbol: '₹', basic: 799, pro: 1599, decimals: 0 },
  EUR: { symbol: '€', basic: 9.99, pro: 19.99, decimals: 2 },
  JPY: { symbol: '¥', basic: 1500, pro: 2900, decimals: 0 },
};

export function currencyForLocale(locale: Locale): CurrencyConfig & { code: CurrencyCode } {
  const code = CURRENCY_BY_LOCALE[locale] ?? 'USD';
  return { code, ...CURRENCIES[code] };
}

/** Format an amount in the given currency, e.g. 799 → "₹799", 9.99 → "$9.99". */
export function formatPrice(amount: number, c: CurrencyConfig): string {
  if (amount === 0) return `${c.symbol}0`;
  return `${c.symbol}${amount.toFixed(c.decimals)}`;
}
