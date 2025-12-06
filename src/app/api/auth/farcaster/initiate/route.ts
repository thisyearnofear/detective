// src/app/api/auth/farcaster/initiate/route.ts
/**
 * Initiates a Sign In with Farcaster flow.
 * 
 * This endpoint:
 * 1. Creates a new signin channel via Farcaster Connect server
 * 2. Returns a signin URL and channel token to the client
 * 3. Client uses these to generate QR or redirect user to Warpcast
 * 
 * The user then signs in on Warpcast and the client polls for completion.
 */

import { NextResponse } from "next/server";

const FARCASTER_CONNECT_URL = "https://connect.farcaster.xyz/api/auth";

export async function POST(request: Request) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress || !walletAddress.startsWith("0x")) {
      return NextResponse.json(
        { error: "Valid Ethereum wallet address required" },
        { status: 400 }
      );
    }

    // Step 1: Request a new signin channel from Farcaster Connect
    const initiateResponse = await fetch(`${FARCASTER_CONNECT_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "POST",
        path: "/channels",
      }),
    });

    if (!initiateResponse.ok) {
      throw new Error(`Farcaster Connect error: ${initiateResponse.statusText}`);
    }

    const channelData = await initiateResponse.json();

    if (!channelData.result?.channelToken) {
      throw new Error("No channel token received from Farcaster");
    }

    const channelToken = channelData.result.channelToken;

    // The signin URL is constructed using the channel token
    // Users scan this QR code or click to open in Warpcast
    const signinUrl = `https://client.warpcast.com/deeplinks/auth?channelToken=${channelToken}`;

    // Store channel info in memory or database (for production, use Redis/DB)
    // This maps the channel token to the wallet address for verification later
    console.log(`[Farcaster Auth] New channel created for wallet ${walletAddress}`);

    return NextResponse.json({
      success: true,
      channelToken,
      signinUrl,
      expiresIn: 600, // 10 minutes
    });
  } catch (error: any) {
    console.error("[Farcaster Auth] Initiate error:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate Farcaster signin",
        ...(process.env.NODE_ENV === "development" && { 
          details: error.message 
        }),
      },
      { status: 500 }
    );
  }
}
