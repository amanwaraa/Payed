const CACHE_NAME = "payed-app-v2.0.0";
const APP_SHELL = [
  "./",
  "./payed.html",
  "./Payed2.html",
  "./manifest-payed.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const file of APP_SHELL) {
        try {
          await cache.add(file);
        } catch (e) {
          console.warn("Cache add failed:", file, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  const isSameOrigin = url.origin === self.location.origin;
  const isAppPage =
    url.pathname.endsWith("/payed.html") ||
    url.pathname.endsWith("/Payed2.html") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/");

  const isThirdPartyStatic =
    url.origin.includes("gstatic.com") ||
    url.origin.includes("googleapis.com") ||
    url.origin.includes("cdn.tailwindcss.com") ||
    url.origin.includes("cdn.jsdelivr.net");

  // صفحات التنقل: network first ثم fallback للكاش
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(req)) ||
            (await caches.match("./payed.html")) ||
            Response.error()
          );
        })
    );
    return;
  }

  // الملفات الخارجية الثابتة: cache first
  if (isThirdPartyStatic) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;

        return fetch(req)
          .then(res => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match("./payed.html"));
      })
    );
    return;
  }

  // ملفات التطبيق المحلية: stale-while-revalidate
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const networkFetch = fetch(req)
          .then(res => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(async () => {
            if (isAppPage) {
              return (
                (await caches.match(req)) ||
                (await caches.match("./payed.html")) ||
                Response.error()
              );
            }
            return cached || Response.error();
          });

        return cached || networkFetch;
      })
    );
    return;
  }

  // افتراضي
  event.respondWith(
    fetch(req).catch(async () => {
      return (await caches.match(req)) || (await caches.match("./payed.html")) || Response.error();
    })
  );
});