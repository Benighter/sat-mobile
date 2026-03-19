import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../contexts/FirebaseAppContext';
import {
  CurrencyFormatOptions,
  CurrencyOption,
  ExchangeRateSnapshot,
  formatIncomeDisplay,
  formatPrimaryCurrencyAmount,
  formatUsdAmount,
  getCurrencyOptions,
  getCurrencySelectionSnapshot,
  loadExchangeRates,
  normalizeCurrencyCode
} from '../utils/currency';

export const useCurrencyFormatter = () => {
  const { userProfile } = useAppContext();
  const [snapshot, setSnapshot] = useState<ExchangeRateSnapshot>(() => getCurrencySelectionSnapshot());

  useEffect(() => {
    let isActive = true;

    loadExchangeRates().then(nextSnapshot => {
      if (isActive) {
        setSnapshot(nextSnapshot);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const preferredCurrency = normalizeCurrencyCode(userProfile?.preferences?.preferredCurrency);

  const currencyOptions = useMemo<CurrencyOption[]>(() => getCurrencyOptions(snapshot.rates), [snapshot.rates]);

  const formatIncomeAmount = useCallback((amount: number, options?: CurrencyFormatOptions) => {
    return formatIncomeDisplay(amount, preferredCurrency, snapshot.rates, options);
  }, [preferredCurrency, snapshot.rates]);

  const formatPrimaryAmount = useCallback((amount: number) => {
    return formatPrimaryCurrencyAmount(amount, preferredCurrency, snapshot.rates);
  }, [preferredCurrency, snapshot.rates]);

  const formatDollarAmount = useCallback((amount: number) => {
    return formatUsdAmount(amount, snapshot.rates);
  }, [snapshot.rates]);

  return {
    currencyOptions,
    formatDollarAmount,
    formatIncomeAmount,
    formatPrimaryAmount,
    preferredCurrency,
    rates: snapshot.rates,
    showsUsdOnly: preferredCurrency === 'USD'
  };
};

export default useCurrencyFormatter;