// Stub vazio — projeto não usa service worker, mas alguns navegadores
// pedem /sw.js automaticamente. Responder 200 evita 404 nos logs.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
