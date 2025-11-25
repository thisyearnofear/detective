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
import StarfieldBackground from "@/components/StarfieldBackground";
import { GameCycleState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// This component handles the logic when the game is LIVE
// Component that displays when the game is live
const LiveGameView = ({ fid, cycleId }: { fid: number; cycleId?: string }) => {
  return <MultiChatContainer key={cycleId || 'live-game'} fid={fid} />;
};

// Main component for the application's home page
export default function Home() {
  const [sdkUser, setSdkUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"sdk" | "web" | null>(null);
  const [isSdkLoading, setIsSdkLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    // Auto-advance intro after 2 seconds
    const timer = setTimeout(() => {
      setIntroComplete(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Use SWR for polling the game state every 3 seconds
  // keepPreviousData prevents component unmounting during refetch
  const { data: gameState, error: gameStateError } = useSWR(
    sdkUser ? `/api/game/status?fid=${sdkUser.fid}` : "/api/game/status",
    fetcher,
    { 
      refreshInterval: 3000,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
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
        return <LiveGameView fid={sdkUser.fid} cycleId={gameState.cycleId} />;
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
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Layer 1: Starfield (deepest) */}
      <StarfieldBackground />

      {/* Layer 2: Grid Backdrop */}
      <AnimatedGridBackdrop images={gridImages} />

      {/* Layer 3: Content Container - Perfect centering */}
      <div className={`relative z-10 w-full max-w-2xl flex flex-col items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${introComplete ? 'translate-y-0' : 'translate-y-[10vh]'}`}>

        {/* Hero Section - The DETECTIVE Title - Perfectly centered */}
        <div className={`w-full flex items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] mb-16 ${introComplete ? 'opacity-0 scale-50 pointer-events-none h-0 mb-0' : 'opacity-100 scale-100 h-auto'}`}>
          <h1 className="hero-title text-7xl sm:text-[10rem] md:text-[12rem] font-black text-white tracking-tighter leading-none select-none mix-blend-overlay opacity-90 text-center">
            DETECTIVE
          </h1>
        </div>

        {/* Main Content - Clean editorial design - Perfectly centered */}
        <div className={`w-full flex flex-col items-center transition-all duration-1000 delay-500 ${introComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
          {!sdkUser ? (
            // Not authenticated - Perfect centering
            <div className="w-full max-w-md flex flex-col items-center space-y-12">
              {/* Clean Header - Perfectly centered */}
              <div className="w-full flex flex-col items-center space-y-6 text-center">
                <div className="flex items-center justify-center w-16 h-16 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <span className="text-2xl">🔍</span>
                </div>
              </div>

              {/* Auth Input - Contains all the necessary content */}
              <div className="w-full">
                <AuthInput onAuthSuccess={handleWebAuth} />
              </div>

              {/* How to Play - Editorial List Style */}
              <div className="text-center space-y-8 pt-12">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-[0.3em]">Mission Briefing</h3>

                <div className="space-y-6">
                  {[
                    "REGISTER FOR A GAME WHEN REGISTRATION IS OPEN",
                    "MANAGE 2 SIMULTANEOUS CHATS, EACH LASTING 1 MINUTE",
                    "VOTE DURING THE CHAT: IS EACH OPPONENT A REAL PERSON OR A BOT?",
                    "COMPLETE MULTIPLE MATCHES IN ROUNDS",
                    "CLIMB THE LEADERBOARD WITH ACCURACY AND SPEED"
                  ].map((rule, i) => (
                    <p key={i} className="text-base font-medium text-white/70 hover:text-white/90 transition-colors cursor-default leading-relaxed">
                      {rule}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Authenticated content remains the same...
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
          <div className="mt-24 pt-8 text-center border-t border-white/5">
            <a
              href="/admin"
              className="text-xs font-bold text-gray-600 hover:text-white transition-colors uppercase tracking-widest"
            >
              Admin Panel
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
