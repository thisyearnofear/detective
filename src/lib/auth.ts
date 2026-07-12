/**
 * Unified Authentication Module
 *
 * Two layers of tokens, with a strict trust model:
 *
 *   Inbound (caller) -> QuickAuth JWT (ES256, asymmetric, signed by
 *                        Farcaster's hosted JWKS). We VERIFY these on
 *                        every server call to /api/auth/quick-auth/verify.
 *
 *                      -> SIWF personal_sign (EIP-191) signature over the
 *                        SIWF message. We recover the signer address via
 *                        viem and bind it to the claimed FID through
 *                        Neynar's verified_addresses.
 *
 *   Session (after verification) -> Our own HS256 JWT (signed with
 *                                   JWT_SECRET). Liquid 7-day expiry.
 *                                   This is what the rest of the server
 *                                   calls requireAuth() against.
 *
 * Source of trust: the QuickAuth signature, the SIWF signature, and the
 * FID->verified_addresses mapping in Neynar. Do not trust caller-supplied
 * FIDs after this point — they must come from a verified session JWT.
 */

// Fail closed: production builds must have a real JWT secret. The dev fallback
// below is only used in NODE_ENV !== "production" so local dev still works.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "[auth] JWT_SECRET is required in production. Refusing to start with a forgeable token signing key.",
  );
}
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
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
// JWT SESSION TOKEN MANAGEMENT (HS256, internal)
// ============================================================================

/**
 * Create an internal session JWT for a verified user. The session token is
 * what requireAuth() validates on every consumer API call.
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
 * Verify and decode an internal session JWT. Returns null if invalid.
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
// QUICKAUTH VERIFICATION (ES256, Farcaster-hosted JWKS)
// ============================================================================

/**
 * Public JWKS endpoint that hosts the ES256 keys used to sign QuickAuth JWTs
 * issued by sdk.quickAuth.getToken(). Reference:
 * https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 */
const QUICK_AUTH_JWKS_URL = "https://api.farcaster.xyz/v2/auth/jwks";
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface JwkCache {
  /** Maps `kid` -> imported CryptoKey (P-256). */
  keys: Map<string, CryptoKey>;
  expiresAt: number;
}

/**
 * The standard JsonWebKey in lib.dom.d.ts does not include `kid` (it's a
 * recommended-but-optional extension), so we extend with the field we need.
 */
type FarcasterJwk = JsonWebKey & { kid?: string };

let jwkCache: JwkCache | null = null;
let jwkCacheInFlight: Promise<Map<string, CryptoKey>> | null = null;

/**
 * Fetch and import the JWKS that signs QuickAuth JWTs.
 *
 * - Cached at module scope for 1 hour.
 * - A forced reload happens once if the requested `kid` is not found in the
 *   cached set (handles key rotation without breaking every recent token).
 * - Concurrent fetchers share a single in-flight Promise — prevents thundering
 *   herd when many requests hit an empty cache.
 */
async function loadQuickAuthJwks(forceReload = false): Promise<Map<string, CryptoKey>> {
  if (!forceReload && jwkCache && jwkCache.expiresAt > Date.now()) {
    return jwkCache.keys;
  }

  if (jwkCacheInFlight) {
    return jwkCacheInFlight;
  }

  jwkCacheInFlight = (async () => {
    const res = await fetch(QUICK_AUTH_JWKS_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`QuickAuth JWKS fetch failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { keys?: FarcasterJwk[] };
    const imported = new Map<string, CryptoKey>();
    for (const jwk of data.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "EC" || jwk.crv !== "P-256") continue;
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        imported.set(jwk.kid, key);
      } catch {
        // Skip malformed keys; the next refresh will retry.
      }
    }
    jwkCache = { keys: imported, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
    return imported;
  })();

  try {
    return await jwkCacheInFlight;
  } finally {
    jwkCacheInFlight = null;
  }
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return new Uint8Array(Buffer.from(normalized + pad, "base64"));
}

/**
 * Strict hostname check: the token's domain claim must equal the request
 * hostname, or the request hostname must be a subdomain of the claimed
 * domain. This prevents a QuickAuth token for `evil.com` from being used
 * against `app.com`.
 */
function hostnameMatches(claim: string | undefined, hostname: string): boolean {
  if (!claim) return false;
  let host = claim;
  try {
    host = new URL(claim).hostname;
  } catch {
    // bare hostname like "detective.example.com"
  }
  host = host.toLowerCase();
  const request = hostname.toLowerCase();
  return host === request || request.endsWith(`.${host}`);
}

/**
 * Verify a QuickAuth JWT: signature against Farcaster's JWKS, exp/iat with a
 * small skew tolerance, and a domain binding to the request hostname.
 *
 * Throws on:
 *   - Malformed JWT
 *   - Algorithm other than ES256
 *   - Signer `kid` not in JWKS (even after forced re-fetch)
 *   - Signature mismatch
 *   - Expired, not-yet-valid, or missing sub claim
 *   - Domain claim missing or mismatched
 *
 * Returns the {sub=FID, iat, exp, domain} claims on success.
 */
export async function verifyQuickAuthToken(
  token: string,
  hostname: string,
): Promise<{ sub: number; iat: number; exp: number; domain?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const headerBytes = decodeBase64Url(parts[0]);
  const payloadBytes = decodeBase64Url(parts[1]);
  const signatureBytes = decodeBase64Url(parts[2]);

  const header = JSON.parse(new TextDecoder().decode(headerBytes)) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
    sub?: unknown;
    iat?: unknown;
    exp?: unknown;
    domain?: string;
  };

  if (header.alg !== "ES256") {
    throw new Error(`Unexpected QuickAuth algorithm: ${header.alg}`);
  }
  if (!header.kid) {
    throw new Error("QuickAuth JWT header missing kid");
  }

  let keys = await loadQuickAuthJwks(false);
  let key = keys.get(header.kid);
  if (!key) {
    // Possible key rotation — try once more with a forced refresh.
    keys = await loadQuickAuthJwks(true);
    key = keys.get(header.kid);
    if (!key) {
      throw new Error(`QuickAuth JWT signed by unknown key id: ${header.kid}`);
    }
  }

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signatureOk = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signatureBytes,
    signedData,
  );
  if (!signatureOk) {
    throw new Error("QuickAuth JWT signature verification failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== "number" || payload.iat > now + 300) {
    throw new Error("QuickAuth JWT issued-in-the-future");
  }
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new Error("QuickAuth JWT expired");
  }
  if (typeof payload.sub !== "number") {
    throw new Error("QuickAuth JWT missing numeric sub claim");
  }

  // Domain binding is mandatory — without it, a token issued for any domain
  // could be replayed against ours.
  const domainMatch = hostnameMatches(payload.domain, hostname);
  if (!domainMatch) {
    throw new Error(
      `QuickAuth JWT domain mismatch: claim=${payload.domain ?? "<none>"} request=${hostname}`,
    );
  }

  return {
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
    domain: payload.domain,
  };
}

// ============================================================================
// SIWF (Sign In With Farcaster) VERIFICATION
// ============================================================================

/**
 * Parse a SIWF-format message. Returns null on malformed input.
 *
 * Format reference: https://docs.farcaster.xyz/developers/siwf
 *
 *   Farcaster Sign-In
 *
 *   URI: https://example.com
 *   Version: 1
 *   Chain ID: 1
 *   Nonce: <random>
 *   Issued At: <iso8601>
 *   Expiration Time: <iso8601>
 */
interface ParsedSiwfMessage {
  uri?: string;
  domain?: string;
  nonce?: string;
  issuedAt?: string;
  expirationTimeMs?: number;
}

function parseSiwfMessage(message: string): ParsedSiwfMessage | null {
  const lines = message.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0 || !/^Farcaster/i.test(lines[0])) {
    return null;
  }
  const out: ParsedSiwfMessage = {};
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === "URI") out.uri = value;
    if (key === "Domain") out.domain = value;
    if (key === "Nonce") out.nonce = value;
    if (key === "Issued At") out.issuedAt = value;
    if (key === "Expiration Time") {
      const ms = Date.parse(value);
      if (!Number.isNaN(ms)) out.expirationTimeMs = ms;
    }
  }
  return out;
}

export interface SiwfVerificationResult {
  fid: number;
  address: string;
}

/**
 * Verify a SIWF (Sign In With Farcaster) signature.
 *
 * 1. Parse the SIWF message and validate hostname + expiration.
 * 2. Recover the signer address from (signature, message) via viem's
 *    recoverMessageAddress (EIP-191 personal_sign).
 * 3. Verify the recovered address is one of the user's Farcaster-verified
 *    eth addresses by calling Neynar with the FID.
 *
 * Throws on:
 *   - Malformed message, missing domain, expired message
 *   - Bad/short signature
 *   - Recovered address not in Neynar's verified_addresses.eth_addresses
 */
export async function verifySiwfSignature(
  message: string,
  signature: string,
  fid: number,
  hostname: string,
  neynarApiKey: string,
): Promise<SiwfVerificationResult> {
  if (!message || !signature || typeof fid !== "number") {
    throw new Error("SIWF: message, signature, and fid are required");
  }

  const parsed = parseSiwfMessage(message);
  if (!parsed) {
    throw new Error("SIWF: message is not a valid SIWF message");
  }
  if (!hostnameMatches(parsed.domain, hostname)) {
    throw new Error(
      `SIWF: domain mismatch: claim=${parsed.domain ?? "<none>"} request=${hostname}`,
    );
  }
  if (typeof parsed.expirationTimeMs !== "number") {
    throw new Error("SIWF: message must include an Expiration Time");
  }
  if (parsed.expirationTimeMs <= Date.now()) {
    throw new Error("SIWF: message has expired");
  }

  // Recover signer address — throws on malformed signature. viem narrows the
  // signature parameter to a hex literal (`0x${string}`); the input is one
  // but the type system needs explicit reassurance.
  const { recoverMessageAddress } = await import("viem");
  const recoveredAddress = await recoverMessageAddress({
    message,
    signature: signature as `0x${string}`,
  });
  const recoveredLower = recoveredAddress.toLowerCase();

  // Bind to the claimed FID through Neynar's verified eth addresses.
  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
    { headers: { api_key: neynarApiKey } },
  );
  if (!res.ok) {
    throw new Error(`SIWF: Neynar user lookup failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    users?: Array<{
      fid: number;
      verified_addresses?: { eth_addresses?: string[] };
    }>;
  };
  const user = data.users?.find((u) => u.fid === fid);
  if (!user) {
    throw new Error(`SIWF: FID ${fid} not found on Farcaster`);
  }

  const verifiedAddresses = (user.verified_addresses?.eth_addresses ?? []).map((a) =>
    a.toLowerCase(),
  );
  if (!verifiedAddresses.includes(recoveredLower)) {
    throw new Error(
      "SIWF: recovered signer address is not one of the FID's verified eth addresses",
    );
  }

  return { fid, address: recoveredAddress };
}

// ============================================================================
// HEADER EXTRACTION (DRY)
// ============================================================================

/**
 * Extract Bearer token from Authorization header.
 */
export function getTokenFromHeader(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Extract auth token from request headers (Bearer token).
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return getTokenFromHeader(authHeader);
}

// ============================================================================
// INLINE AUTH GUARD
// ============================================================================

/**
 * Discriminated union returned by `requireAuth`. Use the `ok` field to narrow.
 *   const auth = requireAuth(request);
 *   if (!auth.ok) return auth.response;
 *   const fid = auth.token.fid;   // trusted — comes from a verified JWT
 *
 * Why a value and not a wrapper? Next.js App Router handlers read `params` as a
 * separate argument, and many routes need the token mid-flow (after reading
 * the body, for example). A wrapper that took `(request, handler)` would force
 * a less natural call site.
 *
 * Source of truth: the session JWT. Do NOT read `fid` from query strings or
 * request bodies — clients can spoof that. The token is signed; trust it.
 */
export type AuthResult =
  | { ok: true; token: AuthToken }
  | { ok: false; response: Response };

export function requireAuth(request: Request): AuthResult {
  const raw = getAuthTokenFromRequest(request);
  if (!raw) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const token = verifyAuthToken(raw);
  if (!token) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Invalid or expired authorization token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return { ok: true, token };
}
