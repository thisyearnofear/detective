/**
 * Neynar API interactions
 * - Fetch user by FID
 * - Get user's recent casts
 * - Validate Neynar score
 */

import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

const client = new NeynarAPIClient(
  new Configuration({
    apiKey: process.env.NEYNAR_API_KEY,
  })
);

/**
 * Fetch user profile from Neynar
 */
export async function fetchUserByFid(fid: number) {
  try {
    const response = await client.fetchBulkUsers({
      fids: [fid],
      viewerFid: fid, // Can be any FID or omitted
    });

    if (response.users && response.users.length > 0) {
      const user = response.users[0];
      return {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        neynarScore: user.neynarScore || 0, // May not always be available
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching user ${fid}:`, error);
    return null;
  }
}

/**
 * Get recent casts for a user
 */
export async function getUserRecentCasts(fid: number, limit = 30): Promise<string[]> {
  try {
    const response = await client.fetchCastsByFid({
      fid,
      pageSize: limit,
    });

    if (response.casts && response.casts.length > 0) {
      return response.casts.map((cast) => cast.text || '').filter(Boolean);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching casts for ${fid}:`, error);
    return [];
  }
}

/**
 * Verify Neynar score > 0.8
 */
export async function verifyNeynarScore(fid: number, minScore = 0.8): Promise<boolean> {
  try {
    const user = await fetchUserByFid(fid);
    if (!user) return false;

    return (user.neynarScore || 0) >= minScore;
  } catch (error) {
    console.error(`Error verifying Neynar score for ${fid}:`, error);
    return false;
  }
}

/**
 * Batch fetch users (for leaderboard display, etc.)
 */
export async function fetchBulkUsers(fids: number[]) {
  try {
    const response = await client.fetchBulkUsers({ fids });
    return response.users || [];
  } catch (error) {
    console.error('Error fetching bulk users:', error);
    return [];
  }
}
