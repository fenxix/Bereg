const VERSION = "v2";
const CACHE = "tihiy-bereg-" + VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./economy.js",
  "./models.js",
  "./player.js",
  "./shells.js",
  "./ui.js",
  "./world.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-192.png",
  "./maskable-512.png",
  "./apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // по одному, чтобы один недоступный файл не ломал установку
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tihiy-bereg-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !isCdn) return;

  // кеш сразу, а в фоне обновляем — игра открывается мгновенно и офлайн
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) return cached;
      const res = await network;
      if (res) return res;
      if (req.mode === "navigate") return cache.match("./index.html");
      return new Response("", { status: 504 });
    })
  );
});
