/* G.L.S.C Atlas service worker.
 *
 * Strategy per resource, because one strategy for everything was wrong:
 *   - navigations      network-first, cache fallback  (so deploys ship)
 *   - hashed build JS  cache-first                    (immutable by name)
 *   - models & slices  cache-first                    (large, versioned by path)
 *   - everything else  stale-while-revalidate
 *
 * The previous worker was cache-first for every GET including the HTML
 * document, so a returning user could never receive an app update until the
 * cache name changed.
 *
 * Models are cache-first and never revalidated, and their paths do not change
 * across a rebuild, so a returning browser would keep the old geometry forever:
 * dropping it only happens when the cache name changes on activation. That is
 * why MEDIA has its own version, stamped from the contents of public/models,
 * public/slices and public/draco by scripts/stamp-media-version.mjs. Edit
 * VERSION by hand when the caching strategy changes; leave MEDIA_VERSION alone.
 */

const VERSION = "v8";
// AUTO-GENERATED — do not edit. `npm run media:stamp`, and automatically by
// `npm run data:split` and `npm run build`. `npm run data:verify` fails if stale.
const MEDIA_VERSION = "m-751e4de0f34b10cd";

const SHELL = `glsc-shell-${VERSION}`;
const ASSETS = `glsc-assets-${VERSION}`;
const MEDIA = `glsc-media-${MEDIA_VERSION}`;
const CACHES = [SHELL, ASSETS, MEDIA];

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/models/manifest.json",
  "/draco/draco_decoder.js",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
];

/** Bounded so a full atlas of model packs cannot fill the origin quota. */
const MEDIA_MAX_ENTRIES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      // addAll rejects the whole install if any single URL 404s.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isMedia(pathname) {
  return (
    pathname.startsWith("/models/") ||
    pathname.startsWith("/slices/") ||
    pathname.startsWith("/draco/")
  );
}

function isImmutable(pathname) {
  // Next emits content-hashed filenames under /_next/static.
  return pathname.startsWith("/_next/static/") && /(?:^|[-.])[a-f0-9]{8,}(?:[-.]|$)/i.test(pathname.split("/").pop());
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Never store partial (206) or error responses.
  if (res.ok && res.status === 200 && res.type === "basic") {
    await cache.put(request, res.clone());
    if (cacheName === MEDIA) void trim(MEDIA, MEDIA_MAX_ENTRIES);
  }
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) await cache.put(request, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(request)) || (await cache.match("/"));
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font:16px system-ui;padding:2rem\"><h1>Offline</h1><p>G.L.S.C Atlas has not been cached yet. Reconnect once, then it works offline.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok && res.status === 200 && res.type === "basic") {
        void cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await network;
  return (
    res ??
    new Response("Offline and not cached.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Development chunk URLs are not content-hashed. Never pin local previews.
  if (["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname)) return;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only same-origin. Cross-origin (fonts, CDNs) goes straight to the network.
  if (url.origin !== self.location.origin) return;
  // The tutor proxy must never be cached or replayed.
  if (url.pathname.startsWith("/api/")) return;
  // Range requests must reach the network untouched.
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }
  if (url.pathname === "/models/manifest.json") {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }
  if (isMedia(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA));
    return;
  }
  if (isImmutable(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, ASSETS));
});
