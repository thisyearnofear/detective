/**
 * Farcaster Mini App Notification System
 *
 * Two halves:
 *   1. Token storage — webhook events upsert/remove tokens per fid.
 *   2. Sending — POST to the Farcaster client's notification URL with
 *      the stored tokens when an offline event is delivered.
 *
 * The token is a permission granted by the Farcaster client on behalf of
 * a user. We store (fid, token, url) and look up by fid at send time.
 */

import { dbQuery } from "./database";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Token repository
// ---------------------------------------------------------------------------

export async function upsertNotificationToken(
  fid: number,
  url: string,
  token: string,
): Promise<void> {
  await dbQuery(
    `INSERT INTO notification_tokens (fid, url, token)
     VALUES ($1, $2, $3)
     ON CONFLICT (fid, token) DO UPDATE SET url = EXCLUDED.url`,
    [fid, url, token],
  );
}

export async function removeNotificationTokens(fid: number): Promise<void> {
  await dbQuery(`DELETE FROM notification_tokens WHERE fid = $1`, [fid]);
}

export async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  // Build parameterised IN-clause
  const params = tokens.map((_, i) => `$${i + 1}`);
  await dbQuery(
    `DELETE FROM notification_tokens WHERE token IN (${params.join(",")})`,
    tokens,
  );
}

interface StoredToken {
  token: string;
  url: string;
}

async function getTokensForFid(fid: number): Promise<StoredToken[]> {
  const result = await dbQuery<{ token: string; url: string }>(
    `SELECT token, url FROM notification_tokens WHERE fid = $1`,
    [fid],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
}

/**
 * Send a notification to a single investigator fid.
 *
 * Looks up all stored tokens for the fid (a user may have multiple from
 * different Farcaster clients), POSTs to the notification URL, and prunes
 * tokens that the server reports as invalid.
 *
 * Returns true if at least one notification was sent successfully.
 */
export async function sendNotificationToFid(
  fid: number,
  payload: NotificationPayload,
): Promise<boolean> {
  const tokens = await getTokensForFid(fid);
  if (tokens.length === 0) return false;

  // Group by URL — different clients may have different notification endpoints.
  const byUrl = new Map<string, string[]>();
  for (const t of tokens) {
    const arr = byUrl.get(t.url) ?? [];
    arr.push(t.token);
    byUrl.set(t.url, arr);
  }

  let anySuccess = false;
  const invalid: string[] = [];

  for (const [url, urlTokens] of byUrl) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: payload.notificationId,
          title: payload.title,
          body: payload.body,
          targetUrl: payload.targetUrl,
          tokens: urlTokens,
        }),
      });

      if (!res.ok) {
        logger.error("[notifications] Send failed", {
          apiName: "sendNotificationToFid",
          fid,
          url,
          status: res.status,
        });
        continue;
      }

      const data = (await res.json()) as {
        successfulTokens?: string[];
        invalidTokens?: string[];
        rateLimitedTokens?: string[];
      };
      if (data.successfulTokens && data.successfulTokens.length > 0) {
        anySuccess = true;
      }
      if (data.invalidTokens) {
        invalid.push(...data.invalidTokens);
      }
    } catch (err) {
      logger.error("[notifications] Send error", {
        apiName: "sendNotificationToFid",
        fid,
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (invalid.length > 0) {
    await removeInvalidTokens(invalid);
  }

  return anySuccess;
}
