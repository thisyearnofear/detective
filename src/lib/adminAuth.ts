// src/lib/adminAuth.ts
import type { NextRequest } from "next/server";
import { getTokenFromHeader } from "@/lib/auth";

/**
 * Admin auth policy:
 * - Production: ADMIN_SECRET is REQUIRED. Missing secret rejects all admin requests.
 * - Development/Test: If ADMIN_SECRET is missing, allow a well-known local fallback.
 *
 * This keeps local workflows simple while preventing accidental weak auth in production.
 */

const LOCAL_DEV_ADMIN_SECRET = "detective-admin-secret";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Returns the active admin secret or null if none is configured for the environment.
 */
export function getAdminSecret(): string | null {
  const configured = process.env.ADMIN_SECRET?.trim();

  if (configured) {
    return configured;
  }

  // Never allow fallback in production.
  if (isProduction()) {
    return null;
  }

  return LOCAL_DEV_ADMIN_SECRET;
}

/**
 * Extract bearer token from a Next.js request.
 */
export function getBearerTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return getTokenFromHeader(authHeader);
}

/**
 * Verifies whether the provided token matches the active admin secret.
 */
export function isValidAdminToken(token: string | null | undefined): boolean {
  const secret = getAdminSecret();
  if (!secret || !token) return false;
  return token === secret;
}

/**
 * Verifies admin auth directly from request headers.
 */
export function isAdminRequest(request: NextRequest): boolean {
  const token = getBearerTokenFromRequest(request);
  return isValidAdminToken(token);
}
