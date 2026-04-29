/* ============================================================
   Lightweight cache for API responses + profile lookups.

   Tiered strategy:
     1. In-memory Map  — fastest, lives until full reload.
     2. sessionStorage — survives client-side navigation; cleared
        when the tab closes. Good for things like "trending"
        results we don't want to re-hit on every Discover visit.

   Each entry is wrapped with `{ value, expires }` so we can
   honor a per-call TTL.

   Also exposes `inflight` map so concurrent identical requests
   share a single Promise instead of fanning out duplicates.
   ============================================================ */

const memCache  = new Map();   // key -> { value, expires }
const inflight  = new Map();   // key -> Promise<value>

const SESSION_PREFIX = 'consumd_cache:';

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expires !== 'number') return null;
    if (parsed.expires < Date.now()) {
      sessionStorage.removeItem(SESSION_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(key, entry) {
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded or storage disabled — non-fatal */
  }
}

/**
 * Get a cached value or compute + cache it.
 *
 * @param {string} key   stable cache key
 * @param {() => Promise<any>} fetcher async producer
 * @param {object} opts
 *   - ttl:        ms before the entry is treated as stale (default 10 min)
 *   - persist:    also write to sessionStorage (default true)
 */
export async function cached(key, fetcher, opts = {}) {
  const ttl     = opts.ttl     ?? 10 * 60 * 1000; // 10 minutes
  const persist = opts.persist ?? true;
  const now     = Date.now();

  // 1. In-memory hit
  const mem = memCache.get(key);
  if (mem && mem.expires > now) return mem.value;

  // 2. SessionStorage hit (rehydrate to memory)
  if (persist) {
    const ses = readSession(key);
    if (ses) {
      memCache.set(key, ses);
      return ses.value;
    }
  }

  // 3. De-dup concurrent requests
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fetcher();
      const entry = { value, expires: now + ttl };
      memCache.set(key, entry);
      if (persist) writeSession(key, entry);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Drop a single entry from both caches. */
export function invalidate(key) {
  memCache.delete(key);
  try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
}

/** Drop every entry whose key starts with `prefix`. */
export function invalidatePrefix(prefix) {
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX + prefix)) sessionStorage.removeItem(k);
    }
  } catch {}
}

/** Wipe everything we own. Useful after sign-out. */
export function clearAll() {
  memCache.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {}
}