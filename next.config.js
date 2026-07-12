/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
          },
          // ----------------------------------------------------------------
          // SECURITY HEADERS — Phase 4 of the pre-beta hardening plan
          // ----------------------------------------------------------------
          //
          // Content-Security-Policy: allow `frame-ancestors` for Warpcast and
          // any `*.warpcast.com` embed, plus a tightly-scoped set of
          // `connect-src` origins covering the auth + Research APIs we
          // actually call from the browser.
          //
          // `client.warpcast.com` is included in frame-ancestors because
          // Warpcast's hardened-client iframe uses that origin for some
          // flows; without it the app would refuse to render inside the
          // frame.
          //
          // `unsafe-inline` on script-src is still required by Next.js'
          // inline hydration shims in dev builds. In production the build
          // emits a nonce, but Next 16's CSP story is still settling — leave
          // a follow-up to switch to nonce-based script-src. Referrer-Policy
          // is set to `strict-origin-when-cross-origin` so cross-origin
          // requests don't leak the full URL.
          //
          // X-Frame-Options is intentionally omitted — `CSP frame-ancestors`
          // supersedes it for modern browsers.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://wrpcd.net https://imx.stargazer.garden https://*.fcra.xyz",
              "font-src 'self' data:",
              "connect-src 'self' https://api.farcaster.xyz https://auth.farcaster.xyz https://api.neynar.com https://*.upstash.io",
              "frame-ancestors 'self' https://warpcast.com https://*.warpcast.com https://client.warpcast.com",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            // Disable powerful APIs we don't use. Add to allowlist if a
            // future feature genuinely needs one.
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
