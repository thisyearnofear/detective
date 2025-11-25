import type { Metadata } from 'next';
import './globals.css';

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
    title: 'Detective - Is That You?',
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
      <body className="text-white">
        {children}
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
