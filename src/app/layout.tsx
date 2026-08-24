import type { Metadata } from 'next';
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MONEYTWIN — stress-test your money',
  description:
    'A personal financial digital twin. Forecast cash flow, simulate shocks, and find the cheapest way to protect your future.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="bg-paper font-body text-ink antialiased">{children}</body>
    </html>
  );
}
