// src/app/api/auth/farcaster/status/route.ts
/**
 * Polls the status of a Sign In with Farcaster channel.
 * 
 * The client continuously calls this endpoint until:
 * 1. User completes signin (state === "completed")
 * 2. Channel expires (timeout)
 * 
 * When completed, this endpoint:
 * 1. Verifies the signature from Warpcast
 * 2. Fetches the user's Farcaster profile
 * 3. Creates a JWT session token
 * 4. Returns the user profile
 */

import { NextResponse } from "next/server";
import { getFarcasterUserData } from "@/lib/neynar";
import { createAuthToken } from "@/lib/authUtils";

const FARCASTER_CONNECT_URL = "https://connect.farcaster.xyz/api/auth";

export async function POST(request: Request) {
  try {
    const { channelToken } = await request.json();

    if (!channelToken) {
      return NextResponse.json(
        { error: "Channel token required" },
        { status: 400 }
      );
    }

    // Check the status of the signin channel
    const statusResponse = await fetch(`${FARCASTER_CONNECT_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "GET",
        path: `/channels/${channelToken}`,
      }),
    });

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        // Channel expired
        return NextResponse.json(
          { state: "pending", error: "Channel expired" },
          { status: 200 }
        );
      }
      throw new Error(`Farcaster Connect error: ${statusResponse.statusText}`);
    }

    const channelStatus = await statusResponse.json();

    // Channel is still pending
    if (channelStatus.result?.state !== "completed") {
      return NextResponse.json(
        { state: "pending" },
        { status: 200 }
      );
    }

    // User has signed in! Extract their data
    const result = channelStatus.result;
    const fid = result.response?.fid;

    if (!fid) {
      throw new Error("No FID in completed signin");
    }

    // Fetch complete user data from Neynar
    const userData = await getFarcasterUserData(fid);

    if (!userData || !userData.isValid || !userData.userProfile) {
      return NextResponse.json(
        {
          error: "User profile validation failed",
        },
        { status: 403 }
      );
    }

    // Create auth session
    const authSession = {
      fid: userData.userProfile.fid,
      username: userData.userProfile.username,
      displayName: userData.userProfile.displayName,
      pfpUrl: userData.userProfile.pfpUrl,
      address: "", // TODO: Get wallet address from signin response
      verifiedAt: Date.now(),
    };

    // Issue JWT token
    const token = createAuthToken(authSession);

    return NextResponse.json({
      state: "completed",
      profile: userData.userProfile,
      token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days
    });
  } catch (error: any) {
    console.error("[Farcaster Auth] Status check error:", error);
    return NextResponse.json(
      {
        state: "error",
        error: "Failed to check signin status",
        ...(process.env.NODE_ENV === "development" && { 
          details: error.message 
        }),
      },
      { status: 500 }
    );
  }
}