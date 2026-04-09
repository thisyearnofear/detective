// src/app/api/admin/register-bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getFarcasterUserDataByUsername } from "@/lib/neynar";
import { isAdminRequest } from "@/lib/adminAuth";
import type {
  AdminBulkRegisterResponse,
  AdminBulkRegisterResult,
} from "@/lib/types";

type AdminBulkRegisterRequest = {
  usernames?: string[];
};

function normalizeUsernames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((u) =>
      typeof u === "string" ? u.trim().replace(/^@/, "").toLowerCase() : "",
    )
    .filter((u) => u.length > 0);
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as AdminBulkRegisterRequest;
    const usernames = normalizeUsernames(body.usernames);

    if (usernames.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid usernames provided" },
        { status: 400 },
      );
    }

    // Prevent accidental abuse / long API runtimes
    const cappedUsernames = usernames.slice(0, 100);

    const gameState = await gameManager.getGameState();
    if (gameState.state !== "REGISTRATION") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bulk registration is only available during REGISTRATION phase",
          currentState: gameState.state,
        },
        { status: 403 },
      );
    }

    const unique = Array.from(new Set(cappedUsernames));
    const results: AdminBulkRegisterResult[] = [];

    for (const username of unique) {
      try {
        const { isValid, userProfile, recentCasts, style } =
          await getFarcasterUserDataByUsername(username);

        if (!isValid || !userProfile) {
          results.push({
            username,
            success: false,
            reason: "User not found or does not meet quality criteria",
          });
          continue;
        }

        const alreadyRegistered = await gameManager.isPlayerRegistered(
          userProfile.fid,
        );
        if (alreadyRegistered) {
          results.push({
            username,
            success: false,
            fid: userProfile.fid,
            reason: "Already registered",
          });
          continue;
        }

        const player = await gameManager.registerPlayer(
          userProfile,
          recentCasts,
          style,
        );

        if (!player) {
          results.push({
            username,
            success: false,
            fid: userProfile.fid,
            reason: "Registration failed (game may be full)",
          });
          continue;
        }

        results.push({
          username,
          success: true,
          fid: player.fid,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        results.push({
          username,
          success: false,
          reason: message,
        });
      }
    }

    const registered = results.filter((r) => r.success).length;
    const failed = results.length - registered;

    const response: AdminBulkRegisterResponse = {
      success: true,
      total: results.length,
      registered,
      failed,
      results,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("[Admin Bulk Register] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process bulk registration" },
      { status: 500 },
    );
  }
}
