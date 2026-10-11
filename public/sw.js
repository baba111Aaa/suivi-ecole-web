// Suivi École : affiche une page simple si la connexion est coupée.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      new Response(
        '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Suivi École</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:40px;background:#eef2ff;color:#1e293b">' +
        '<h1 style="color:#4f46e5">Suivi École</h1><p>Pas de connexion internet.</p>' +
        '<button onclick="location.reload()" style="padding:12px 20px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-size:16px">Réessayer</button>' +
        '</body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    )
  );
});
// FIN DU FICHIER
