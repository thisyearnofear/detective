import type { Metadata } from 'next';
import '@/styles/globals.css';
import GradientBackground from '@/components/GradientBackground';

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
      <body className="bg-slate-950 text-white">
        <GradientBackground state="LIVE" />
        {/* Dark overlay for better text contrast */}
        <div className="fixed inset-0 -z-5 bg-gradient-to-b from-slate-950/30 via-slate-950/50 to-slate-950/40 pointer-events-none" />
        {children}
      </body>
    </html>
  );
}
