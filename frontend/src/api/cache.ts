// Tiny in-memory, session-scoped resource cache.
//
// Pages mount/unmount as the user switches tabs, which otherwise re-fires every
// fetch. `cachedFetch` keeps the last result per key for a short TTL so flipping
// between Homework ↔ Grades (and back) is instant and doesn't hammer EduPage.
// In-flight requests are de-duped so two mounts share one network call.
//
// This lives only in memory — nothing sensitive is persisted to disk/storage,
// and `clearCache()` is called on logout so a different account never sees it.

interface Entry<T> {
  data: T;
  ts: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Synchronously read a still-fresh cached value, or undefined. Used to seed
 *  initial state so a cache hit renders without a loading flash. */
export function peekCache<T>(key: string, ttl = DEFAULT_TTL): T | undefined {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  return undefined;
}

/** Return cached data when fresh, otherwise run `loader`, cache, and return it.
 *  Concurrent callers for the same key share a single in-flight promise. */
export function cachedFetch<T>(key: string, loader: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const fresh = peekCache<T>(key, ttl);
  if (fresh !== undefined) return Promise.resolve(fresh);

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = loader()
    .then((data) => {
      store.set(key, { data, ts: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, p);
  return p;
}

/** Overwrite a cached entry — e.g. after an optimistic mutation so the next
 *  mount reflects the change without a refetch. */
export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

/** Drop one key (force a refetch on next access). */
export function invalidate(key: string): void {
  store.delete(key);
  inflight.delete(key);
}

/** Wipe everything — call on logout. */
export function clearCache(): void {
  store.clear();
  inflight.clear();
}
