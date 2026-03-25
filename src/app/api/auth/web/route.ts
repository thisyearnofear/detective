// src/app/api/auth/web/route.ts
import { NextResponse } from "next/server";
import { getFarcasterUserDataByUsername } from "@/lib/neynar";

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
        { status: 400 },
      );
    }

    // Fetch full user data (username lookup + validation + profile + casts + style)
    const { isValid, userProfile } =
      await getFarcasterUserDataByUsername(username);

    if (!isValid || !userProfile) {
      return NextResponse.json(
        { error: "User does not meet quality criteria (Neynar score < 0.8)" },
        { status: 403 },
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
      { status: 500 },
    );
  }
}
