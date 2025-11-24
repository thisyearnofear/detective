// src/app/api/auth/web/route.ts
import { NextResponse } from "next/server";
import { getFarcasterUserData } from "@/lib/neynar";

/**
 * Web authentication endpoint for non-Farcaster SDK users.
 * Accepts a Farcaster username and returns user profile data.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Lookup username to get FID via Neynar
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    
    if (!NEYNAR_API_KEY) {
      // Dev mode: Return mock data
      const mockFid = Math.floor(Math.random() * 10000);
      return NextResponse.json({
        success: true,
        userProfile: {
          fid: mockFid,
          username: username,
          displayName: `${username} (dev)`,
          pfpUrl: "https://i.imgur.com/vL43u65.jpg",
        },
      });
    }

    // Lookup username to get FID
    const userLookupResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          api_key: NEYNAR_API_KEY,
        },
      }
    );

    if (!userLookupResponse.ok) {
      return NextResponse.json(
        { error: "User not found on Farcaster" },
        { status: 404 }
      );
    }

    const userData = await userLookupResponse.json();
    const fid = userData.result?.user?.fid;

    if (!fid) {
      return NextResponse.json(
        { error: "Could not retrieve user FID" },
        { status: 404 }
      );
    }

    // Fetch full user data (validation, profile, casts, style)
    const { isValid, userProfile } = await getFarcasterUserData(fid);

    if (!isValid || !userProfile) {
      return NextResponse.json(
        { error: "User does not meet quality criteria (Neynar score < 0.8)" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      userProfile,
    });
  } catch (error) {
    console.error("Error in web authentication:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
