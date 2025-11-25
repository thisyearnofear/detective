import { NextRequest, NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { UserProfile } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");
    if (!fidParam) {
      return NextResponse.json({ error: "fid is required" }, { status: 400 });
    }
    const fid = parseInt(fidParam, 10);
    if (!Number.isFinite(fid)) {
      return NextResponse.json({ error: "fid must be a number" }, { status: 400 });
    }

    const players = gameManager.getAllPlayers();
    const bots = gameManager.getAllBots();

    const foundPlayer = players.find((p) => p.fid === fid);
    const foundBot = bots.find((b) => b.fid === fid);
    const found = (foundPlayer || foundBot) as any;

    if (!found) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile: UserProfile = {
      fid: found.fid,
      username: found.username,
      displayName: found.displayName,
      pfpUrl: found.pfpUrl,
    };

    return NextResponse.json({ success: true, username: profile.username, userProfile: profile });
  } catch (error) {
    console.error("Error in profiles/random:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
