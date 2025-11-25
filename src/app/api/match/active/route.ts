// src/app/api/match/active/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { NextRequest } from "next/server";
import { getScheduledBotResponse, markBotResponseDelivered, recordBotDeliveryFailure } from "@/lib/botScheduler";
import { getGameEventPublisher } from "@/lib/gameEventPublisher";
import { getAblyServerManager } from "@/lib/ablyChannelManager";

/**
 * API route to get all active matches for a player.
 * Returns up to 2 simultaneous matches that are currently active.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");

    if (!fid) {
      return NextResponse.json({ error: "FID is required." }, { status: 400 });
    }

    const playerFid = parseInt(fid, 10);
    if (isNaN(playerFid)) {
      return NextResponse.json({ error: "Invalid FID." }, { status: 400 });
    }

    const gameState = await gameManager.getGameState();
    const rawState = await gameManager.getRawState();
    const config = await gameManager.getConfig();

    console.log(`[/api/match/active] FID: ${playerFid}, State: ${gameState.state}, Players: ${gameState.playerCount}, GameEnds: ${new Date(gameState.gameEnds).toISOString()}`);

    if (gameState.state !== "LIVE") {
      console.log(`[/api/match/active] Returning 403 - game state is ${gameState.state}, not LIVE`);
      return NextResponse.json(
        { error: "The game is not currently live.", currentState: gameState.state },
        { status: 403 },
      );
    }

    // Get all active matches for the player
    const matches = await gameManager.getActiveMatches(playerFid);

    // Deliver any scheduled bot responses that are ready
    const eventPublisher = getGameEventPublisher();
    const ablyManager = getAblyServerManager();
    
    for (const match of matches) {
      const scheduledBot = await getScheduledBotResponse(match.id);
      if (scheduledBot) {
        console.log(`[/api/match/active] Found scheduled bot response for match ${match.id}, bot FID ${scheduledBot.botFid}`);
        try {
          // Verify match still exists before attempting delivery
          const currentMatch = await gameManager.getMatch(match.id);
          if (!currentMatch) {
            // Match was cleaned up, just mark as delivered
            await markBotResponseDelivered(match.id);
            console.log(`[/api/match/active] Match ${match.id} no longer exists, cleaned up scheduled response`);
            continue;
          }

          // Add the scheduled bot response to the match
          console.log(`[/api/match/active] Attempting to deliver: "${scheduledBot.response.substring(0, 50)}${scheduledBot.response.length > 50 ? '...' : ''}"`);
          await gameManager.addMessageToMatch(match.id, scheduledBot.response, scheduledBot.botFid);
          await markBotResponseDelivered(match.id);
          
          // Publish to the match channel so connected clients get notified immediately
          const chatMessage = {
            id: `${Date.now()}-${scheduledBot.botFid}-${Math.random().toString(36).substr(2, 9)}`,
            text: scheduledBot.response,
            sender: {
              fid: scheduledBot.botFid,
              username: currentMatch.opponent.username,
            },
            timestamp: Date.now(),
          };
          await ablyManager.publishToMatchChannel(match.id, chatMessage);
          
          // Also publish game event for monitoring
          await eventPublisher.publishChatMessage(
            gameState.cycleId,
            match.id,
            playerFid,
            scheduledBot.botFid,
            scheduledBot.response
          );
          console.log(`[/api/match/active] ✓ Published bot response via Ably for match ${match.id}`);
        } catch (error) {
          // Record failure for retry logic
          await recordBotDeliveryFailure(match.id, error instanceof Error ? error : new Error(String(error)));
          console.error(`[/api/match/active] ✗ FAILED to deliver bot response for match ${match.id}:`, error);
        }
      }
    }

    // Sanitize matches before sending to client
    const sanitizedMatches = matches.map((match) => ({
      id: match.id,
      opponent: {
        fid: match.opponent.fid,
        username: match.opponent.username,
        displayName: match.opponent.displayName,
        pfpUrl: match.opponent.pfpUrl,
      },
      startTime: match.startTime,
      endTime: match.endTime,
      slotNumber: match.slotNumber,
      roundNumber: match.roundNumber,
      currentVote: match.currentVote,
      voteLocked: match.voteLocked,
      messages: match.messages,
    }));

    // Organize by slot for easier client consumption
    const slots: Record<number, any> = {};
    for (const match of sanitizedMatches) {
      slots[match.slotNumber] = match;
    }

    // Calculate total rounds dynamically based on player pool
    const players = await gameManager.getAllPlayers();
    const bots = await gameManager.getAllBots();
    const totalPlayers = players.length;
    const totalBots = bots.length;
    const totalOpponents = totalPlayers - 1 + (totalBots - 1);
    const matchesPerRound = config.simultaneousMatches;
    const maxPossibleRounds = Math.floor(
      config.gameDurationMs /
      config.matchDurationMs,
    );
    const totalRounds = Math.min(
      maxPossibleRounds,
      Math.ceil(totalOpponents / matchesPerRound),
    );

    // Calculate leaderboard position for this player (only available after game ends)
    let playerRank = 0;
    if (rawState.leaderboard && rawState.leaderboard.length > 0) {
      const rankIndex = rawState.leaderboard.findIndex(
        (entry) => entry.player.fid === playerFid
      );
      playerRank = rankIndex >= 0 ? rankIndex + 1 : 0;
    }

    const player = rawState.players.get(playerFid);
    const voteHistory = player ? player.voteHistory : [];

    return NextResponse.json({
      matches: sanitizedMatches,
      slots,
      currentRound: rawState.playerSessions.get(playerFid)?.currentRound || 1,
      totalRounds,
      nextRoundStartTime:
        rawState.playerSessions.get(playerFid)?.nextRoundStartTime,
      playerPool: {
        totalPlayers,
        totalBots,
        totalOpponents,
      },
      playerRank,
      gameState: gameState.state,
      // Include cycleId for shared channel optimization
      cycleId: gameState.cycleId,
      voteHistory,
    });
  } catch (error) {
    console.error("Error fetching active matches:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
