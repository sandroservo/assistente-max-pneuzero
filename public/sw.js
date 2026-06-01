/**
 * Service Worker do Assistente Luma — Web Push handler.
 * Recebe push do servidor (via VAPID) mesmo com aba/painel fechado e
 * mostra notificação do sistema operacional.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pneuzero", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Pneuzero — Notificação";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/apple-touch-icon.png",
    badge: "/icons/favicon-32x32.png",
    tag: data.tag || "luma-handoff",
    requireInteraction: data.requireInteraction === true,
    data: { url: data.url || "/equipe" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/equipe";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url && "focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      })
  );
});
