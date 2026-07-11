// TOEIC Vocab Spark - Service Worker
// Strategy: app shell (html/css/js) is always fetched network-first so edits
// show up immediately; cache is only a fallback for offline use. Vocabulary
// data and third-party assets (fonts/icons) use stale-while-revalidate so the
// app stays fast while quietly refreshing in the background.
//
// Bump CACHE_VERSION only when the caching *strategy* below changes - it is
// NOT needed for normal content edits (those are picked up automatically by
// the network-first fetch). Bumping it forces old caches to be purged.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `tvs-shell-${CACHE_VERSION}`;
const DATA_CACHE = `tvs-data-${CACHE_VERSION}`;
const RUNTIME_CACHE = `tvs-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, DATA_CACHE, RUNTIME_CACHE];

const SHELL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => !CURRENT_CACHES.includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Let the page force an immediate activation (used by the update-detection logic in app.js)
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isDataRequest(url) {
    return url.pathname.includes('/data/');
}

function isShellRequest(url) {
    return SHELL_ASSETS.some((asset) => {
        const cleanAsset = asset.replace('./', '');
        return url.pathname.endsWith(cleanAsset) || (cleanAsset === '' && url.pathname.endsWith('/'));
    });
}

// Network-first: always try the network (bypassing HTTP cache) for the freshest
// bytes; fall back to the cached copy only when offline/unreachable.
async function networkFirst(request, cacheName) {
    try {
        const freshResponse = await fetch(request, { cache: 'no-store' });
        if (freshResponse && freshResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, freshResponse.clone());
        }
        return freshResponse;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
    }
}

// Stale-while-revalidate: serve the cached copy instantly (or wait for network
// if nothing cached yet), and refresh the cache in the background either way.
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const networkFetch = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    return cached || (await networkFetch) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // App shell (HTML/CSS/JS/manifest) and same-origin navigations: network-first.
    if (request.mode === 'navigate' || (url.origin === self.location.origin && isShellRequest(url))) {
        event.respondWith(networkFirst(request.mode === 'navigate' ? './index.html' : request, SHELL_CACHE));
        return;
    }

    // Vocabulary JSON data: stale-while-revalidate.
    if (url.origin === self.location.origin && isDataRequest(url)) {
        event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
        return;
    }

    // Everything else same-origin (icons, misc assets) + third-party (fonts, CDN icons): stale-while-revalidate.
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});
