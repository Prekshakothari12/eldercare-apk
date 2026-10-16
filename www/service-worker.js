const CACHE = "eldercare-v30";
const CDN_CACHE = "eldercare-cdn-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/base.css",
  "./css/components.css",
  "./css/senior.css",
  "./css/caregiver.css",
  "./css/login.css",
  "./css/fixes.css",
  "./js/app.js",
  "./js/medicines.js",
  "./js/auth.js",
  "./js/caregiver.js",
  "./js/schemes.js",
  "./js/firebase-config.js",
  "./js/language.js",
  "./js/locales-inline.js",
  "./js/roles.js",
  "./js/sos.js",
  "./js/food.js",
  "./js/ui.js",
  "./locales/en.json",
  "./locales/hi.json",
  "./data/dietData.json",
  "./data/schemes.json",
  "./assets/logo.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png"
];
// Third-party files the app shell needs to start offline (Firebase SDK, icon font, fonts).
const CDN_PRECACHE = [
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap"
];
const CDN_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
// Live data/auth calls must never be cached.
const API_HOSTS = ["firestore.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com", "firebaseinstallations.googleapis.com", "www.googleapis.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    // CDN files are best effort: a failure here must not block installing the app shell.
    const cdn = await caches.open(CDN_CACHE);
    await Promise.all(CDN_PRECACHE.map(url => cdn.add(new Request(url, { mode: "cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== CDN_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isNetworkFirst(request) {
  const url = new URL(request.url);
  return request.mode === "navigate" || request.destination === "document" || request.destination === "script" ||
    url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".json") || url.pathname.endsWith(".css");
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Never cache a redirect; a redirected response cannot be served for a navigation.
    if (response.ok && !response.redirected) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") return (await caches.match("./index.html")) || (await caches.match("./"));
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(cacheName).then(cache => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (API_HOSTS.includes(url.hostname)) return;
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, CDN_CACHE).catch(() => Response.error()));
    return;
  }
  if (url.origin !== location.origin) return;
  event.respondWith(isNetworkFirst(request) ? networkFirst(request) : cacheFirst(request, CACHE).catch(() => caches.match("./index.html")));
});

/* —— Push / SOS system notifications —— */
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    try { data = { body: event.data.text() }; } catch (e2) {}
  }
  const title = data.title || "ElderCare SOS";
  const options = {
    body: data.body || "Someone needs help",
    tag: data.tag || "sos-push",
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: data.data || data,
    silent: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = "./index.html#/home";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.postMessage({ type: "sos-notification-click", data });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("message", event => {
  const msg = event.data || {};
  if (msg.type === "show-sos-notification" && msg.notification) {
    const n = msg.notification;
    event.waitUntil(
      self.registration.showNotification(n.title || "ElderCare SOS", {
        body: n.body || "Needs help",
        tag: n.tag || "sos-active",
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        requireInteraction: true,
        renotify: true,
        vibrate: [200, 100, 200, 100, 200],
        data: n.data || {},
        silent: false
      })
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "show-notification" && self.registration) {
    self.registration.showNotification(data.title || "ElderCare", {
      body: data.body || "",
      tag: data.tag || "med",
      requireInteraction: true,
      renotify: true
    });
  }
});
