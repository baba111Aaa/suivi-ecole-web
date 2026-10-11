import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'Suivi École',
  description: 'Suivi de la scolarité pour les écoles et les parents',
  appleWebApp: { capable: true, title: 'Suivi École', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Script id="enregistrer-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function () {}); }`}
        </Script>
      </body>
    </html>
  );
}
// FIN DU FICHIER
