// public/sw.js — RoadGame service worker.
// Enables home-screen installation and is ready to receive push
// notifications once VAPID/web-push are wired up server-side.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // No clients.claim() — claiming existing clients on iOS Safari can force
  // a page reload which fails when the HTML isn't cached, causing
  // "This page couldn't load". Pages pick up the new SW on next navigation.
});

// Push notifications (used later when the server sends pushes).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "RoadGame", body: event.data.text() };
  }
  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "RoadGame", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.openWindow(url));
});
