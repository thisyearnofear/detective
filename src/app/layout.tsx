import type { Metadata } from 'next';
import './globals.css';
import '@farcaster/auth-kit/styles.css';
import BottomLinks from '@/components/BottomLinks';
import { RootProviders } from '@/components/Providers';

const miniAppEmbed = {
  version: '1',
  imageUrl: 'https://detectiveproof.vercel.app/og-image.png',
  button: {
    title: '🔍 Start Playing',
    action: {
      type: 'launch_miniapp',
      url: 'https://detectiveproof.vercel.app',
      name: 'Detective',
      splashImageUrl: 'https://detectiveproof.vercel.app/detective.png',
      splashBackgroundColor: '#0f172a',
    },
  },
};

export const metadata: Metadata = {
  title: 'Detective - Is That You?',
  description: 'AI-powered social deduction game on Farcaster. Can you tell if you\'re chatting with a real person or an AI bot?',

  // Favicon and app icons
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },

  // Open Graph (for social sharing)
  openGraph: {
    title: 'Detective - Is That You?',
    description: 'Can you tell if you are chatting with a real person or an AI bot?',
    type: 'website',
    url: 'https://detectiveproof.vercel.app',
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
    title: 'Detective - Is That You?',
    description: 'Can you tell if you are chatting with a real person or an AI bot?',
    images: ['/og-image.png'],
  },

  // Farcaster Mini App Embed
  other: {
    'fc:miniapp': JSON.stringify(miniAppEmbed),
    'fc:frame': JSON.stringify(miniAppEmbed), // For backward compatibility
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="text-white">
        <RootProviders>
          {children}
          <BottomLinks />
        </RootProviders>
        {/* SVG Filter for Gooey Effect */}
        <svg className="svg-filters" xmlns="http://www.w3.org/2000/svg" version="1.1">
          <defs>
            <filter id="gooey">
              <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10.2" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  );
}
