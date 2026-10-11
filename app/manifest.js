export default function manifest() {
  return {
    name: 'Suivi École',
    short_name: 'Suivi École',
    description: 'Suivi de la scolarité pour les écoles et les parents',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#eef2ff',
    theme_color: '#4f46e5',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
// FIN DU FICHIER
