"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { sdk } from "@farcaster/miniapp-sdk";
import MultiChatContainer from "@/components/MultiChatContainer";
import GameRegister from "@/components/GameRegister";
import Leaderboard from "@/components/Leaderboard";
import AuthInput from "@/components/AuthInput";
import SpinningDetective from "@/components/SpinningDetective";
import AnimatedGridBackdrop from "@/components/AnimatedGridBackdrop";
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
              <h3 className="hero-title text-xl font-black text-yellow-400 mb-2 text-stroke">
                Not Registered
              </h3>
              <p className="text-gray-300 mb-4">
                You missed the registration window for this game.
              </p>
              <div className="text-sm text-gray-400">
                <p>Wait for the next game cycle or</p>
                <a href="/admin" className="hero-title text-blue-400 hover:text-stroke-white transition-all duration-300">
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
            <h2 className="hero-title text-2xl font-black text-center mb-4 text-stroke hover:text-stroke-white transition-all duration-300">Game Over!</h2>
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
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="text-center">
          <SpinningDetective size="xl" className="mb-6" />
          <h1 className="hero-title text-3xl font-black text-stroke">🔍 Detective</h1>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show game state error
  if (gameStateError) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="text-center text-red-400">
          <h1 className="hero-title text-2xl font-black text-stroke">Error</h1>
          <p className="text-sm">Failed to load game status.</p>
        </div>
      </div>
    );
  }

  // Generate grid images array
  const gridImages = Array.from({ length: 9 }, (_, i) => `/grid-images/${i + 1}.jpg`);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative py-12 px-4">
      <AnimatedGridBackdrop images={gridImages} />
      
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-2xl bg-slate-900/80 backdrop-blur-sm rounded-lg p-8 sm:p-12 border border-slate-800/50">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="hero-title text-5xl sm:text-6xl font-black mb-4 text-stroke hover:text-stroke-white transition-all duration-300">
            🔍 Detective
          </h1>
          <p className="text-base sm:text-lg text-gray-300 mb-8">
            An onchain social deduction game
          </p>
        </div>

        {/* Main Content */}
        {!sdkUser ? (
          // Not authenticated
          <div className="space-y-8">
            {/* Auth Card */}
            <div className="card animate-scale-in">
              <AuthInput onAuthSuccess={handleWebAuth} />
            </div>

            {/* How to Play */}
            <div className="card mt-12">
              <h3 className="hero-title text-2xl font-black mb-8 text-stroke text-center hover:text-stroke-white transition-all duration-300">How to Play</h3>
              <div className="space-y-4 text-gray-300 text-base text-center">
                {[
                  "Register for a game when registration is open.",
                  "Manage 2 simultaneous chats, each lasting 1 minute.",
                  "Vote during the chat: Is each opponent a REAL person or a BOT?",
                  "Complete multiple matches in rounds!",
                  "Climb the leaderboard with accuracy and speed!",
                ].map((rule, i) => (
                  <p key={i} className="leading-relaxed">{rule}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Authenticated
          <div className="space-y-8">
            {/* User Info Card */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-200">Logged in as</p>
                  <p className="text-lg font-bold text-white">
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
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Game Status */}
            {gameState && (
              <div className="card text-center">
                <p className="text-xs text-gray-200 mb-1">Game Status</p>
                <p className="hero-title text-xl font-black text-stroke uppercase tracking-widest hover:text-stroke-white transition-all duration-300">
                  {gameState.state}
                </p>
                <p className="text-xs text-gray-200 mt-1">
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
                  className="text-xs text-gray-300 hover:text-gray-200 transition-colors"
                >
                  ← Return to home
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 text-center border-t border-gray-800/50">
          <a
            href="/admin"
            className="hero-title text-sm font-black text-stroke hover:text-stroke-white transition-all duration-300"
          >
            🔧 Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}
