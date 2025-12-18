/**
 * Unified Authentication Module (December 2025)
 * 
 * Consolidated auth utilities:
 * - JWT token creation/verification
 * - Quick Auth token handling
 * - Session management
 * 
 * Single source of truth for all auth logic across MiniApp and web flows.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ============================================================================
// TYPES
// ============================================================================

export interface AuthSession {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  address: string;
  verifiedAt: number;
}

interface AuthToken {
  fid: number;
  username: string;
  address: string;
  iat: number;
  exp: number;
}

// ============================================================================
// JWT TOKEN MANAGEMENT
// ============================================================================

/**
 * Create a JWT token for authenticated users
 */
export function createAuthToken(session: AuthSession): string {
  const now = Math.floor(Date.now() / 1000);
  const token: AuthToken = {
    fid: session.fid,
    username: session.username,
    address: session.address,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(token)).toString('base64url');
  
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export function verifyAuthToken(token: string): AuthToken | null {
  try {
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) return null;

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (decoded.exp < now) return null; // Expired

    return decoded as AuthToken;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// QUICK AUTH TOKEN HANDLING
// ============================================================================

/**
 * Verify Quick Auth JWT token (from Farcaster's edge service)
 * Quick Auth tokens are asymmetrically signed JWTs with FID as 'sub' claim
 */
export async function verifyQuickAuthToken(
  token: string,
  hostname: string
): Promise<{ sub: number; iat: number; exp: number }> {
  try {
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

// ============================================================================
// HEADER EXTRACTION (DRY)
// ============================================================================

/**
 * Extract Bearer token from Authorization header
 * Used for both JWT and SIWF token extraction
 */
export function getTokenFromHeader(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

/**
 * Extract auth token from request headers (Bearer token)
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  return getTokenFromHeader(authHeader);
}

/**
 * Verify request has valid auth token
 */
export function verifyAuthRequest(request: Request): AuthToken | null {
  const token = getAuthTokenFromRequest(request);
  return token ? verifyAuthToken(token) : null;
}

// ============================================================================
// PROTECTED ROUTE HANDLER
// ============================================================================

/**
 * Helper for protected API routes - returns error response if auth fails
 */
export async function withAuth(
  request: Request,
  handler: (token: AuthToken) => Promise<Response>
): Promise<Response> {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const verified = verifyAuthToken(token);
  if (!verified) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired authorization token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return handler(verified);
}
