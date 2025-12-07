/**
 * Quick Auth Utilities (2025 Recommended Approach)
 * 
 * Uses @farcaster/quick-auth - the official edge-deployed service for seamless Farcaster authentication
 * Provides automatic session token generation without manual nonce management
 * 
 * Reference: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 */

import { createClient, Errors } from '@farcaster/quick-auth';

export type QuickAuthUser = {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
};

/**
 * Creates a Quick Auth client configured for your domain
 * The token is asymmetrically signed and can be verified locally on your server
 */
export function createQuickAuthClient() {
  return createClient();
}

/**
 * Verifies a Quick Auth JWT token on the server
 * Returns the decoded payload with fid as the 'sub' property
 * 
 * @param token - JWT token from client
 * @param hostname - Your app's hostname for verification
 */
export async function verifyQuickAuthToken(
  token: string,
  hostname: string
): Promise<{ sub: number; iat: number; exp: number }> {
  const client = createQuickAuthClient();
  
  try {
    const payload = await client.verifyJwt({
      token,
      domain: hostname,
    });
    return payload;
  } catch (error) {
    if (error instanceof Errors.InvalidTokenError) {
      throw new Error(`Invalid Quick Auth token: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function getTokenFromHeader(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}
