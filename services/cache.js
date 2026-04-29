const memCache = new Map();   // key -> { value, expires }
const inflight = new Map();   // key -> Promise<value>

const SESSION_PREFIX = 'consumd_cache:';

/* -----------------------------------------
   Session storage helpers
------------------------------------------ */
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
   OpenLibrary-safe validity check
------------------------------------------ */
function isBadValue(value) {
  if (value == null) return true;

  if (Array.isArray(value) && value.length === 0) return true;

  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) return true;
    if (value.error) return true;

    // OpenLibrary-specific safety checks
    if (value.docs && value.docs.length === 0) return true;
    if (value.works && value.works.length === 0) return true;
  }

  return false;
}

/* -----------------------------------------
   Main cache function
------------------------------------------ */
export async function cached(key, fetcher, opts = {}) {
  const ttl = opts.ttl ?? 10 * 60 * 1000;
  const persist = opts.persist ?? true;
  const force = opts.force ?? false;

  const now = Date.now();

  // 1. FORCE bypass
  if (force) {
    memCache.delete(key);
    try { sessionStorage.removeItem(SESSION_PREFIX + key); } catch {}
  }

  // 2. Memory cache
  const mem = memCache.get(key);
  if (mem && mem.expires > now) {
    return mem.value;
  }

  // 3. Session cache hydration
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

  const p = fetcher()
    .then((value) => {
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
    })
    .catch((err) => {
      console.error('[cache fetcher error]', key, err);
      return [];
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/* -----------------------------------------
   Invalidate single key
------------------------------------------ */
export function invalidate(key) {
  memCache.delete(key);
  try {
    sessionStorage.removeItem(SESSION_PREFIX + key);
  } catch {}
}

/* -----------------------------------------
   Invalidate by prefix
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
   Clear all cache
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