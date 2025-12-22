// service-worker.js
// Offline support for Delta Grande game — cache shell and game-assets on first use
const CACHE_NAME = 'delta-grande-v1';
const PRECACHE_URLS = [
  '/game/index.html',
  '/game/',
  '/game/main.js',
  '/game/styles/sub/deck-style.css'
];

// Patterns to exclude from caching (backup/old/hd folders)
const EXCLUDE_PATTERNS = [
  '_old', '/dist/', '/.git/', '/node_modules/',
  '/bak/', '/_backup/', '/old/', '/originals/',
  '/hd/', '_old_data_files'
];

function shouldExclude(url) {
  return EXCLUDE_PATTERNS.some(pattern => url.includes(pattern));
}

// Complete list of media and other assets to cache when user requests "Guardar offline"
// This list is loaded from offline-manifest.json and filtered.
const ALL_OFFLINE_URLS_PROMISE = (async () => {
  try {
    const manifestResp = await fetch('/offline-manifest.json');
    if (manifestResp && manifestResp.ok) {
      const manifestList = await manifestResp.json();
      if (Array.isArray(manifestList)) {
        return manifestList.filter(u => !shouldExclude(u));
      }
    }
  } catch (err) {
    console.warn('[SW] Failed to load offline-manifest.json, falling back to empty list:', err);
  }
  return []; // Fallback to an empty array if manifest fails to load or is invalid
})();


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Helper: cache response if valid
async function cacheResponse(request, response) {
  // Only cache full 200 responses. Some servers may return 206 Partial Content
  // for range requests; Cache.put does not accept partial responses and will
  // throw. Guard against that by only caching when status === 200.
  if (!response || response.status !== 200) return response;
  const cache = await caches.open(CACHE_NAME);
  try {
    await cache.put(request, response.clone());
  } catch (err) {
    // If cache.put fails (e.g. partial responses or storage errors), log and
    // continue — do not crash the worker.
    console.warn('[SW] cache.put failed for', request.url, err);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);

  // Navigation requests: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((res) => {
        return res;
      }).catch(() => caches.match('/game/index.html'))
    );
    return;
  }

  // For game assets, use cache-first so once an asset is fetched it's available offline
  if (reqUrl.pathname.startsWith('/game-assets/') || reqUrl.pathname.startsWith('/game/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((networkResp) => cacheResponse(event.request, networkResp)).catch(() => cached))
    );
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(event.request).then((networkResp) => cacheResponse(event.request, networkResp)).catch(() => caches.match(event.request))
  );
});

// Allow the page to message the SW (e.g., to trigger skipWaiting or download offline)
self.addEventListener('message', async (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'DOWNLOAD_OFFLINE') {
    // Attempt to download and cache a list provided by the page
    const urls = Array.isArray(event.data.urls) ? event.data.urls : PRECACHE_URLS;
    // Filter out backup/old artifacts
    const filteredUrls = Array.isArray(urls) ? urls.filter(u => !shouldExclude(String(u))) : urls;
    // Use an async IIFE for clarity and to avoid nested Promise/paren bugs
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        for (const u of filteredUrls) {
          try {
            const req = new Request(u, { credentials: 'same-origin' });
            const r = await fetch(req);
            // Only cache full 200 responses; skip partial (206) or errors
            if (r && r.status === 200) {
              try {
                await cache.put(req, r.clone());
              } catch (err) {
                console.warn('[SW] cache.put failed for', u, err);
              }
            }
          } catch (err) {
            // per-item fetch error - log and continue
            console.warn('[SW] download offline fetch failed for', u, err);
          }
        }
      } catch (err) {
        console.warn('[SW] DOWNLOAD_OFFLINE overall error', err);
      }
    })());
  }

  if (event.data.type === 'CANCEL_CACHE') {
    // Signal to cancel ongoing cache operation
    // We'll use a flag stored in the global scope
    self.cancelCacheOperation = true;
  }

  if (event.data.type === 'CACHE_OFFLINE') {
    // Reset cancellation flag
    self.cancelCacheOperation = false;

    // Cache a predefined list (or the list provided) and post progress messages to clients
    let urls = Array.isArray(event.data.urls) ? event.data.urls : null;
    if (!urls) {
      try {
        const manifestResp = await fetch('/offline-manifest.json');
        if (manifestResp && manifestResp.ok) {
          const manifestList = await manifestResp.json();
          if (Array.isArray(manifestList) && manifestList.length) {
            urls = manifestList;
          }
        }
      } catch (err) {
        // ignore and fallback
      }
    }
    if (!urls) {
      // Fallback to the promise-loaded manifest
      urls = await ALL_OFFLINE_URLS_PROMISE;
    }
    // Ensure we don't cache backups or dist artifacts
    if (Array.isArray(urls)) {
      urls = urls.filter(u => !shouldExclude(String(u)));
    }

    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);

      // Load cached file manifest from cache storage (for resume capability)
      let cachedManifest = new Set();
      try {
        const manifestCache = await caches.open(CACHE_NAME + '-manifest');
        const manifestResp = await manifestCache.match('/cached-files-manifest');
        if (manifestResp) {
          const data = await manifestResp.json();
          cachedManifest = new Set(data.files || []);
        }
      } catch (err) {
        console.warn('[SW] Failed to load cached manifest:', err);
      }

      let cachedCount = cachedManifest.size;
      let cachedBytes = 0;
      const total = urls.length;

      // Filter out already cached files
      const urlsToCache = urls.filter(url => !cachedManifest.has(url));

      // If resuming, notify client
      if (cachedManifest.size > 0) {
        const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
        clientsList.forEach(c => c.postMessage({
          type: 'CACHE_RESUME',
          cached: cachedCount,
          total,
          resuming: true
        }));
      }

      for (const url of urlsToCache) {
        // Check for cancellation
        if (self.cancelCacheOperation) {
          const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
          clientsList.forEach(c => c.postMessage({
            type: 'CACHE_CANCELLED',
            cached: cachedCount,
            total
          }));
          return; // Exit early
        }

        // Retry logic: try up to 2 times
        let attempts = 0;
        let success = false;
        const maxAttempts = 2;

        while (attempts < maxAttempts && !success) {
          attempts++;

          try {
            // Create fetch with timeout (30 seconds)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const req = new Request(url, {
              credentials: 'same-origin',
              signal: controller.signal
            });

            const resp = await fetch(req);
            clearTimeout(timeoutId);

            // Only cache full 200 responses; skip partial (206) or other non-200.
            if (resp && resp.status === 200) {
              const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);

              try {
                await cache.put(req, resp.clone());
              } catch (err) {
                // Might happen if response is partial or storage quota exceeded
                const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
                clientsList.forEach(c => c.postMessage({
                  type: 'CACHE_ERROR',
                  url,
                  error: err.message,
                  skipping: true
                }));
                break; // Skip this file, move to next
              }

              cachedCount++;
              cachedBytes += contentLength;

              // Add to cached manifest
              cachedManifest.add(url);

              // Save progress to manifest cache
              try {
                const manifestCache = await caches.open(CACHE_NAME + '-manifest');
                const manifestData = { files: Array.from(cachedManifest), timestamp: Date.now() };
                await manifestCache.put('/cached-files-manifest',
                  new Response(JSON.stringify(manifestData), {
                    headers: { 'Content-Type': 'application/json' }
                  })
                );
              } catch (err) {
                console.warn('[SW] Failed to save manifest:', err);
              }

              const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
              clientsList.forEach(c => c.postMessage({
                type: 'CACHE_PROGRESS',
                cached: cachedCount,
                total,
                url,
                fileSize: contentLength,
                cachedBytes
              }));

              success = true; // Mark as successful
            } else {
              // Non-200 response
              if (attempts >= maxAttempts) {
                const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
                clientsList.forEach(c => c.postMessage({
                  type: 'CACHE_ERROR',
                  url,
                  status: resp ? resp.status : 'no-response',
                  skipping: true
                }));
              }
              // Will retry if attempts < maxAttempts
            }
          } catch (err) {
            // Fetch failed (timeout, network error, etc.)
            clearTimeout(timeoutId);

            if (attempts >= maxAttempts) {
              // Final attempt failed, skip this file
              const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
              clientsList.forEach(c => c.postMessage({
                type: 'CACHE_ERROR',
                url,
                error: err.name === 'AbortError' ? 'Timeout (30s)' : err.message,
                skipping: true
              }));
            } else {
              // Will retry
              console.warn(`[SW] Fetch failed for ${url}, attempt ${attempts}/${maxAttempts}:`, err);
            }
          }
        }
      }

      const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
      clientsList.forEach(c => c.postMessage({ type: 'CACHE_COMPLETE', cached: cachedCount, total, totalBytes: cachedBytes }));
    })());
  }
});
