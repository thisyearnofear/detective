import { NextRequest, NextResponse } from 'next/server';

/**
 * Dynamic Farcaster manifest that returns the correct accountAssociation
 * based on which domain the request comes from.
 * 
 * Each domain needs its own signed accountAssociation payload.
 * Generate signatures at: https://farcaster.xyz/~/developers/mini-apps/manifest
 */

const MANIFESTS: Record<string, {
  accountAssociation: { header: string; payload: string; signature: string };
  domain: string;
}> = {
  'detectiveproof.vercel.app': {
    accountAssociation: {
      header: 'eyJmaWQiOjUyNTQsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg4QjAzQTJDMzY1YzI2MUFlQmU2ODQyMjREQkI2Qzk1OTJhQkNkRkIyIn0',
      payload: 'eyJkb21haW4iOiJkZXRlY3RpdmVwcm9vZi52ZXJjZWwuYXBwIn0',
      signature: 'f7lWtqKqtnnvuX4R3uCsMoEGurVprKqLcx25HsebwwAHgPxMXpfndM3DIKuOToeybb8NuSQ421bsDs9nRhukthw==',
    },
    domain: 'detectiveproof.vercel.app',
  },
  'detective.thisyearnofear.com': {
    // TODO: Generate this at https://farcaster.xyz/~/developers/mini-apps/manifest
    // Enter domain: detective.thisyearnofear.com and sign with your FID 5254 custody key
    accountAssociation: {
      header: 'REPLACE_WITH_SIGNED_HEADER',
      payload: 'REPLACE_WITH_SIGNED_PAYLOAD',
      signature: 'REPLACE_WITH_SIGNED_SIGNATURE',
    },
    domain: 'detective.thisyearnofear.com',
  },
};

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'detectiveproof.vercel.app';
  // Strip port if present (e.g. localhost:3000)
  const domain = host.split(':')[0];

  const config = MANIFESTS[domain] || MANIFESTS['detectiveproof.vercel.app'];
  const appUrl = `https://${config.domain}`;

  const manifest = {
    accountAssociation: config.accountAssociation,
    miniapp: {
      version: '1',
      name: 'Detective',
      iconUrl: `${appUrl}/detective.png`,
      homeUrl: appUrl,
      splashImageUrl: `${appUrl}/detective.png`,
      splashBackgroundColor: '#0f172a',
      description: 'AI-powered social deduction game. Can you tell if you\'re chatting with a real person or an AI bot?',
      primaryCategory: 'games',
      requiredChains: ['eip155:42161'],
      requiredCapabilities: [
        'wallet.getEthereumProvider',
      ],
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
