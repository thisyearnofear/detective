"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { sdk } from "@farcaster/miniapp-sdk";
import MultiChatContainer from "@/components/MultiChatContainer";
import GameRegister from "@/components/GameRegister";
import Leaderboard from "@/components/Leaderboard";
import AuthInput from "@/components/AuthInput";
import { GameCycleState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// This component handles the logic when the game is LIVE
// Component that displays when the game is live
const LiveGameView = ({ fid }: { fid: number }) => {
  return <MultiChatContainer fid={fid} />;
};

// Main component for the application's home page
export default function Home() {
  const [sdkUser, setSdkUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"sdk" | "web" | null>(null);
  const [isSdkLoading, setIsSdkLoading] = useState(true);

  // Use SWR for polling the game state every 3 seconds
  const { data: gameState, error: gameStateError } = useSWR(
    sdkUser ? `/api/game/status?fid=${sdkUser.fid}` : "/api/game/status",
    fetcher,
    { refreshInterval: 3000 },
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
          setAuthMode("sdk");
          await sdk.actions.ready();
        } else {
          // SDK context unavailable, fallback to web mode
          setAuthMode("web");
        }
      } catch (err) {
        console.log("Farcaster SDK not available, using web mode");
        // Gracefully fallback to web authentication
        setAuthMode("web");
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
              <h3 className="text-xl font-bold text-yellow-400 mb-2">
                Not Registered
              </h3>
              <p className="text-gray-300 mb-4">
                You missed the registration window for this game.
              </p>
              <div className="text-sm text-gray-400">
                <p>Wait for the next game cycle or</p>
                <a href="/admin" className="text-blue-400 hover:underline">
                  use Admin Panel to force register
                </a>
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
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
      <div className="w-full max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12 animate-fade-in">
          <h1 className="text-5xl sm:text-7xl font-black mb-3 sm:mb-4 bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent drop-shadow-2xl" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
            🔍 Detective
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2 drop-shadow-lg" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
            Are you talking to a human or a bot?
          </p>
          <p className="text-sm sm:text-base text-gray-200 drop-shadow-md" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            A Farcaster social deduction game
          </p>
        </div>

        {/* Main Content */}
        {!sdkUser ? (
          // Not authenticated
          <div className="space-y-6 sm:space-y-8">
            {/* Auth Card */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-slate-700/60 shadow-2xl animate-scale-in">
              <AuthInput onAuthSuccess={handleWebAuth} />
            </div>

            {/* How to Play */}
            <div className="bg-gradient-to-br from-slate-800/85 to-slate-900/85 rounded-xl p-6 border border-slate-700/50 backdrop-blur-md">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 drop-shadow-md">How to Play</h3>
              <ol className="space-y-3 text-gray-300 text-sm sm:text-base">
                {[
                  "Register for a game when registration is open.",
                  "Manage 2 simultaneous chats, each lasting 1 minute.",
                  "Vote during the chat: Is each opponent a REAL person or a BOT?",
                  "Complete multiple matches in rounds!",
                  "Climb the leaderboard with accuracy and speed!",
                ].map((rule, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-semibold text-blue-400 flex-shrink-0 min-w-6">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          // Authenticated
          <div className="space-y-6 sm:space-y-8">
            {/* User Info Card */}
            <div className="bg-gradient-to-r from-blue-900/50 to-violet-900/50 rounded-xl p-4 sm:p-6 border border-blue-500/50 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-200 drop-shadow-sm">Logged in as</p>
                  <p className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                    @{sdkUser.username}
                    {authMode === "web" && (
                      <span className="ml-2 text-xs bg-blue-900/70 text-blue-200 px-2 py-1 rounded border border-blue-500/50">
                        Web Mode
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-900/40 rounded-lg transition-colors whitespace-nowrap drop-shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Game Status */}
            {gameState && (
              <div className="bg-gradient-to-r from-amber-900/50 to-orange-900/50 rounded-xl p-4 sm:p-6 border border-amber-500/50 text-center backdrop-blur-md">
                <p className="text-xs sm:text-sm text-gray-200 mb-1 drop-shadow-sm">Game Status</p>
                <p className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-widest drop-shadow-lg">
                  {gameState.state}
                </p>
                <p className="text-xs sm:text-sm text-gray-200 mt-2 drop-shadow-sm">
                  {gameState.playerCount} players registered
                </p>
              </div>
            )}

            {/* Game Content */}
            {renderGameState()}

            {/* Back to Home */}
            {sdkUser && gameState && (
              <div className="text-center">
                <button
                  onClick={handleLogout}
                  className="text-xs sm:text-sm text-gray-300 hover:text-gray-200 transition-colors drop-shadow-sm"
                >
                  ← Return to home
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 sm:mt-12 text-center">
          <a
            href="/admin"
            className="inline-block px-4 py-2 text-xs sm:text-sm text-gray-400 hover:text-gray-300 transition-colors drop-shadow-sm font-medium"
          >
            🔧 Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}
