// src/app/api/profiles/by-address/route.ts
import { NextResponse } from "next/server";
import { getFarcasterUserByAddress } from "@/lib/neynar";
import { createAuthToken } from "@/lib/authUtils";

/**
 * API route to fetch Farcaster profile by wallet address
 * Used during wallet connection to verify wallet-to-FID ownership
 * Returns user profile + auth token for session management
 */
export async function POST(request: Request) {
  try {
    const { address } = await request.json();
    
    if (!address || !address.startsWith('0x')) {
      return NextResponse.json(
        { error: "Valid Ethereum address (0x...) is required" },
        { status: 400 }
      );
    }

    // Fetch and validate user from Neynar via wallet address
    const userData = await getFarcasterUserByAddress(address);

    if (!userData || !userData.isValid || !userData.userProfile) {
      return NextResponse.json(
        { 
          error: "No valid Farcaster profile found for this wallet. Ensure your wallet is connected to your Farcaster account and meets quality criteria." 
        },
        { status: 404 }
      );
    }

    // Create auth session with wallet verification
    const authSession = {
      fid: userData.userProfile.fid,
      username: userData.userProfile.username,
      displayName: userData.userProfile.displayName,
      pfpUrl: userData.userProfile.pfpUrl,
      address: address.toLowerCase(),
      verifiedAt: Date.now(),
    };

    // Issue JWT token for authenticated requests
    const token = createAuthToken(authSession);

    return NextResponse.json({
      success: true,
      profile: userData.userProfile,
      token, // Client stores this for subsequent API calls
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    });
  } catch (error: any) {
    console.error("Error fetching profile by address:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch profile. Please try again.",
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      },
      { status: 500 }
    );
  }
}