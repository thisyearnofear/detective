/**
 * Centralized API configuration and fetcher functions
 * DRY: Single source of truth for API base URL and fetching logic
 *
 * Usage:
 * - useSWR(getApiUrl('/api/endpoint'), fetcher)
 * - await fetch(getApiUrl('/api/endpoint'), options)
 * - await requestJson<ResponseType>('/api/endpoint', options)
 *
 * Session auth: any stored session JWT is automatically attached as
 * Authorization: Bearer <jwt> on calls issued from the browser. Server-side
 * callers (Next.js API routes, scripts) have no localStorage and are not
 * affected.
 *
 * Session expiry: a 401 from any of the three helpers clears the stored
 * session and dispatches a window CustomEvent("auth:expired") so any mounted
 * page can react (e.g. clear cached user state and re-mount AuthComponent).
 * The auth-issuing endpoint (/api/auth/quick-auth/verify) is excluded from
 * this path — its 401s come from signature/host failures DURING fresh signin,
 * not from an expired session.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const AUTH_ISSUE_ENDPOINTS = new Set<string>([
  "/api/auth/quick-auth/verify",
]);

/** Stable event name so consumers can attach listeners without typos. */
export const AUTH_EXPIRED_EVENT = "auth:expired";

/**
 * Build full API URL from relative path
 * Routes to dedicated backend when configured, falls back to relative URL
 */
export function getApiUrl(path: string): string {
  if (BACKEND_URL && path.startsWith("/api/")) {
    return `${BACKEND_URL}${path}`;
  }
  return path;
}

/**
 * Read the session JWT from localStorage if we're in a browser context.
 * Returns null on the server (SSR / scripts).
 */
function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("auth-token");
  } catch {
    return null;
  }
}

/**
 * Drop the stored session and notify any page-level listener. SSR-safe:
 * no-op on the server. Best-effort: catches the localStorage exceptions
 * that some browsers throw when storage is disabled.
 */
function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("auth-token");
    window.localStorage.removeItem("cached-user");
  } catch {
    // Storage may be disabled; the worst case is the page keeps its
    // in-memory sdkUser and just stops making authenticated calls.
  }
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  } catch {
    // CustomEvent / dispatchEvent can fail in older browsers; non-fatal.
  }
}

/**
 * Merge the automatic auth header with caller headers. Caller-provided
 * Authorization wins — we never clobber an intentional header.
 */
function mergeHeaders(init?: RequestInit): HeadersInit | undefined {
  const incoming = (init?.headers ?? {}) as Record<string, string>;
  if (incoming.Authorization || incoming.authorization) {
    return init?.headers;
  }
  const token = readSessionToken();
  if (!token) {
    return init?.headers;
  }
  return { ...incoming, Authorization: `Bearer ${token}` };
}

/**
 * True when the URL pattern is an auth-issuing endpoint. We don't clear
 * stored sessions on these — their 401s come from signature failures
 * during fresh signin, not from an expired session.
 */
function isAuthIssuingEndpoint(url: string): boolean {
  // Normalize: strip query string and base URL prefix.
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Relative URL — strip query string manually.
    const qIdx = path.indexOf("?");
    if (qIdx >= 0) path = path.slice(0, qIdx);
  }
  return AUTH_ISSUE_ENDPOINTS.has(path);
}

/**
 * Centralized SWR fetcher function
 * Single source of truth for API data fetching
 *
 * Usage: useSWR(getApiUrl('/api/endpoint'), fetcher)
 */
export const fetcher = async (url: string) => {
  const res = await fetch(getApiUrl(url), {
    cache: "no-store",
    headers: mergeHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 && !isAuthIssuingEndpoint(url)) {
      clearStoredSession();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
};

/**
 * Typed JSON request helper for API calls.
 * Centralizes URL resolution and HTTP error handling while preserving response typing.
 *
 * Usage:
 * - const data = await requestJson<MyResponse>('/api/admin/state');
 * - const data = await requestJson<MyResponse>('/api/admin/state', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 */
export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(getApiUrl(url), {
    cache: "no-store",
    ...init,
    headers: mergeHeaders(init),
  });

  if (!res.ok) {
    if (res.status === 401 && !isAuthIssuingEndpoint(url)) {
      clearStoredSession();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

/**
 * SWR fetcher with error handling for 403 (game not live)
 * Used for match/game endpoints where 403 is expected
 */
export const fetcherWithGameNotLive = async (url: string) => {
  const res = await fetch(getApiUrl(url), {
    cache: "no-store",
    headers: mergeHeaders(),
  });
  if (!res.ok) {
    // 401 still triggers session-clear regardless of expected-vs-unexpected.
    if (res.status === 401 && !isAuthIssuingEndpoint(url)) {
      clearStoredSession();
    }
    // Handle 403 specially - game not live, return the state info
    if (res.status === 403) {
      const data = await res.json().catch(() => ({ currentState: "UNKNOWN" }));
      return { gameNotLive: true, currentState: data.currentState };
    }
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
};
