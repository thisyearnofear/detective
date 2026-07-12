import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";
import { upsertNotificationToken, removeNotificationTokens } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/farcaster
 *
 * Farcaster clients POST lifecycle events here when users add/remove the
 * mini-app or enable/disable notifications. The body is a JSON Farcaster
 * Signature (JFS) — a signed envelope verified via Neynar's app-key
 * validation.
 *
 * Events:
 *   miniapp_added          → store token if notificationDetails present
 *   notifications_enabled  → store token
 *   miniapp_removed        → delete all tokens for fid
 *   notifications_disabled → delete all tokens for fid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await parseWebhookEvent(body, verifyAppKeyWithNeynar);

    const { fid, event } = data;

    switch (event.event) {
      case "miniapp_added":
      case "notifications_enabled": {
        const details = event.notificationDetails;
        if (details) {
          await upsertNotificationToken(fid, details.url, details.token);
          console.log(
            `[webhook] Stored notification token for fid ${fid} (${event.event})`,
          );
        }
        break;
      }
      case "miniapp_removed":
      case "notifications_disabled": {
        await removeNotificationTokens(fid);
        console.log(
          `[webhook] Removed notification tokens for fid ${fid} (${event.event})`,
        );
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[webhook/farcaster] Event processing failed", {
      apiName: "webhook/farcaster",
      error: error instanceof Error ? error.message : String(error),
    });
    // Return 200 even on error to prevent Farcaster from retrying bad payloads.
    // Real errors (Neynar down) will be caught by the logger → Discord webhook.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
