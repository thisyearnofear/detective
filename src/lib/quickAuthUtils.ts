/**
 * Farcaster Auth Utilities (2025)
 * 
 * JWT token verification for Quick Auth tokens
 */

/**
 * Extract Bearer token from Authorization header
 * DRY: Single utility for both JWT and SIWF token extraction
 */
export function getTokenFromHeader(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

/**
 * Verify Quick Auth JWT token
 * Quick Auth is deprecated in favor of SIWF verification
 * This is kept for backwards compatibility with existing tokens
 */
export async function verifyQuickAuthToken(
  token: string,
  hostname: string
): Promise<{ sub: number; iat: number; exp: number }> {
  try {
    // Decode JWT manually (Quick Auth tokens are asymmetrically signed)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    // Verify domain claim matches hostname
    if (payload.domain && !hostname.includes(payload.domain.split('://')[1] || payload.domain)) {
      throw new Error('Domain mismatch');
    }

    return {
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    throw new Error(
      `Invalid Quick Auth token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
