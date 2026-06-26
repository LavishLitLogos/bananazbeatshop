const CACHE_NAME = "thisbeatizbananaz-shell-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

function shouldBypass(request) {
  const url = new URL(request.url);

  return (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/supabase/functions") ||
    url.pathname.includes("stripe") ||
    url.pathname.includes("checkout") ||
    url.pathname.includes("payment") ||
    url.hostname.includes("stripe.com")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || shouldBypass(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseClone = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});