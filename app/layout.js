import './globals.css';

export const metadata = {
  title: 'Suivi École',
  description: 'Espace établissement',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
