// src/app/api/game/register/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getFarcasterUserData } from "@/lib/neynar";
import { verifyArbitrumTx, getArbitrumConfig } from "@/lib/arbitrumVerification";

/**
 * API route to register a user for the current game cycle.
 * 
 * Request body:
 * {
 *   fid: number,                    // Farcaster ID (required)
 *   arbitrumTxHash?: string,        // Arbitrum TX hash (required if Arbitrum gating enabled)
 *   arbitrumWalletAddress?: string, // Wallet that sent TX (required if Arbitrum gating enabled)
 * }
 * 
 * FLOW:
 * 1. Validate request body
 * 2. Check game state (REGISTRATION phase only)
 * 3. Verify Arbitrum TX (if enabled)
 * 4. Fetch Farcaster user data (Neynar quality check)
 * 5. Register player with game manager
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid, arbitrumTxHash, arbitrumWalletAddress } = body;

    // ========== STEP 1: VALIDATE REQUEST ==========
    if (!fid || typeof fid !== "number" || fid <= 0) {
      return NextResponse.json(
        { error: "Invalid FID provided. FID must be a positive integer." },
        { status: 400 }
      );
    }

    // ========== STEP 2: CHECK GAME STATE ==========
    const gameState = await gameManager.getGameState();
    if (gameState.state !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Registration is currently closed." },
        { status: 403 }
      );
    }

    // ========== STEP 3: VERIFY ARBITRUM TX (if enabled) ==========
    const arbitrumConfig = getArbitrumConfig();
    if (arbitrumConfig.enabled) {
      // Arbitrum gating is required
      if (!arbitrumTxHash || typeof arbitrumTxHash !== "string") {
        return NextResponse.json(
          { error: "Arbitrum TX hash required to register." },
          { status: 400 }
        );
      }

      if (!arbitrumWalletAddress || typeof arbitrumWalletAddress !== "string") {
        return NextResponse.json(
          { error: "Arbitrum wallet address required to register." },
          { status: 400 }
        );
      }

      // Verify TX on-chain
      const txValid = await verifyArbitrumTx(arbitrumTxHash, arbitrumWalletAddress, fid);
      if (!txValid) {
        return NextResponse.json(
          {
            error: "Arbitrum TX verification failed. Please check that the transaction was sent to the correct contract with the correct FID.",
            txHash: arbitrumTxHash,
          },
          { status: 403 }
        );
      }

      console.log(`[Registration] Arbitrum TX verified for FID ${fid}: ${arbitrumTxHash}`);
    }

    // ========== STEP 4: FETCH FARCASTER USER DATA ==========
    const { isValid, userProfile, recentCasts, style } = await getFarcasterUserData(fid);

    if (!isValid || !userProfile) {
      return NextResponse.json(
        { error: "User does not meet the quality criteria to join. (Neynar score too low)" },
        { status: 403 }
      );
    }

    // ========== STEP 5: REGISTER PLAYER ==========
    const player = await gameManager.registerPlayer(userProfile, recentCasts, style);

    if (!player) {
      return NextResponse.json(
        { error: "Failed to register player. The game might be full." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Player registered successfully.",
      player,
      arbitrumVerified: arbitrumConfig.enabled,
    });
  } catch (error) {
    console.error("[Registration] Error in game registration:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}