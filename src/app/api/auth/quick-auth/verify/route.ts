/**
 * Quick Auth Token Verification
 * 
 * Verifies Quick Auth JWT tokens issued by Farcaster's edge-deployed service
 * The token contains the FID as the 'sub' claim
 * 
 * Reference: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyQuickAuthToken, getTokenFromHeader } from '@/lib/quickAuthUtils';
import { createAuthToken } from '@/lib/authUtils';

// Fetch user data from Neynar
async function fetchFarcasterUserData(fid: number) {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  if (!neynarApiKey) {
    throw new Error('NEYNAR_API_KEY not configured');
  }

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
    {
      headers: {
        'x-api-key': neynarApiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Farcaster user data from Neynar');
  }

  const data = await response.json();
  const user = data.users?.[0];

  if (!user) {
    throw new Error('User not found in Neynar');
  }

  return {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name || user.username,
    pfpUrl: user.pfp_url,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = getTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    // Verify Quick Auth token
    const hostname =
      request.headers.get('host') || process.env.VERCEL_URL || 'localhost';

    const payload = await verifyQuickAuthToken(token, hostname);

    const fid = payload.sub;
    if (!fid) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      );
    }

    // Fetch user data from Neynar
    const userData = await fetchFarcasterUserData(fid);

    // Create app auth token (optional: if you want your own session token)
    const appToken = createAuthToken({
      fid: userData.fid,
      username: userData.username,
      displayName: userData.displayName,
      pfpUrl: userData.pfpUrl,
      address: '', // Quick Auth doesn't provide wallet address
      verifiedAt: Date.now(),
    });

    return NextResponse.json({
      fid: userData.fid,
      username: userData.username,
      displayName: userData.displayName,
      pfpUrl: userData.pfpUrl,
      token: appToken,
      quickAuthToken: token, // Include original token if needed
    });
  } catch (error) {
    console.error('[Quick Auth Verify Error]:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Authentication verification failed',
      },
      { status: 401 }
    );
  }
}
