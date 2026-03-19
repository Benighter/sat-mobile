const BASE_CURRENCY = 'ZAR';
const USD_CURRENCY = 'USD';
const CACHE_KEY = 'sat-mobile-exchange-rates-v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FALLBACK_RATES: Record<string, number> = {
  ZAR: 1,
  USD: 1 / 16.88
};

export type CurrencyRates = Record<string, number>;

export interface ExchangeRateSnapshot {
  base: string;
  fetchedAt: number;
  rates: CurrencyRates;
}

export interface CurrencyFormatOptions {
  compact?: boolean;
}

export interface CurrencyOption {
  code: string;
  label: string;
}

let inMemorySnapshot: ExchangeRateSnapshot | null = null;
let inFlightSnapshotPromise: Promise<ExchangeRateSnapshot> | null = null;

const DEFAULT_CURRENCY_CODES = [
  'ZAR', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'BWP', 'NAD', 'MZN', 'ZMW', 'AUD', 'CAD', 'JPY', 'CNY', 'INR'
];

const getDisplayNames = () => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' });
  } catch {
    return null;
  }
};

const readCachedSnapshot = (): ExchangeRateSnapshot | null => {
  if (inMemorySnapshot) {
    return inMemorySnapshot;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ExchangeRateSnapshot;
    if (!parsed || parsed.base !== BASE_CURRENCY || typeof parsed.fetchedAt !== 'number' || !parsed.rates) {
      return null;
    }

    inMemorySnapshot = {
      ...parsed,
      rates: {
        ...parsed.rates,
        [BASE_CURRENCY]: 1,
        [USD_CURRENCY]: parsed.rates[USD_CURRENCY] ?? FALLBACK_RATES[USD_CURRENCY]
      }
    };

    return inMemorySnapshot;
  } catch {
    return null;
  }
};

const writeCachedSnapshot = (snapshot: ExchangeRateSnapshot) => {
  inMemorySnapshot = snapshot;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota failures and continue with in-memory cache.
  }
};

const buildFallbackSnapshot = (): ExchangeRateSnapshot => ({
  base: BASE_CURRENCY,
  fetchedAt: Date.now(),
  rates: { ...FALLBACK_RATES }
});

const isSnapshotFresh = (snapshot: ExchangeRateSnapshot | null) => {
  if (!snapshot) {
    return false;
  }

  return Date.now() - snapshot.fetchedAt < CACHE_TTL_MS;
};

export const normalizeCurrencyCode = (currencyCode?: string | null): string => {
  const normalizedCode = String(currencyCode || BASE_CURRENCY).trim().toUpperCase();
  return normalizedCode || BASE_CURRENCY;
};

export const getAllCurrencyCodes = (): string[] => {
  const codes = new Set<string>(DEFAULT_CURRENCY_CODES);
  const cachedSnapshot = readCachedSnapshot();

  Object.keys(cachedSnapshot?.rates || {}).forEach(code => codes.add(code));

  try {
    const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    supportedValuesOf?.('currency').forEach(code => codes.add(code.toUpperCase()));
  } catch {
    // Older environments may not support Intl.supportedValuesOf.
  }

  codes.add(BASE_CURRENCY);
  codes.add(USD_CURRENCY);

  return Array.from(codes);
};

export const getCurrencyOptions = (rates?: CurrencyRates): CurrencyOption[] => {
  const displayNames = getDisplayNames();
  const codes = new Set<string>(getAllCurrencyCodes());

  Object.keys(rates || {}).forEach(code => codes.add(code));

  return Array.from(codes)
    .map(code => normalizeCurrencyCode(code))
    .sort((left, right) => {
      const leftName = displayNames?.of(left) || left;
      const rightName = displayNames?.of(right) || right;
      return leftName.localeCompare(rightName);
    })
    .map(code => ({
      code,
      label: `${displayNames?.of(code) || code} (${code})`
    }));
};

export const getCurrencySelectionSnapshot = (): ExchangeRateSnapshot => {
  return readCachedSnapshot() || buildFallbackSnapshot();
};

export const loadExchangeRates = async (): Promise<ExchangeRateSnapshot> => {
  const cachedSnapshot = readCachedSnapshot();
  if (isSnapshotFresh(cachedSnapshot)) {
    return cachedSnapshot as ExchangeRateSnapshot;
  }

  if (inFlightSnapshotPromise) {
    return inFlightSnapshotPromise;
  }

  inFlightSnapshotPromise = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/ZAR');
      if (!response.ok) {
        throw new Error(`Exchange rate request failed with ${response.status}`);
      }

      const payload = await response.json() as { rates?: Record<string, number>; result?: string };
      if (payload.result === 'error' || !payload.rates || typeof payload.rates.USD !== 'number') {
        throw new Error('Exchange rate payload is missing rates');
      }

      const snapshot: ExchangeRateSnapshot = {
        base: BASE_CURRENCY,
        fetchedAt: Date.now(),
        rates: {
          ...payload.rates,
          [BASE_CURRENCY]: 1,
          [USD_CURRENCY]: payload.rates[USD_CURRENCY]
        }
      };

      writeCachedSnapshot(snapshot);
      return snapshot;
    } catch {
      const staleSnapshot = readCachedSnapshot();
      if (staleSnapshot) {
        return staleSnapshot;
      }

      return buildFallbackSnapshot();
    } finally {
      inFlightSnapshotPromise = null;
    }
  })();

  return inFlightSnapshotPromise;
};

export const convertFromZar = (amount: number, currencyCode: string, rates: CurrencyRates): number => {
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedCode = normalizeCurrencyCode(currencyCode);

  if (normalizedCode === BASE_CURRENCY) {
    return normalizedAmount;
  }

  const rate = rates[normalizedCode];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return normalizedAmount;
  }

  return normalizedAmount * rate;
};

const formatCurrencyValue = (amount: number, currencyCode: string): string => {
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedCode = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCode,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(normalizedAmount);
  } catch {
    return `${normalizedCode} ${normalizedAmount.toFixed(2)}`;
  }
};

export const formatPrimaryCurrencyAmount = (amount: number, preferredCurrency: string, rates: CurrencyRates): string => {
  const normalizedCurrency = normalizeCurrencyCode(preferredCurrency);
  return formatCurrencyValue(convertFromZar(amount, normalizedCurrency, rates), normalizedCurrency);
};

export const formatUsdAmount = (amount: number, rates: CurrencyRates): string => {
  return formatCurrencyValue(convertFromZar(amount, USD_CURRENCY, rates), USD_CURRENCY);
};

export const formatIncomeDisplay = (
  amount: number,
  preferredCurrency: string,
  rates: CurrencyRates,
  options: CurrencyFormatOptions = {}
): string => {
  const normalizedCurrency = normalizeCurrencyCode(preferredCurrency);
  const primaryAmount = formatPrimaryCurrencyAmount(amount, normalizedCurrency, rates);

  if (normalizedCurrency === USD_CURRENCY) {
    return primaryAmount;
  }

  const separator = options.compact ? '' : ' ';
  return `${primaryAmount}${separator}(${formatUsdAmount(amount, rates)})`;
};

export const BASE_MONEY_CURRENCY = BASE_CURRENCY;
export const USD_MONEY_CURRENCY = USD_CURRENCY;