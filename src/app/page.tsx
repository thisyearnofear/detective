"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { sdk } from "@farcaster/miniapp-sdk";
import ChatWindow from "@/components/ChatWindow";
import GameRegister from "@/components/GameRegister";
import Leaderboard from "@/components/Leaderboard";
import AuthInput from "@/components/AuthInput";
import { GameCycleState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// This component handles the logic when the game is LIVE
const LiveGameView = ({ fid }: { fid: number }) => {
  const [match, setMatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findNextMatch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/match/next?fid=${fid}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to find a match.");
      }
      setMatch(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (match) {
    return <ChatWindow fid={fid} match={match} />;
  }

  return (
    <div className="text-center">
      <button
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
        onClick={findNextMatch}
        disabled={isLoading}
      >
        {isLoading ? "Finding Match..." : "Find Next Match"}
      </button>
      {error && <p className="text-red-400 mt-4">{error}</p>}
    </div>
  );
};

// Main component for the application's home page
export default function Home() {
  const [sdkUser, setSdkUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'sdk' | 'web' | null>(null);
  const [isSdkLoading, setIsSdkLoading] = useState(true);

  // Use SWR for polling the game state every 3 seconds
  const { data: gameState, error: gameStateError } = useSWR(
    sdkUser ? `/api/game/status?fid=${sdkUser.fid}` : "/api/game/status",
    fetcher,
    { refreshInterval: 3000 }
  );

  const handleLogout = () => {
    setSdkUser(null);
    setAuthMode(null);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const context = await sdk.context;
        if (context) {
          setSdkUser((context as any).user);
          setAuthMode('sdk');
          await sdk.actions.ready();
        } else {
          // SDK context unavailable, fallback to web mode
          setAuthMode('web');
        }
      } catch (err) {
        console.log("Farcaster SDK not available, using web mode");
        // Gracefully fallback to web authentication
        setAuthMode('web');
      } finally {
        setIsSdkLoading(false);
      }
    };
    initAuth();
  }, []);

  const handleWebAuth = (userProfile: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  }) => {
    setSdkUser(userProfile);
  };

  const renderGameState = () => {
    if (!gameState || !sdkUser) return null;

    switch (gameState.state as GameCycleState) {
      case "REGISTRATION":
        return <GameRegister fid={sdkUser.fid} isRegistrationOpen={true} />;
      case "LIVE":
        if (!gameState.isRegistered) {
          return (
            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <h3 className="text-xl font-bold text-yellow-400 mb-2">Not Registered</h3>
              <p className="text-gray-300 mb-4">
                You missed the registration window for this game.
              </p>
              <div className="text-sm text-gray-400">
                <p>Wait for the next game cycle or</p>
                <a href="/admin" className="text-blue-400 hover:underline">use Admin Panel to force register</a>
              </div>
            </div>
          );
        }
        return <LiveGameView fid={sdkUser.fid} />;
      case "FINISHED":
        return (
          <div>
            <h2 className="text-2xl font-bold text-center mb-4">Game Over!</h2>
            <Leaderboard />
          </div>
        );
      default:
        return null;
    }
  };

  // Main loading state for the page
  if (isSdkLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">🔍 Detective</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show game state error
  if (gameStateError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-400">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p>Failed to load game status.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2">🔍 Detective</h1>
          <p className="text-xl text-gray-300">
            Are you talking to a human or a bot?
          </p>
        </div>

        {/* Show AuthInput for web users who haven't authenticated */}
        {authMode === 'web' && !sdkUser && (
          <AuthInput onAuthSuccess={handleWebAuth} />
        )}

        {/* Show user info and game when authenticated */}
        {sdkUser && (
          <>
            <div className="bg-slate-800 rounded-lg p-4 mb-8 flex justify-between items-center">
              <div className="flex-1 text-center">
                <p className="text-sm text-gray-400">
                  Logged in as{" "}
                  <strong className="text-white">@{sdkUser.username}</strong> (FID: {sdkUser.fid})
                  {authMode === 'web' && (
                    <span className="ml-2 text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                      Web Mode
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-red-400 hover:text-red-300 underline ml-4"
              >
                Logout
              </button>
            </div>

            {/* Game Status Display */}
            {gameState && (
              <div className="bg-slate-800/50 rounded-lg p-4 mb-8 text-center">
                <p className="text-lg font-semibold uppercase tracking-widest text-blue-400">{gameState.state}</p>
                <p className="text-sm text-gray-400">{gameState.playerCount} players registered</p>
              </div>
            )}

            {/* Conditionally Rendered Game Component */}
            {renderGameState()}
          </>
        )}

        {/* How to Play Section (always visible) */}
        <div className="bg-slate-800 rounded-lg p-6 mt-12">
          <h2 className="text-xl font-bold mb-4">How to Play</h2>
          <ol className="space-y-3 text-gray-300 text-sm">
            {[
              "Register for a game when registration is open.",
              "Chat with a random opponent for 4 minutes.",
              "Vote: Is your opponent a REAL person or a BOT?",
              "Complete 5 matches and climb the leaderboard!",
            ].map((rule, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-bold text-blue-400">{i + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Admin Link (Dev Mode) */}
        <div className="mt-6 text-center">
          <a
            href="/admin"
            className="inline-block bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            🔧 Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}
