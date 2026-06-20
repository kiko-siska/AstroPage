// Shared data-loading hook on top of the session cache (`./cache`).
//
// Every data page wants the same three things:
//   1. instant render when returning to a tab whose data is still cached,
//   2. a manual reload button,
//   3. automatic refresh once the cached data is older than its TTL.
//
// `useCachedResource` provides all three. It seeds state synchronously from the
// cache (no loading flash on a hit), refetches in the background when the cache
// is stale on mount, re-fetches when the TTL elapses while the page is open, and
// when the browser tab regains focus with stale data. `refresh()` forces a
// reload regardless of freshness.

import { useCallback, useEffect, useRef, useState } from "react";

import { cacheTimestamp, cachedFetch, DEFAULT_TTL, invalidate, peekCache, setCache } from "./cache";

export interface CachedResource<T> {
  /** Current data, or undefined before the first successful load. */
  data: T | undefined;
  /** True only during the initial load with nothing cached to show yet. */
  loading: boolean;
  /** True while a background/manual refetch runs with data already on screen. */
  refreshing: boolean;
  error: string | null;
  /** Timestamp (ms) of the data currently held, or null. */
  lastUpdated: number | null;
  /** Force a reload now, bypassing the cache. */
  refresh: () => void;
  /** Replace the cached + local data without a network call (post-mutation).
   *  Accepts a value or an updater (latest value in, like React's setState). */
  mutate: (next: T | ((prev: T | undefined) => T)) => void;
}

interface Options {
  ttl?: number;
  errorFallback?: string;
}

export function useCachedResource<T>(
  key: string,
  loader: () => Promise<T>,
  { ttl = DEFAULT_TTL, errorFallback = "Couldn't load data." }: Options = {},
): CachedResource<T> {
  const [data, setData] = useState<T | undefined>(() => peekCache<T>(key, ttl));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(() => cacheTimestamp(key) ?? null);

  // Derived, not stored: we have nothing to show yet and no error to explain it.
  const loading = data === undefined && error === null;

  // Keep the latest loader without re-running effects; updated in an effect so we
  // never mutate a ref during render.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  // Guards, only ever touched inside callbacks/effects (never during render).
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  // The fetch itself sets state only from async callbacks, so it can be called
  // straight from an effect without tripping the set-state-in-effect rule.
  const runFetch = useCallback(
    (force: boolean) => {
      if (busyRef.current) return;
      if (force) invalidate(key);
      busyRef.current = true;
      cachedFetch<T>(key, () => loaderRef.current(), ttl)
        .then((d) => {
          if (!mountedRef.current) return;
          setData(d);
          setError(null);
          setLastUpdated(cacheTimestamp(key) ?? Date.now());
        })
        .catch((err: { detail?: string }) => {
          if (mountedRef.current) setError(err?.detail ?? errorFallback);
        })
        .finally(() => {
          busyRef.current = false;
          if (mountedRef.current) setRefreshing(false);
        });
    },
    [key, ttl, errorFallback],
  );

  // Visible forced refresh — only ever called from event handlers / timers, so
  // its synchronous setState is fine (it's never in an effect body).
  const forceRefresh = useCallback(() => {
    if (busyRef.current) return;
    setRefreshing(true);
    runFetch(true);
  }, [runFetch]);

  // Initial load (and whenever the key changes). `cachedFetch` only hits the
  // network when the cache is stale, so a fresh key resolves on the next tick.
  useEffect(() => {
    mountedRef.current = true;
    runFetch(false);
    return () => {
      mountedRef.current = false;
    };
  }, [runFetch]);

  // Auto-refresh when the data crosses its TTL while the page stays open.
  useEffect(() => {
    if (lastUpdated === null) return;
    const age = Date.now() - lastUpdated;
    const timer = window.setTimeout(forceRefresh, Math.max(0, ttl - age));
    return () => window.clearTimeout(timer);
  }, [lastUpdated, ttl, forceRefresh]);

  // Refresh on tab focus if the data has gone stale in the meantime.
  useEffect(() => {
    const onFocus = () => {
      const ts = cacheTimestamp(key);
      if (ts === undefined || Date.now() - ts >= ttl) forceRefresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [key, ttl, forceRefresh]);

  const mutate = useCallback(
    (next: T | ((prev: T | undefined) => T)) => {
      setData((prev) => {
        const value =
          typeof next === "function" ? (next as (p: T | undefined) => T)(prev) : next;
        setCache(key, value); // write through so the next mount sees the change
        return value;
      });
      setLastUpdated(Date.now());
    },
    [key],
  );

  return { data, loading, refreshing, error, lastUpdated, refresh: forceRefresh, mutate };
}
