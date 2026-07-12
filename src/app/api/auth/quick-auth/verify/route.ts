// src/app/api/auth/quick-auth/verify/route.ts
/**
 * Unified session-issuance endpoint.
 *
 * Accepts either MiniApp QuickAuth OR web SIWF and, on success, returns the
 * internal session JWT that the rest of the server uses (requireAuth).
 *
 * This single endpoint replaces the broken /api/auth/quick-auth/verify call
 * that AuthComponent already issues AND the SIWF "tempToken" pseudo-token it
 * used to construct. Both paths now finish in a single, cryptographically-
 * grounded verification step.
 *
 * Request:
 *   { kind: "quick-auth", token: <JWT from sdk.quickAuth.getToken()> }
 *   or
 *   { kind: "siwf", signature, message, fid }   // from @farcaster/auth-kit
 *
 * Response:
 *   200 { token: <session JWT>, user: { fid, username, displayName, pfpUrl } }
 *   400 missing fields
 *   401 signature verification failed
 *   403 FID valid but profile failed validation, OR signature doesn't bind to FID
 *   500 Neynar / JWKS unreachable
 *
 * No caller-supplied fid is trusted at this layer — the fid is recovered
 * from the verified signature.
 */

import { NextResponse } from "next/server";
import {
  verifyQuickAuthToken,
  verifySiwfSignature,
  createAuthToken,
} from "@/lib/auth";
import { getFarcasterUserData } from "@/lib/neynar";
import { getEnv } from "@/lib/env";

type VerifyRequest =
  | { kind: "quick-auth"; token: string }
  | { kind: "siwf"; signature: string; message: string; fid: number };

interface VerifyResponseUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  const env = getEnv();

  let body: VerifyRequest;
  try {
    body = (await request.json()) as VerifyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("kind" in body)) {
    return NextResponse.json({ error: "Missing `kind`" }, { status: 400 });
  }

  const url = new URL(request.url);
  const hostname =
    request.headers.get("host")?.split(":")[0] ?? url.hostname ?? "";

  let fid: number;
  try {
    if (body.kind === "quick-auth") {
      if (!body.token || typeof body.token !== "string") {
        return NextResponse.json(
          { error: "Missing `token`" },
          { status: 400 },
        );
      }
      const verified = await verifyQuickAuthToken(body.token, hostname);
      fid = verified.sub;
    } else if (body.kind === "siwf") {
      if (
        !body.signature ||
        !body.message ||
        typeof body.fid !== "number"
      ) {
        return NextResponse.json(
          { error: "Missing SIWF fields" },
          { status: 400 },
        );
      }
      const verified = await verifySiwfSignature(
        body.message,
        body.signature,
        body.fid,
        hostname,
        env.NEYNAR_API_KEY,
      );
      fid = verified.fid;
    } else {
      return NextResponse.json(
        { error: `Unknown kind: ${String((body as { kind: unknown }).kind)}` },
        { status: 400 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    // Verification failures (signature mismatch, expired token, domain
    // mismatch, etc.) are caller errors — 401.
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // The fid is now trusted. Fetch the canonical profile.
  let profile;
  try {
    profile = await getFarcasterUserData(fid);
  } catch (err) {
    console.error("[auth/verify] Neynar failure:", err);
    return NextResponse.json(
      { error: "User profile lookup unavailable" },
      { status: 503 },
    );
  }

  if (!profile.isValid || !profile.userProfile) {
    return NextResponse.json(
      { error: "User profile validation failed" },
      { status: 403 },
    );
  }

  const user: VerifyResponseUser = {
    fid: profile.userProfile.fid,
    username: profile.userProfile.username,
    displayName: profile.userProfile.displayName,
    pfpUrl: profile.userProfile.pfpUrl,
  };

  const sessionToken = createAuthToken({
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl,
    address: profile.userProfile.address ?? "",
    verifiedAt: Date.now(),
  });

  return NextResponse.json(
    {
      token: sessionToken,
      user,
      expiresIn: SESSION_TTL_SECONDS,
    },
    { status: 200 },
  );
}
