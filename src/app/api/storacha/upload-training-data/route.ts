// src/app/api/storacha/upload-training-data/route.ts
// POST /api/storacha/upload-training-data
// Upload bot training data to Storacha decentralized storage
// Requires authentication (admin or internal use)

import { NextRequest, NextResponse } from "next/server";
import { uploadBotTrainingData, isStorachaEnabled } from "@/lib/storacha";

export async function POST(request: NextRequest) {
  if (!isStorachaEnabled()) {
    return NextResponse.json(
      { error: "Storacha integration disabled" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { botUsername, originalAuthor, casts, writingStyle, personality, gameId } =
      body;

    if (!botUsername || !gameId) {
      return NextResponse.json(
        { error: "Missing required fields: botUsername, gameId" },
        { status: 400 }
      );
    }

    const result = await uploadBotTrainingData({
      botUsername,
      originalAuthor: originalAuthor ?? "",
      castCount: casts?.length ?? 0,
      casts: casts ?? [],
      writingStyle: writingStyle ?? "",
      personality: personality ?? {},
      capturedAt: new Date().toISOString(),
      gameId,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Upload failed or Storacha disabled" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cid: result.cid,
      gatewayUrl: result.gatewayUrl,
    });
  } catch (error) {
    console.error("[API] Storacha upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
