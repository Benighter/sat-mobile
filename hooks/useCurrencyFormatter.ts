import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import { isCampusShepherd } from '../utils/permissionUtils';
import {
  CurrencyFormatOptions,
  CurrencyOption,
  ExchangeRateSnapshot,
  formatIncomeDisplay,
  formatPrimaryCurrencyAmount,
  formatUsdAmount,
  getZarPerUsdRate,
  getCurrencyOptions,
  getCurrencySelectionSnapshot,
  loadExchangeRates,
  normalizeCurrencyCode
} from '../utils/currency';

const ACTIVE_RATE_MAX_AGE_MS = 5 * 60 * 1000;
const RESUME_RATE_MAX_AGE_MS = 60 * 1000;
const RATE_SYNC_INTERVAL_MS = 60 * 1000;

export const useCurrencyFormatter = () => {
  const { userProfile } = useAppContext();
  const [snapshot, setSnapshot] = useState<ExchangeRateSnapshot>(() => getCurrencySelectionSnapshot());
  const canUseCurrencyExchange = isCampusShepherd(userProfile);

  useEffect(() => {
    if (!canUseCurrencyExchange) {
      setSnapshot(getCurrencySelectionSnapshot());
      return;
    }

    let isActive = true;

    const updateSnapshot = (nextSnapshot: ExchangeRateSnapshot) => {
      if (isActive) {
        setSnapshot(currentSnapshot => (
          currentSnapshot.fetchedAt > nextSnapshot.fetchedAt ? currentSnapshot : nextSnapshot
        ));
      }
    };

    const syncRates = (maxAgeMs: number) => {
      loadExchangeRates({ maxAgeMs }).then(updateSnapshot);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncRates(RESUME_RATE_MAX_AGE_MS);
      }
    };

    syncRates(ACTIVE_RATE_MAX_AGE_MS);

    const intervalId = window.setInterval(() => {
      syncRates(ACTIVE_RATE_MAX_AGE_MS);
    }, RATE_SYNC_INTERVAL_MS);

    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('online', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('online', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canUseCurrencyExchange]);

  const preferredCurrency = canUseCurrencyExchange
    ? normalizeCurrencyCode(userProfile?.preferences?.preferredCurrency)
    : 'ZAR';

  const currencyOptions = useMemo<CurrencyOption[]>(() => getCurrencyOptions(snapshot.rates), [snapshot.rates]);
  const zarPerUsdRate = useMemo(() => getZarPerUsdRate(snapshot.rates), [snapshot.rates]);

  const formatIncomeAmount = useCallback((amount: number, options?: CurrencyFormatOptions) => {
    return formatIncomeDisplay(amount, preferredCurrency, snapshot.rates, {
      ...options,
      showUsdComparison: canUseCurrencyExchange && (options?.showUsdComparison ?? true)
    });
  }, [canUseCurrencyExchange, preferredCurrency, snapshot.rates]);

  const formatPrimaryAmount = useCallback((amount: number) => {
    return formatPrimaryCurrencyAmount(amount, preferredCurrency, snapshot.rates);
  }, [preferredCurrency, snapshot.rates]);

  const formatDollarAmount = useCallback((amount: number) => {
    return formatUsdAmount(amount, snapshot.rates);
  }, [snapshot.rates]);

  return {
    currencyOptions,
    canUseCurrencyExchange,
    formatDollarAmount,
    formatIncomeAmount,
    formatPrimaryAmount,
    preferredCurrency,
    rates: snapshot.rates,
    zarPerUsdRate,
    showsUsdOnly: canUseCurrencyExchange && preferredCurrency === 'USD'
  };
};

export default useCurrencyFormatter;