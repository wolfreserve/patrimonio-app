// Guarda la app en el teléfono para que abra sin internet.
// Solo guarda los archivos de la app, nunca tus datos (esos viven cifrados en IndexedDB).
const VERSION = "patrimonio-v4";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // Red primero (para recibir mejoras), caché si no hay internet.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))),
  );
});
