import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Detective - Farcaster Game',
  description: 'AI-powered social deduction game on Farcaster',
  openGraph: {
    title: 'Detective - Farcaster Game',
    description: 'Can you tell if you are chatting with a real person or an AI bot?',
    type: 'website',
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
