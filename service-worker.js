// service-worker.js
// Offline support for Delta Grande game — cache shell and game-assets on first use
const CACHE_NAME = 'delta-grande-v1';
const PRECACHE_URLS = [
  '/game/index.html',
  '/game/',
  '/game/main.js',
  '/game/styles/sub/deck-style.css'
];

// Complete list of media and other assets to cache when user requests "Guardar offline"
// This includes all .webm files discovered in the workspace (encoded for URLs).
// NOTE: we will filter out any paths that contain '_old' or '/dist/' to avoid caching
// backup/old files and distribution artifacts.
const RAW_OFFLINE_URLS = [
  '/',
  '/index.html',
  '/game/index.html',
  '/game/',
  '/game/main.js',
  '/game/styles/sub/deck-style.css',
  '/assets/island.webm',
  '/assets/island_1.webm',
  '/assets/island_2.webm',
  '/assets/mapa_gigante.webm',
  '/assets/web-bgs/web-bg03.webm',
  '/assets/web-bgs/web-bg02.webm',
  '/assets/web-bgs/web-bg01.webm',
  '/game-assets/transiciones/secuencia_inicio_recorrido1.webm',
  '/game-assets/transiciones/old/transicion05.webm',
  '/game-assets/transiciones/old/transicion04.webm',
  '/game-assets/transiciones/old/transicion03.webm',
  '/game-assets/transiciones/old/transicion02.webm',
  '/game-assets/transiciones/old/transicion01.webm',
  '/game-assets/transiciones/lab-a-subacua.webm',
  '/game-assets/transiciones/hd/secuencia_inicio_recorrido2_VP9.webm',
  '/game-assets/transiciones/hd/secuencia_inicio_recorrido2.webm',
  '/game-assets/recorrido/lab-a-recorrido.webm',
  '/game-assets/recorrido/interfaz/loading-text-box-animation.webm',
  '/game-assets/recorrido/transiciones_escenas/transicion01.webm',
  '/game-assets/recorrido/transiciones_escenas/transicion02.webm',
  '/game-assets/recorrido/transiciones_escenas/transicion03.webm',
  '/game-assets/recorrido/transiciones_escenas/transicion04.webm',
  '/game-assets/recorrido/transiciones_escenas/transicion05.webm',
  '/game-assets/recorrido/transiciones_escenas/barrida.webm',
  '/game-assets/recorrido/paneles/panel%20metadata.webm',
  '/game-assets/recorrido/paneles/Suelda%20Consuelda%20-%20criatura-data-main%2014_1.webm',
  '/game-assets/recorrido/paneles/originals/panel%20metadata.webm',
  '/game-assets/recorrido/paneles/efedra%20-%20criatura-data-main%2011.webm',
  '/game-assets/recorrido/zocalos/escena01_zocalo_espinal.webm',
  '/game-assets/recorrido/zocalos/escena02_zocalo_monte.webm',
  '/game-assets/recorrido/zocalos/escena03_zocalo_bosque%20en%20galeria.webm',
  '/game-assets/recorrido/zocalos/escena04_zocalo_bosque%20de%20barrancas.webm',
  '/game-assets/recorrido/zocalos/escena05_zocalo_humedal.webm',
  '/game-assets/recorrido/zocalos/escena06_zocalo_costa.webm',
  
  '/game-assets/recorrido/criaturas/cardenal/cardenal_data.webm',
  '/game-assets/recorrido/criaturas/cardenal/cardenal_glitch.webm',
  '/game-assets/recorrido/criaturas/efedra/efedra_data.webm',
  '/game-assets/recorrido/criaturas/efedra/efedra_glitch.webm',
  '/game-assets/recorrido/criaturas/rana/rana_data.webm',
  '/game-assets/recorrido/criaturas/rana/rana_glitch.webm',
  '/game-assets/recorrido/criaturas/salvia/salvia_data.webm',
  '/game-assets/recorrido/criaturas/salvia/salvia_glitch.webm',
  '/game-assets/recorrido/criaturas/paloma/paloma_data.webm',
  '/game-assets/recorrido/criaturas/paloma/paloma_glitch.webm',
  '/game-assets/recorrido/criaturas/yesquero/yesquero_data.webm',
  '/game-assets/recorrido/criaturas/yesquero/yesquero_glitch.webm',
  '/game-assets/recorrido/criaturas/yarara/yarara_data.webm',
  '/game-assets/recorrido/criaturas/yarara/yarara_glitch.webm',
  '/game-assets/recorrido/criaturas/viraro/viraro_data.webm',
  '/game-assets/recorrido/criaturas/viraro/viraro_glitch.webm',
  '/game-assets/recorrido/criaturas/yacare/yacare_data.webm',
  '/game-assets/recorrido/criaturas/yacare/yacare_glitch.webm',
  '/game-assets/recorrido/criaturas/yaguarundi/yaguarundi_data.webm',
  '/game-assets/recorrido/criaturas/yaguarundi/yaguarundi_glitch.webm',
  '/game-assets/recorrido/criaturas/yatei/yatei_data.webm',
  '/game-assets/recorrido/criaturas/yatei/yatei_glitch.webm',
  '/game-assets/recorrido/criaturas/tortuga/tortuga_data.webm',
  '/game-assets/recorrido/criaturas/tortuga/tortuga_glitch.webm',
  '/game-assets/recorrido/criaturas/viraro/viraro_data.webm',
  '/game-assets/recorrido/criaturas/viraro/viraro_glitch.webm',
  '/game-assets/recorrido/criaturas/mburucuya/mburucuya_data.webm',
  '/game-assets/recorrido/criaturas/mburucuya/mburucuya_glitch.webm',
  '/game-assets/recorrido/criaturas/murcielago/murcielago_data.webm',
  '/game-assets/recorrido/criaturas/murcielago/murcielago_glitch.webm',
  '/game-assets/recorrido/criaturas/martin/martin_data.webm',
  '/game-assets/recorrido/criaturas/martin/martin_glitch.webm',
  '/game-assets/recorrido/criaturas/guazuncho/guazuncho_data.webm',
  '/game-assets/recorrido/criaturas/guazuncho/guazuncho_glitch.webm',
  '/game-assets/recorrido/criaturas/malvavisco/malvavisco_data.webm',
  '/game-assets/recorrido/criaturas/malvavisco/malvavisco_glitch.webm',
  '/game-assets/recorrido/criaturas/helecho/helecho_data.webm',
  '/game-assets/recorrido/criaturas/helecho/helecho_glitch.webm',
  '/game-assets/recorrido/criaturas/clavel/clavel_data.webm',
  '/game-assets/recorrido/criaturas/clavel/clavel_glitch.webm',
  '/game-assets/recorrido/criaturas/chaja/chaja_data.webm',
  '/game-assets/recorrido/criaturas/chaja/chaja_glitch.webm',
  '/game-assets/recorrido/criaturas/camalote/camalote_data.webm',
  '/game-assets/recorrido/criaturas/camalote/camalote_glitch.webm',
  '/game-assets/recorrido/criaturas/carpintero/carpintero_data.webm',
  '/game-assets/recorrido/criaturas/carpintero/carpintero_glitch.webm',
  '/game-assets/recorrido/criaturas/carancho/carancho_data.webm',
  '/game-assets/recorrido/criaturas/carancho/carancho_glitch.webm',
  '/game-assets/recorrido/criaturas/banderita/banderita_data.webm',
  '/game-assets/recorrido/criaturas/banderita/banderita_glitch.webm',
  '/game-assets/recorrido/criaturas/aguara/aguara_data.webm',
  '/game-assets/recorrido/criaturas/aguara/aguara_glitch.webm',
  '/game-assets/recorrido/cinematicas/carpa_flota.webm',
  
  '/game-assets/menu/logo_naranja_alpha.webm',
  '/game-assets/menu/logo_naranja_alpha_test.webm',
  '/game-assets/menu/cinematicas/logo_naranja.webm',
  '/game-assets/menu/cinematicas/original/logo_naranja.webm',
  '/game-assets/sub/others/surface.webm',
  '/game-assets/transiciones/lab-a-subacua.webm',
  '/game-assets/transiciones/hd/secuencia_inicio_recorrido2_VP9.webm',
  '/game-assets/transiciones/hd/secuencia_inicio_recorrido2.webm'
];

// Filter out unwanted entries (backups / dist)
const ALL_OFFLINE_URLS = RAW_OFFLINE_URLS.filter(u => !u.includes('_old') && !u.includes('/dist/'));

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
    const filteredUrls = Array.isArray(urls) ? urls.filter(u => !String(u).includes('_old') && !String(u).includes('/dist/')) : urls;
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

  if (event.data.type === 'CACHE_OFFLINE') {
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
    if (!urls) urls = ALL_OFFLINE_URLS;
    // Ensure we don't cache backups or dist artifacts
    if (Array.isArray(urls)) {
      urls = urls.filter(u => !String(u).includes('_old') && !String(u).includes('/dist/'));
    }

    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      let cachedCount = 0;
      const total = urls.length;

      for (const url of urls) {
        try {
          const req = new Request(url, { credentials: 'same-origin' });
          const resp = await fetch(req);
          // Only cache full 200 responses; skip partial (206) or other non-200.
          if (resp && resp.status === 200) {
            try {
              await cache.put(req, resp.clone());
            } catch (err) {
              // Might happen if response is partial or storage quota exceeded
              const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
              clientsList.forEach(c => c.postMessage({ type: 'CACHE_ERROR', url, error: err.message }));
              continue;
            }
            cachedCount++;
            const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
            clientsList.forEach(c => c.postMessage({ type: 'CACHE_PROGRESS', cached: cachedCount, total, url }));
          } else {
            const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
            clientsList.forEach(c => c.postMessage({ type: 'CACHE_ERROR', url, status: resp ? resp.status : 'no-response' }));
          }
        } catch (err) {
          const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
          clientsList.forEach(c => c.postMessage({ type: 'CACHE_ERROR', url, error: err.message }));
        }
      }

      const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
      clientsList.forEach(c => c.postMessage({ type: 'CACHE_COMPLETE', cached: cachedCount, total }));
    })());
  }
});
