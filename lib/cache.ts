type Entry<T> = { at: number; data: T };

const store = new Map<string, Entry<unknown>>();

export function cached<T>(key: string, ttlMs: number, factory: () => T): { data: T; cache: "HIT" | "MISS" } {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) {
    return { data: hit.data, cache: "HIT" };
  }
  const data = factory();
  store.set(key, { at: now, data });
  return { data, cache: "MISS" };
}
