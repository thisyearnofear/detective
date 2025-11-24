// src/lib/neynar.ts
import { UserProfile } from "./types";
import { inferWritingStyle } from "./inference";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// As per the docs, the quality score required to play.
const NEYNAR_SCORE_THRESHOLD = 0.8;

interface FarcasterUserData {
  isValid: boolean;
  userProfile: UserProfile | null;
  recentCasts: { text: string }[];
  style: string;
}

/**
 * Fetches all necessary Farcaster data for a user, including profile,
 * validation, recent casts, and inferred writing style.
 *
 * @param fid The Farcaster ID of the user.
 * @returns A comprehensive object with all user data for the game.
 */
export async function getFarcasterUserData(
  fid: number
): Promise<FarcasterUserData> {
  // For local development without an API key, return mock data.
  if (!NEYNAR_API_KEY) {
    console.warn("NEYNAR_API_KEY is not set. Returning mock user data.");
    const mockCasts = [
      { text: "Just enjoying a cup of coffee and coding." },
      { text: "Farcaster is a really interesting platform." },
    ];
    return {
      isValid: true,
      userProfile: {
        fid,
        username: `testuser${fid}`,
        displayName: `Test User ${fid}`,
        pfpUrl: "https://i.imgur.com/vL43u65.jpg",
      },
      recentCasts: mockCasts,
      style: await inferWritingStyle(mockCasts.map(c => c.text)),
    };
  }

  try {
    // 1. Fetch user profile for validation and basic info
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", api_key: NEYNAR_API_KEY },
    });

    if (!userResponse.ok) throw new Error(`Neynar user API error: ${userResponse.statusText}`);
    const userData = await userResponse.json();
    const user = userData.users?.[0];

    if (!user) return { isValid: false, userProfile: null, recentCasts: [], style: "" };

    // 2. Perform validation (using mock logic as before)
    const mockScore = user.follower_count > 100 ? 0.9 : 0.7;
    const isValid = mockScore >= NEYNAR_SCORE_THRESHOLD;

    if (!isValid) return { isValid: false, userProfile: null, recentCasts: [], style: "" };

    const userProfile: UserProfile = {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
    };

    // 3. Fetch user's recent casts
    const feedResponse = await fetch(`https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=15`, {
      method: "GET",
      headers: { "Content-Type": "application/json", api_key: NEYNAR_API_KEY },
    });
    if (!feedResponse.ok) throw new Error(`Neynar feed API error: ${feedResponse.statusText}`);
    const feedData = await feedResponse.json();
    const recentCasts: { text: string }[] = feedData.casts.map((c: any) => ({ text: c.text }));

    if (recentCasts.length < 5) {
      return { isValid: false, userProfile: null, recentCasts: [], style: "" };
    }

    // 4. Infer writing style from casts
    const style = await inferWritingStyle(recentCasts.map(c => c.text));

    return { isValid: true, userProfile, recentCasts, style };

  } catch (error) {
    console.error("Error fetching Farcaster user data:", error);
    return { isValid: false, userProfile: null, recentCasts: [], style: "" };
  }
}