import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getRecentErrors } from "@/lib/logger";

/**
 * GET /api/admin/logger/recent
 *
 * Returns the last 20 error-level logs from the in-memory ring buffer.
 *
 * Auth: same model as the other admin endpoints — Bearer token matches
 * ADMIN_SECRET, OR the caller is in the FID allowlist. The endpoint always
 * succeeds under that gate; the buffer is module-scoped so this is an O(1)
 * in-memory read with no DB hit.
 *
 * Response shape:
 *   { success: true, errors: ErrorEntry[], count: number, timestamp: number }
 *
 * Useful for the admin dashboard's "Recent errors" panel and for ad-hoc
 * diagnostics during the beta.
 */
export async function GET(request: NextRequest) {
  const auth = await checkAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const errors = getRecentErrors();
  return NextResponse.json(
    {
      success: true,
      errors,
      count: errors.length,
      timestamp: Date.now(),
    },
    { status: 200 },
  );
}
