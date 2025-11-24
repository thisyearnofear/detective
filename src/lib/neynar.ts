// src/lib/neynar.ts
import { UserProfile } from "./types";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_API_URL = "https://api.neynar.com/v2/farcaster/user/bulk";

// As per the docs, the quality score required to play.
const NEYNAR_SCORE_THRESHOLD = 0.8;

/**
 * Validates a user against the Neynar quality score threshold.
 *
 * @param fid The Farcaster ID of the user to validate.
 * @returns A boolean indicating if the user is valid, and the user's profile.
 */
export async function validateUser(
  fid: number
): Promise<{ isValid: boolean; userProfile: UserProfile | null }> {
  if (!NEYNAR_API_KEY) {
    console.warn(
      "NEYNAR_API_KEY is not set. Returning mock validation success."
    );
    // Return a mock success response for local development without an API key.
    return {
      isValid: true,
      userProfile: {
        fid,
        username: `testuser${fid}`,
        displayName: `Test User ${fid}`,
        pfpUrl: "https://i.imgur.com/vL43u65.jpg",
      },
    };
  }

  try {
    const response = await fetch(`${NEYNAR_API_URL}?fids=${fid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api_key": NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data = await response.json();
    const user = data.users?.[0];

    if (!user) {
      return { isValid: false, userProfile: null };
    }

    // This is a placeholder for the actual score calculation.
    // The Neynar bulk user endpoint doesn't directly provide the same "score"
    // as other endpoints might. For this MVP, we'll simulate a check.
    // A more robust implementation might need a different endpoint or logic.
    const mockScore = user.follower_count > 100 ? 0.9 : 0.7; // Example logic
    const isValid = mockScore >= NEYNAR_SCORE_THRESHOLD;

    return {
      isValid,
      userProfile: {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      },
    };
  } catch (error) {
    console.error("Error validating user with Neynar:", error);
    return { isValid: false, userProfile: null };
  }
}

/**
 * Fetches recent casts for a user to be used in bot training.
 * NOTE: This is a placeholder and would need a real implementation.
 *
 * @param fid The Farcaster ID of the user.
 * @returns An array of recent casts.
 */
export async function getRecentCasts(fid: number): Promise<any[]> {
  console.log(`Fetching recent casts for fid: ${fid} (mock)`);
  return [
    { text: "Just enjoying a cup of coffee and coding." },
    { text: "Farcaster is a really interesting platform." },
    { text: "Has anyone tried the new Next.js 15 features yet?" },
  ];
}