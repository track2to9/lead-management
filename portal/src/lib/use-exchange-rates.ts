"use client";

import { useState, useEffect } from "react";

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface RefRates {
  USD_CNY: number;
  USD_KRW: number;
  date: string;
  loading: boolean;
}

/**
 * Fetch reference exchange rates from Frankfurter API (ECB-based, free, no key).
 * Returns USD→CNY and USD→KRW for display as read-only reference.
 */
export function useRefExchangeRates(): RefRates {
  const [data, setData] = useState<RefRates>({ USD_CNY: 0, USD_KRW: 0, date: "", loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,KRW")
      .then((r) => r.json())
      .then((json: FrankfurterResponse) => {
        if (cancelled) return;
        setData({
          USD_CNY: json.rates?.CNY || 0,
          USD_KRW: json.rates?.KRW || 0,
          date: json.date || "",
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      });
    return () => { cancelled = true; };
  }, []);

  return data;
}
