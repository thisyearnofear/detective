// src/lib/authUtils.ts
// Lightweight auth utilities for JWT creation/verification and session management

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

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

/**
 * Extract auth token from request headers (Bearer token)
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

/**
 * Verify request has valid auth token
 */
export function verifyAuthRequest(request: Request): AuthToken | null {
  const token = getAuthTokenFromRequest(request);
  return token ? verifyAuthToken(token) : null;
}

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
