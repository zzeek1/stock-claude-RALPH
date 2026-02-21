export type CurrencyCode = 'CNY' | 'HKD' | 'USD';

export interface FxRates {
  USD: number;
  HKD: number;
  CNY: number;
  timestamp: string;
}

export const APP_CURRENCY_KEY = 'app.displayCurrency';

export function isCurrencyCode(value: string | null): value is CurrencyCode {
  return value === 'CNY' || value === 'HKD' || value === 'USD';
}

export function readCurrencyPreference(): CurrencyCode {
  try {
    const saved = localStorage.getItem(APP_CURRENCY_KEY);
    if (isCurrencyCode(saved)) {
      return saved;
    }
  } catch {
    // ignore localStorage read errors
  }
  return 'USD';
}

export function persistCurrencyPreference(currency: CurrencyCode): void {
  try {
    localStorage.setItem(APP_CURRENCY_KEY, currency);
  } catch {
    // ignore localStorage write errors
  }
}

export function marketCurrency(market: string): CurrencyCode {
  if (market === 'HK') return 'HKD';
  if (market === 'US') return 'USD';
  return 'CNY';
}

export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode, rates?: FxRates): number {
  if (!rates || from === to) return amount;
  const byUsd: Record<CurrencyCode, number> = {
    USD: rates.USD,
    HKD: rates.HKD,
    CNY: rates.CNY,
  };
  const inUsd = amount / byUsd[from];
  return inUsd * byUsd[to];
}

export function currencySymbol(currency: CurrencyCode): string {
  if (currency === 'USD') return '$';
  if (currency === 'HKD') return 'HK$';
  return '¥';
}
