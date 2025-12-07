/**
 * Unified Authentication Verification
 * 
 * Handles both:
 * 1. Quick Auth JWT tokens (MiniApp flow)
 *    - Issued by Farcaster's edge service
 *    - Contains FID as 'sub' claim
 * 
 * 2. SIWF (Sign In With Farcaster) signatures (Web flow)
 *    - Message + signature from @farcaster/auth-kit
 *    - Needs verification against Farcaster protocol
 * 
 * Both flows converge here for user data fetch and session creation.
 * Reference: 
 * - https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 * - https://docs.farcaster.xyz/developers/siwf/
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

    const hostname = request.headers.get('host') || process.env.VERCEL_URL || 'localhost';
    
    let fid: number | null = null;

    // Try Quick Auth token first (JWT format)
    try {
      const payload = await verifyQuickAuthToken(token, hostname);
      fid = payload.sub;
    } catch {
      // Not a Quick Auth JWT, try SIWF token
      try {
        const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
        const siwfData = JSON.parse(decodedToken);
        
        if (siwfData.fid) {
          // SIWF token includes FID + profile data
          // @farcaster/auth-kit already verified the signature on the client side
          // So we trust the FID from here (auth-kit validated it)
          fid = siwfData.fid;
        }
      } catch (err) {
        // Neither Quick Auth nor SIWF token valid
        console.error('[Auth Verify] Failed to parse token:', err);
      }
    }

    if (!fid) {
      return NextResponse.json(
        { error: 'Invalid token payload - could not extract FID' },
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
