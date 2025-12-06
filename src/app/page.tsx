"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { sdk } from "@farcaster/miniapp-sdk";
import SpinningDetective from "@/components/SpinningDetective";
import AnimatedGridBackdrop from "@/components/AnimatedGridBackdrop";
import StarfieldBackground from "@/components/StarfieldBackground";
import GameStateView from "@/components/game/GameStateView";
import GameStatusCard from "@/components/game/GameStatusCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import { isFarcasterMiniApp, authenticateWithFarcaster } from "@/lib/farcasterAuth";
import { fetcher } from "@/lib/fetcher";

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

  // Use SWR for polling the game state
  const { data: gameState, error: gameStateError } = useSWR(
    sdkUser ? `/api/game/status?fid=${sdkUser.fid}` : "/api/game/status",
    fetcher,
    { 
      refreshInterval: 2000, // Poll every 2s
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
        // Check if we're in a Farcaster miniapp context
        if (isFarcasterMiniApp()) {
          console.log('[Home] Detected Farcaster miniapp context');
          
          // Use our enhanced Farcaster authentication
          const farcasterUser = await authenticateWithFarcaster();
          setSdkUser(farcasterUser);
          setAuthMode("sdk");
          // Tell Farcaster SDK to hide splash screen
          await sdk.actions.ready();
          
        } else {
          // Fallback to original SDK method for compatibility
          const context = await sdk.context;
          if (context) {
            setSdkUser((context as any).user);
            setAuthMode("sdk");
            await sdk.actions.ready();
          } else {
            // SDK context unavailable, fallback to web mode
            setAuthMode("web");
          }
        }
      } catch (err) {
        console.log("Farcaster SDK not available, using web mode:", err);
        // Gracefully fallback to web authentication
        setAuthMode("web");
      } finally {
        setIsSdkLoading(false);
      }
    };
    initAuth();
  }, []);

  // Unified game state view - consolidates all game phase logic
  const renderGameState = () => {
    if (!gameState || !sdkUser) return null;

    return (
      <GameStateView
        fid={sdkUser.fid}
        username={sdkUser.username}
        displayName={sdkUser.displayName}
        pfpUrl={sdkUser.pfpUrl}
        gameState={gameState}
        onLogout={handleLogout}
      />
    );
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
        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center justify-center min-h-screen">

        {/* Hero Section - The DETECTIVE Title - Centered with entrance animation */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${introComplete ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <h1 className={`hero-title text-6xl sm:text-7xl md:text-[10rem] font-black text-white tracking-tighter leading-none select-none mix-blend-overlay opacity-90 text-center transition-all duration-700 ${introComplete ? '' : 'animate-in'}`}
              style={{ animationDelay: '100ms' }}>
            DETECTIVE
          </h1>
        </div>

        {/* Main Content - Fades in after hero disappears */}
        <div className={`w-full flex flex-col items-center transition-all duration-1000 ${introComplete ? 'opacity-100' : 'opacity-0'}`}>
          {!sdkUser ? (
            // Not authenticated - Show Farcaster gate
            <div className="w-full max-w-md flex flex-col items-center space-y-8">
              {/* Clean Header */}
              <div className="w-full flex flex-col items-center space-y-5 text-center">
                <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-3xl backdrop-blur-md shadow-2xl">
                  <span className="text-4xl">🔍</span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">Can you spot the AI?</h2>
                  <p className="text-base text-gray-300 font-medium">Chat with opponents. Vote: Real or Bot?</p>
                </div>
              </div>

              {/* Farcaster Required Gate */}
              {authMode === "web" ? (
                <div className="w-full bg-purple-900/20 border-2 border-purple-500/30 rounded-2xl p-8 text-center space-y-4">
                  <div className="text-5xl mb-2">🎭</div>
                  <h3 className="text-xl font-bold text-white">Farcaster Required</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Detective is a Farcaster-exclusive game. Get your account to start playing!
                  </p>
                  <a
                    href="https://farcaster.xyz/~/code/YKR2G8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-2 mt-4"
                  >
                    <span>Get Farcaster</span>
                    <span className="text-xs">→</span>
                  </a>
                  <p className="text-xs text-gray-400 mt-4">
                    Already have Farcaster? Open this game from the Farcaster app.
                  </p>
                </div>
              ) : (
                // Loading Farcaster auth
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <SpinningDetective size="md" className="mb-4" />
                  <p className="text-sm text-gray-300">Connecting to Farcaster...</p>
                </div>
              )}

              {/* Collapsible Sections */}
              <div className="w-full text-center space-y-0 pt-8">
                {/* How to Play */}
                <CollapsibleSection title="How To Play">
                  <div className="space-y-4">
                    {[
                      { icon: "1️⃣", text: "Register when a game opens" },
                      { icon: "2️⃣", text: "Chat with 2 opponents simultaneously" },
                      { icon: "3️⃣", text: "Vote: Real human or AI bot?" }
                    ].map((rule, i) => (
                      <div key={i} className="flex items-center gap-3 text-left">
                        <span className="text-xl">{rule.icon}</span>
                        <p className="text-sm font-semibold text-white/90 leading-relaxed">
                          {rule.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Features */}
                <CollapsibleSection title="Features">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/8 border-2 border-white/15 rounded-xl p-4 hover:bg-white/12 hover:border-white/25 transition-all duration-300 text-left group">
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                      <div className="font-bold text-white text-sm mb-1.5">4 Leaderboard Modes</div>
                      <div className="text-xs text-gray-300 leading-relaxed">Current • Career • Insights • Multi-Chain</div>
                    </div>

                    <div className="bg-white/8 border-2 border-white/15 rounded-xl p-4 hover:bg-white/12 hover:border-white/25 transition-all duration-300 text-left group">
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🌐</div>
                      <div className="font-bold text-white text-sm mb-1.5">Multi-Chain Support</div>
                      <div className="text-xs text-gray-300 leading-relaxed">Arbitrum • Monad • Cross-Chain</div>
                    </div>

                    <div className="bg-white/8 border-2 border-white/15 rounded-xl p-4 hover:bg-white/12 hover:border-white/25 transition-all duration-300 text-left group">
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚡</div>
                      <div className="font-bold text-white text-sm mb-1.5">Real-Time Analytics</div>
                      <div className="text-xs text-gray-300 leading-relaxed">Competitive insights • Trend analysis</div>
                    </div>

                    <div className="bg-white/8 border-2 border-white/15 rounded-xl p-4 hover:bg-white/12 hover:border-white/25 transition-all duration-300 text-left group">
                      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🤖</div>
                      <div className="font-bold text-white text-sm mb-1.5">AI Opponents</div>
                      <div className="text-xs text-gray-300 leading-relaxed">Personalized • Adaptive • Fair</div>
                    </div>
                  </div>
                </CollapsibleSection>
              </div>

              {/* Leaderboard Link */}
              <div className="w-full text-center pt-4">
                <a
                  href="/leaderboard"
                  className="chip grow inline-flex items-center gap-2"
                >
                  <span className="text-xl">🏆</span>
                  <span className="font-bold">View Leaderboard</span>
                  <span className="text-xs opacity-60">→</span>
                </a>
              </div>
            </div>
          ) : (
            // Authenticated - Single-page lobby experience
            <div className="w-full max-w-md flex flex-col items-center space-y-6">
              {/* User Profile Header */}
              <div className="w-full bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  {sdkUser.pfpUrl && (
                    <img
                      src={sdkUser.pfpUrl}
                      alt={sdkUser.username}
                      className="w-16 h-16 rounded-full border-2 border-white/20"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-gray-300 mb-1">Playing as</p>
                    <p className="text-xl font-bold text-white">@{sdkUser.username}</p>
                    {sdkUser.displayName && (
                      <p className="text-sm text-gray-300">{sdkUser.displayName}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Switch
                  </button>
                </div>
              </div>

              {/* Game State Content */}
              {gameState?.state === "FINISHED" ? (
                renderGameState()
              ) : (
                <>
                  {/* Live Game Status */}
                  {gameState && (
                    <GameStatusCard
                      gameState={{
                        state: gameState.state,
                        playerCount: gameState.playerCount,
                        registrationEnds: gameState.registrationEnds,
                        gameEnds: gameState.gameEnds,
                      }}
                    />
                  )}

                  {/* Game Phase View */}
                  {renderGameState()}
                </>
              )}
            </div>
          )}
        </div>
        </div>
      </main>
  );
}
