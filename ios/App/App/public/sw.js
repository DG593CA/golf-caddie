// GolfCaddie AI Service Worker (PWA Activation)
// Clean pass-through no-op worker that allows the app to be installed
// but does not cache static resources to avoid caching hashed Vite build assets.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass through directly to network
});
