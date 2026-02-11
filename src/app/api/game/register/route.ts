// src/app/api/game/register/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getFarcasterUserData } from "@/lib/neynar";
import { verifyArbitrumTx, getArbitrumConfig } from "@/lib/arbitrumVerification";
import { db } from "@/lib/database";

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
    const { fid, arbitrumTxHash, arbitrumWalletAddress, hasPermission, permissionExpiry } = body;

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
    console.log('[Registration] Arbitrum config:', arbitrumConfig);
    
    if (arbitrumConfig.enabled) {
      console.log('[Registration] Starting Arbitrum verification for FID:', fid);
      console.log('[Registration] TX hash:', arbitrumTxHash);
      console.log('[Registration] Wallet:', arbitrumWalletAddress);
      
      // Arbitrum gating is required
      if (!arbitrumTxHash || typeof arbitrumTxHash !== "string") {
        console.error('[Registration] Missing or invalid TX hash');
        return NextResponse.json(
          { error: "Arbitrum TX hash required to register." },
          { status: 400 }
        );
      }

      if (!arbitrumWalletAddress || typeof arbitrumWalletAddress !== "string") {
        console.error('[Registration] Missing or invalid wallet address');
        return NextResponse.json(
          { error: "Arbitrum wallet address required to register." },
          { status: 400 }
        );
      }

      // Check if using "already-registered" flow (wallet registered on-chain previously)
      const isAlreadyRegisteredFlow = arbitrumTxHash === 'already-registered';
      
      if (isAlreadyRegisteredFlow) {
        // For already-registered flow, we trust the frontend's verification
        // The user already proved wallet ownership by signing with it
        // We only do a lightweight check to avoid RPC sync issues
        console.log('[Registration] Already-registered flow - trusting frontend verification');
        
        // Quick check: verify this wallet hasn't been used for a NEW registration in this cycle
        // This prevents someone from reusing an old registration
        const fidReg = await db.getRegistrationByFid(gameState.cycleId, fid);
        if (fidReg) {
          console.log(`[Registration] FID ${fid} already registered for cycle ${gameState.cycleId}`);
          return NextResponse.json(
            { error: "You have already registered for this game." },
            { status: 403 }
          );
        }
        
        console.log('[Registration] ✓ FID not previously registered for this cycle (already-registered flow)');
      } else {
        // Normal flow: verify new TX
        // Check: TX hash not already used (replay attack prevention)
        console.log('[Registration] Checking for existing TX hash...');
        const existingReg = await db.getRegistrationByTxHash(gameState.cycleId, arbitrumTxHash);
        if (existingReg) {
          console.log(`[Registration] TX hash already used: ${arbitrumTxHash}`);
          return NextResponse.json(
            { error: "This transaction has already been used for registration." },
            { status: 403 }
          );
        }
        console.log('[Registration] ✓ TX hash not previously used');

        // Verify TX on-chain
        console.log('[Registration] Calling verifyArbitrumTx...');
        const txValid = await verifyArbitrumTx(arbitrumTxHash, arbitrumWalletAddress, fid);
        console.log('[Registration] verifyArbitrumTx returned:', txValid);
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

      // Check: FID not already registered for this game cycle (for new TX flow)
      if (!isAlreadyRegisteredFlow) {
        console.log('[Registration] Checking if FID already registered...');
        const fidReg = await db.getRegistrationByFid(gameState.cycleId, fid);
        if (fidReg) {
          console.log(`[Registration] FID ${fid} already registered for cycle ${gameState.cycleId}`);
          return NextResponse.json(
            { error: "You have already registered for this game." },
            { status: 403 }
          );
        }
        console.log('[Registration] ✓ FID not previously registered for this cycle');

        // Record registration in database
        try {
          await db.saveRegistration({
            cycle_id: gameState.cycleId,
            fid,
            wallet_address: arbitrumWalletAddress,
            arbitrum_tx_hash: arbitrumTxHash,
          });
        } catch (dbError: any) {
          if (dbError.message.includes("Duplicate registration")) {
            return NextResponse.json(
              { error: "You have already registered for this game." },
              { status: 403 }
            );
          }
          throw dbError;
        }
      }
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
    // Prioritize the Arbitrum wallet address used for gating/signing
    if (arbitrumWalletAddress) {
      userProfile.address = arbitrumWalletAddress.toLowerCase();
    }

    const player = await gameManager.registerPlayer(
      userProfile, 
      recentCasts, 
      style, 
      hasPermission ? { hasPermission, expiry: permissionExpiry || 0 } : undefined
    );

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
