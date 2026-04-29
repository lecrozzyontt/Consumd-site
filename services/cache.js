const memCache = new Map();   // key -> { value, expires }
const inflight = new Map();   // key -> Promise<value>

const SESSION_PREFIX = 'consumd_cache:';

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expires !== 'number') return null;

    // expired
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
    sessionStorage.setItem(
      SESSION_PREFIX + key,
      JSON.stringify(entry)
    );
  } catch {
    // ignore quota / disabled storage
  }
}

/* -----------------------------------------
   Smart validity check
   Prevents caching bad API responses
------------------------------------------ */
function isBadValue(value) {
  if (value == null) return true;

  // empty arrays are NOT cached (main fix for OpenLibrary issue)
  if (Array.isArray(value) && value.length === 0) return true;

  return false;
}

/**
 * Get cached value or compute it.
 */
export async function cached(key, fetcher, opts = {}) {
  const ttl = opts.ttl ?? 10 * 60 * 1000;
  const persist = opts.persist ?? true;
  const force = opts.force ?? false;

  const now = Date.now();

  // 1. FORCE bypass cache (debug option)
  if (force) {
    memCache.delete(key);
    try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
  }

  // 2. Memory cache hit
  const mem = memCache.get(key);
  if (mem && mem.expires > now) {
    return mem.value;
  }

  // 3. SessionStorage hydration
  if (persist) {
    const ses = readSession(key);

    if (ses && !isBadValue(ses.value)) {
      memCache.set(key, ses);
      return ses.value;
    }
  }

  // 4. Deduplicate inflight requests
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const p = (async () => {
    try {
      const value = await fetcher();

      // 🚨 CRITICAL FIX: DO NOT CACHE BAD DATA
      if (!isBadValue(value)) {
        const entry = {
          value,
          expires: now + ttl,
        };

        memCache.set(key, entry);

        if (persist) {
          writeSession(key, entry);
        }
      }

      return value;
    } catch (err) {
      console.error('[cache fetcher error]', key, err);
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/* -----------------------------------------
   Remove single entry
------------------------------------------ */
export function invalidate(key) {
  memCache.delete(key);
  try {
    sessionStorage.removeItem(SESSION_PREFIX + key);
  } catch {}
}

/* -----------------------------------------
   Remove by prefix
------------------------------------------ */
export function invalidatePrefix(prefix) {
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) {
      memCache.delete(k);
    }
  }

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX + prefix)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

/* -----------------------------------------
   Clear everything
------------------------------------------ */
export function clearAll() {
  memCache.clear();

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}