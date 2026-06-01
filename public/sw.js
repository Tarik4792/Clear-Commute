const CACHE = "clearcommute-v2";
const STATIC = ["/", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Handle push notifications
self.addEventListener("push", e => {
  const data = e.data?.json() || {};
  const title = data.title || "ClearCommute";
  const options = {
    body: data.body || "Check your commute",
    icon: data.icon || "/icons/icon.svg",
    badge: "/icons/icon.svg",
    vibrate: [100, 50, 100],
    data: { url: "/" },
    actions: [
      { action: "open", title: "View commute" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "dismiss") return;
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/"));
});
