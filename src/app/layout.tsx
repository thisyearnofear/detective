import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Detective - Farcaster Game',
  description: 'AI-powered social deduction game on Farcaster. Can you tell if you\'re chatting with a real person or an AI bot?',

  // Favicon and app icons
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },

  // Open Graph (for social sharing)
  openGraph: {
    title: 'Detective - Farcaster Game',
    description: 'Can you tell if you are chatting with a real person or an AI bot?',
    type: 'website',
    url: 'https://detective.app', // Update with your actual domain
    images: [
      {
        url: '/og-image.png', // 1200x630px recommended
        width: 1200,
        height: 630,
        alt: 'Detective - AI Social Deduction Game',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Detective - Farcaster Game',
    description: 'Can you tell if you are chatting with a real person or an AI bot?',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-white">{children}</body>
    </html>
  );
}
