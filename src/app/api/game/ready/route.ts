import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fid } = body;

        if (!fid || typeof fid !== "number") {
            return NextResponse.json({ error: "Invalid FID provided." }, { status: 400 });
        }

        const gameStarted = await gameManager.setPlayerReady(fid);

        return NextResponse.json({
            success: true,
            gameStarted,
        });
    } catch (error) {
        console.error("Error setting player ready:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
