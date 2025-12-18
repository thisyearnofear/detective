/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    optimizeCss: false
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent Farcaster miniapp caching
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, must-revalidate'
          },
          // Prevent CDN caching on Vercel
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'max-age=60'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
