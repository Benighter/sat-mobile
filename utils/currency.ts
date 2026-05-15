const BASE_CURRENCY = 'ZAR';
const USD_CURRENCY = 'USD';
const CACHE_KEY = 'sat-mobile-exchange-rates-v2';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DISPLAY_CACHE_TTL_MS = 5 * 60 * 1000;
const OPEN_EXCHANGE_RATE_URL = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;
const FRANKFURTER_RATE_URL = `https://api.frankfurter.app/latest?from=${BASE_CURRENCY}&to=${USD_CURRENCY}`;
const CURRENCY_API_RATE_URL = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${BASE_CURRENCY.toLowerCase()}.json`;
const FALLBACK_RATES: Record<string, number> = { ZAR: 1 };

export type CurrencyRates = Record<string, number>;

export interface ExchangeRateSnapshot {
  base: string;
  fetchedAt: number;
  providerUpdatedAt?: number;
  providerNextUpdateAt?: number;
  rates: CurrencyRates;
}

export interface LoadExchangeRateOptions {
  forceRefresh?: boolean;
  maxAgeMs?: number;
}

export interface CurrencyFormatOptions {
  compact?: boolean;
  showUsdComparison?: boolean;
}

export interface CurrencyOption {
  code: string;
  label: string;
}

interface LiveRateResult {
  providerUpdatedAt?: number;
  providerNextUpdateAt?: number;
  rates: CurrencyRates;
}

let inMemorySnapshot: ExchangeRateSnapshot | null = null;
let inFlightSnapshotPromise: Promise<ExchangeRateSnapshot> | null = null;

const DEFAULT_CURRENCY_CODES = [
  'ZAR', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'BWP', 'NAD', 'MZN', 'ZMW', 'AUD', 'CAD', 'JPY', 'CNY', 'INR'
];

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const getDisplayNames = () => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' });
  } catch {
    return null;
  }
};

const isValidCurrencyCode = (currencyCode: string): boolean => CURRENCY_CODE_PATTERN.test(currencyCode);

const getCurrencyDisplayName = (displayNames: Intl.DisplayNames | null, currencyCode: string): string => {
  try {
    return displayNames?.of(currencyCode) || currencyCode;
  } catch {
    return currencyCode;
  }
};

const normalizeTimestamp = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const sanitizeRates = (rates: Record<string, number> | null | undefined): CurrencyRates => {
  const sanitizedRates: CurrencyRates = { [BASE_CURRENCY]: 1 };

  Object.entries(rates || {}).forEach(([code, rate]) => {
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      sanitizedRates[normalizedCode] = rate;
    }
  });

  sanitizedRates[BASE_CURRENCY] = 1;
  return sanitizedRates;
};

const hasUsableRate = (rates: CurrencyRates, currencyCode: string): boolean => {
  const rate = rates[normalizeCurrencyCode(currencyCode)];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
};

const parseProviderDate = (value: unknown): number | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Exchange rate request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const fetchOpenExchangeRates = async (): Promise<LiveRateResult> => {
  const payload = await fetchJson<{
    rates?: Record<string, number>;
    result?: string;
    time_last_update_unix?: number;
    time_next_update_unix?: number;
  }>(OPEN_EXCHANGE_RATE_URL);

  const rates = sanitizeRates(payload.rates);
  if (payload.result === 'error' || !hasUsableRate(rates, USD_CURRENCY)) {
    throw new Error('Open exchange rate payload is missing USD');
  }

  return {
    providerUpdatedAt: normalizeTimestamp(payload.time_last_update_unix)
      ? (payload.time_last_update_unix as number) * 1000
      : undefined,
    providerNextUpdateAt: normalizeTimestamp(payload.time_next_update_unix)
      ? (payload.time_next_update_unix as number) * 1000
      : undefined,
    rates
  };
};

const fetchFrankfurterRates = async (): Promise<LiveRateResult> => {
  const payload = await fetchJson<{
    date?: string;
    rates?: Record<string, number>;
  }>(FRANKFURTER_RATE_URL);

  const rates = sanitizeRates(payload.rates);
  if (!hasUsableRate(rates, USD_CURRENCY)) {
    throw new Error('Frankfurter payload is missing USD');
  }

  return {
    providerUpdatedAt: parseProviderDate(payload.date),
    rates
  };
};

const fetchCurrencyApiRates = async (): Promise<LiveRateResult> => {
  const payload = await fetchJson<{
    date?: string;
    zar?: Record<string, number>;
  }>(CURRENCY_API_RATE_URL);

  const lowerCaseRates = payload.zar || {};
  const rates = sanitizeRates(Object.fromEntries(
    Object.entries(lowerCaseRates).map(([code, rate]) => [code.toUpperCase(), rate])
  ));
  if (!hasUsableRate(rates, USD_CURRENCY)) {
    throw new Error('Currency API payload is missing USD');
  }

  return {
    providerUpdatedAt: parseProviderDate(payload.date),
    rates
  };
};

const fetchLiveRates = async (): Promise<LiveRateResult> => {
  const providers = [fetchOpenExchangeRates, fetchFrankfurterRates, fetchCurrencyApiRates];

  for (const fetchProvider of providers) {
    try {
      return await fetchProvider();
    } catch {
      // Try the next live provider before falling back to cached ZAR-only display.
    }
  }

  throw new Error('No live USD/ZAR exchange rate provider is available');
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

    const providerUpdatedAt = normalizeTimestamp(parsed.providerUpdatedAt);
    const providerNextUpdateAt = normalizeTimestamp(parsed.providerNextUpdateAt);

    inMemorySnapshot = {
      ...parsed,
      providerUpdatedAt,
      providerNextUpdateAt,
      rates: sanitizeRates(parsed.rates)
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

const isSnapshotFresh = (snapshot: ExchangeRateSnapshot | null, maxAgeMs: number = CACHE_TTL_MS) => {
  if (!snapshot) {
    return false;
  }

  if (typeof snapshot.providerNextUpdateAt === 'number' && Date.now() >= snapshot.providerNextUpdateAt) {
    return false;
  }

  return Date.now() - snapshot.fetchedAt < maxAgeMs;
};

export const normalizeCurrencyCode = (currencyCode?: string | null): string => {
  const normalizedCode = String(currencyCode || BASE_CURRENCY).trim().toUpperCase();
  return isValidCurrencyCode(normalizedCode) ? normalizedCode : BASE_CURRENCY;
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
    .filter((code, index, normalizedCodes) => isValidCurrencyCode(code) && normalizedCodes.indexOf(code) === index)
    .sort((left, right) => {
      const leftName = getCurrencyDisplayName(displayNames, left);
      const rightName = getCurrencyDisplayName(displayNames, right);
      return leftName.localeCompare(rightName);
    })
    .map(code => ({
      code,
      label: `${getCurrencyDisplayName(displayNames, code)} (${code})`
    }));
};

export const getCurrencySelectionSnapshot = (): ExchangeRateSnapshot => {
  const cachedSnapshot = readCachedSnapshot();
  if (cachedSnapshot && isSnapshotFresh(cachedSnapshot, DISPLAY_CACHE_TTL_MS) && hasUsableRate(cachedSnapshot.rates, USD_CURRENCY)) {
    return cachedSnapshot;
  }

  return buildFallbackSnapshot();
};

export const loadExchangeRates = async (options: LoadExchangeRateOptions = {}): Promise<ExchangeRateSnapshot> => {
  const { forceRefresh = false, maxAgeMs = CACHE_TTL_MS } = options;
  const cachedSnapshot = readCachedSnapshot();
  if (!forceRefresh && isSnapshotFresh(cachedSnapshot, maxAgeMs) && hasUsableRate(cachedSnapshot?.rates || {}, USD_CURRENCY)) {
    return cachedSnapshot as ExchangeRateSnapshot;
  }

  if (inFlightSnapshotPromise) {
    return inFlightSnapshotPromise;
  }

  inFlightSnapshotPromise = (async () => {
    try {
      const liveRateResult = await fetchLiveRates();

      const snapshot: ExchangeRateSnapshot = {
        base: BASE_CURRENCY,
        fetchedAt: Date.now(),
        providerUpdatedAt: liveRateResult.providerUpdatedAt,
        providerNextUpdateAt: liveRateResult.providerNextUpdateAt,
        rates: liveRateResult.rates
      };

      writeCachedSnapshot(snapshot);
      return snapshot;
    } catch {
      const staleSnapshot = readCachedSnapshot();
      if (staleSnapshot && hasUsableRate(staleSnapshot.rates, USD_CURRENCY)) {
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
    return normalizedCode === BASE_CURRENCY ? normalizedAmount : Number.NaN;
  }

  return normalizedAmount * rate;
};

export const getZarPerUsdRate = (rates: CurrencyRates): number | null => {
  const usdRate = rates[USD_CURRENCY];
  if (typeof usdRate !== 'number' || !Number.isFinite(usdRate) || usdRate <= 0) {
    return null;
  }

  return 1 / usdRate;
};

export const formatZarPerUsdRate = (rates: CurrencyRates): string | null => {
  const zarPerUsdRate = getZarPerUsdRate(rates);
  if (!zarPerUsdRate) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(zarPerUsdRate);
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
  const convertedAmount = convertFromZar(amount, normalizedCurrency, rates);
  if (!Number.isFinite(convertedAmount)) {
    return formatCurrencyValue(amount, BASE_CURRENCY);
  }

  return formatCurrencyValue(convertedAmount, normalizedCurrency);
};

export const formatUsdAmount = (amount: number, rates: CurrencyRates): string | null => {
  const convertedAmount = convertFromZar(amount, USD_CURRENCY, rates);
  if (!Number.isFinite(convertedAmount)) {
    return null;
  }

  return formatCurrencyValue(convertedAmount, USD_CURRENCY);
};

export const formatIncomeDisplay = (
  amount: number,
  preferredCurrency: string,
  rates: CurrencyRates,
  options: CurrencyFormatOptions = {}
): string => {
  const normalizedCurrency = normalizeCurrencyCode(preferredCurrency);
  const primaryAmount = formatPrimaryCurrencyAmount(amount, normalizedCurrency, rates);

  if (normalizedCurrency === USD_CURRENCY || !options.showUsdComparison) {
    return primaryAmount;
  }

  const usdAmount = formatUsdAmount(amount, rates);
  if (!usdAmount) {
    return `${primaryAmount}${options.compact ? '' : ' '}(updating USD...)`;
  }

  const separator = options.compact ? '' : ' ';
  return `${primaryAmount}${separator}(${usdAmount})`;
};

export const BASE_MONEY_CURRENCY = BASE_CURRENCY;
export const USD_MONEY_CURRENCY = USD_CURRENCY;
