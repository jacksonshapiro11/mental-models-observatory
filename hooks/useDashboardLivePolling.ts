'use client';

import { useEffect, useRef, useState } from 'react';
import { getDashboardPollIntervalMs, type MarketStatus } from '@/lib/market-hours';

const FALLBACK_INTERVAL_MS = 60_000;

type LiveMeta = {
  marketStatus?: MarketStatus;
  pollIntervalMs?: number;
};

/**
 * Fetches /api/dashboard/live on an adaptive schedule.
 * Uses server-provided pollIntervalMs when available; falls back to ET market-hours heuristics.
 */
export function useDashboardLivePolling<T = unknown>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalMsRef = useRef(FALLBACK_INTERVAL_MS);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = (ms: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void fetchData();
      }, ms);
    };

    const fetchData = async () => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/dashboard/live');
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const json = (await res.json()) as T & { meta?: LiveMeta };
        if (cancelled) return;
        setData(json);

        const marketStatus = json.meta?.marketStatus;
        const nextMs =
          json.meta?.pollIntervalMs ?? getDashboardPollIntervalMs(marketStatus);
        intervalMsRef.current = nextMs;
        scheduleNext(nextMs);
      } catch {
        if (!cancelled) scheduleNext(intervalMsRef.current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { data, loading };
}
