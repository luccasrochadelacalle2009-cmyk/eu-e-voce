const C = "us-v8", F = [
  "./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
  "styles/tokens.css", "styles/base.css", "styles/components.css", "styles/responsive.css",
  "src/main.js",
  "src/core/constants.js", "src/core/utils.js", "src/core/storage.js", "src/core/store.js",
  "src/core/theme.js", "src/core/router.js", "src/core/actions.js",
  "src/ui/toast.js", "src/ui/modal.js", "src/ui/layout.js",
  "src/features/home.js", "src/features/calendar.js", "src/features/memories.js",
  "src/features/plans.js", "src/features/letters.js", "src/features/journal.js",
  "src/features/music.js", "src/features/places.js", "src/features/connect.js",
  "src/features/more.js", "src/features/settings.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(C).then(cache => cache.addAll(F)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== C).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const isNavigation = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request).then(response => {
      if (!response || !response.ok) throw new Error("Resposta indisponível");
      const copy = response.clone();
      caches.open(C).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (isNavigation) return caches.match("index.html");
      return new Response("", { status: 404, statusText: "Offline" });
    })
  );
});
