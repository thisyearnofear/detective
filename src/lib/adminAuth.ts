/**
 * Admin Authentication
 * 
 * Two-tier auth system:
 * 1. FID-based: Check if logged-in Farcaster user is in admin allowlist
 * 2. Secret-based: Check Bearer token against ADMIN_SECRET env var
 * 
 * Either method grants admin access.
 */

import { NextRequest, NextResponse } from "next/server";

// Admin FID allowlist (add your FIDs here)
const ADMIN_FIDS = new Set([
  5254, // thisyearnofear
  // Add more admin FIDs here
]);

// Get admin secret from env
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

export interface AdminAuthResult {
  authorized: boolean;
  method?: "fid" | "secret";
  fid?: number;
  error?: string;
}

/**
 * Check if a request is authorized for admin access
 * 
 * Checks in order:
 * 1. Bearer token matches ADMIN_SECRET
 * 2. Logged-in FID is in ADMIN_FIDS allowlist
 */
export async function checkAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  // Method 1: Check Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    
    if (ADMIN_SECRET && token === ADMIN_SECRET) {
      return {
        authorized: true,
        method: "secret",
      };
    }
  }

  // Method 2: Check FID from session/cookie
  // Try to get FID from various sources
  const fid = await getAuthenticatedFid(request);
  
  if (fid && ADMIN_FIDS.has(fid)) {
    return {
      authorized: true,
      method: "fid",
      fid,
    };
  }

  // No valid auth found
  return {
    authorized: false,
    error: "Unauthorized: Admin access requires either valid Bearer token or admin FID",
  };
}

/**
 * Simple boolean check for admin access (backwards compatible)
 */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const auth = await checkAdminAuth(request);
  
  if (auth.authorized) {
    console.log(`[Admin] Authorized via ${auth.method}${auth.fid ? ` (FID: ${auth.fid})` : ""}`);
  }
  
  return auth.authorized;
}

/**
 * Get authenticated FID from request
 * Checks multiple sources in order of preference
 */
async function getAuthenticatedFid(request: NextRequest): Promise<number | null> {
  // 1. Check x-farcaster-fid header (set by Farcaster auth)
  const fidHeader = request.headers.get("x-farcaster-fid");
  if (fidHeader) {
    const fid = parseInt(fidHeader, 10);
    if (!isNaN(fid)) return fid;
  }

  // 2. Check cookie (Farcaster Quick Auth sets this)
  const cookies = request.cookies;
  const fidCookie = cookies.get("farcaster_fid")?.value;
  if (fidCookie) {
    const fid = parseInt(fidCookie, 10);
    if (!isNaN(fid)) return fid;
  }

  // 3. Check query param (fallback for testing)
  const url = new URL(request.url);
  const fidParam = url.searchParams.get("fid");
  if (fidParam) {
    const fid = parseInt(fidParam, 10);
    if (!isNaN(fid)) return fid;
  }

  return null;
}

/**
 * Middleware wrapper for admin routes
 * Returns 401 response if not authorized
 */
export async function requireAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>
): Promise<Response> {
  const auth = await checkAdminAuth(request);

  if (!auth.authorized) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: auth.error,
        hint: "Use Bearer token or log in with admin FID",
      },
      { status: 401 }
    );
  }

  // Add auth info to request for logging
  console.log(`[Admin] Authorized via ${auth.method}${auth.fid ? ` (FID: ${auth.fid})` : ""}`);

  return handler(request);
}

/**
 * Check if admin auth is configured
 */
export function isAdminAuthConfigured(): boolean {
  return ADMIN_SECRET.length > 0 || ADMIN_FIDS.size > 0;
}

/**
 * Get admin configuration info (for debugging)
 */
export function getAdminAuthInfo() {
  return {
    secretConfigured: ADMIN_SECRET.length > 0,
    allowedFids: Array.from(ADMIN_FIDS),
    authMethods: [
      ADMIN_SECRET ? "Bearer token" : null,
      ADMIN_FIDS.size > 0 ? "FID allowlist" : null,
    ].filter(Boolean),
  };
}
