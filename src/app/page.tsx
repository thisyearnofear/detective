"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import AuthComponent from "@/components/AuthComponent";
import SpinningDetective from "@/components/SpinningDetective";
import AnimatedGridBackdrop from "@/components/AnimatedGridBackdrop";
import StarfieldBackground from "@/components/StarfieldBackground";
import GameStateView from "@/components/game/GameStateView";
import CaseStatusCard from "@/components/game/CaseStatusCard";
import Leaderboard from "@/components/Leaderboard";
import CollapsibleSection from "@/components/CollapsibleSection";
import { fetcher } from "@/lib/fetcher";

// Main component for the application's home page
export default function Home() {
  const [sdkUser, setSdkUser] = useState<any>(null);
  const [isSdkLoading, setIsSdkLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [lastGameState, setLastGameState] = useState<string>('');
  const [gameResults, setGameResults] = useState<{
    accuracy: number;
    roundResults: Array<{ roundNumber: number; correct: boolean; opponentUsername: string; opponentType: "REAL" | "BOT" }>;
    playerRank: number;
    totalPlayers: number;
  } | null>(null);

  useEffect(() => {
    // Auto-advance intro after 2 seconds
    const timer = setTimeout(() => {
      setIntroComplete(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Use SWR for polling the game state
  // PERFORMANT: Adaptive polling - faster when waiting for cycle transition
  const { data: gameState, error: gameStateError } = useSWR(
    sdkUser ? `/api/game/status?fid=${sdkUser.fid}` : "/api/game/status",
    fetcher,
    { 
      refreshInterval: 2000,
      keepPreviousData: true,
      revalidateOnFocus: true, // Mobile: Refresh when user returns
    },
  );

  // Auto-show stats when game finishes or when transitioning from FINISHED to REGISTRATION
  useEffect(() => {
    // Show stats immediately if we have game results (game just finished)
    if (gameResults) {
      setShowLeaderboard(true);
    }
    // Also show stats if transitioning from FINISHED to REGISTRATION
    if (lastGameState === 'FINISHED' && gameState?.state === 'REGISTRATION' && gameResults) {
      setShowLeaderboard(true);
    }
    if (gameState?.state) {
      setLastGameState(gameState.state);
    }
  }, [gameState?.state, lastGameState, gameResults]);

  // Reset leaderboard view when starting a new game
  useEffect(() => {
    if (gameState?.state === 'LIVE') {
      setShowLeaderboard(false);
    }
  }, [gameState?.state]);

  const handleLogout = () => {
    setSdkUser(null);
    localStorage.removeItem('auth-token');
    localStorage.removeItem('cached-user');
  };

  useEffect(() => {
    // Try to restore auth from localStorage on mount
    const restoreAuth = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        const cachedUser = localStorage.getItem('cached-user');
        
        if (token && cachedUser) {
          // Verify token is still valid on server
          const response = await fetch('/api/auth/quick-auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ token }),
          });

          if (response.ok) {
            const userData = await response.json();
            setSdkUser({
              fid: userData.fid,
              username: userData.username || '',
              displayName: userData.displayName || '',
              pfpUrl: userData.pfpUrl || '',
            });
          } else {
            // Token invalid - clear it
            localStorage.removeItem('auth-token');
            localStorage.removeItem('cached-user');
          }
        }
      } catch (error) {
        console.error('Failed to restore auth:', error);
        localStorage.removeItem('auth-token');
        localStorage.removeItem('cached-user');
      } finally {
        setIsSdkLoading(false);
      }
    };

    restoreAuth();
  }, []);

  const handleWebAuth = (userProfile: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  }) => {
    setSdkUser({
      fid: userProfile.fid,
      username: userProfile.username || '',
      displayName: userProfile.displayName || '',
      pfpUrl: userProfile.pfpUrl || '',
    });
  };



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
        onGameFinish={(results) => {
          console.log('[page.tsx] onGameFinish callback received:', results);
          setGameResults(results);
        }}
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
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 z-0">
        {/* Layer 1: Starfield (deepest) */}
        <StarfieldBackground />

        {/* Layer 2: Grid Backdrop */}
        <AnimatedGridBackdrop images={gridImages} />

        {/* Layer 3: Content Container - Perfect centering */}
        <div className="relative z-20 w-full max-w-2xl flex flex-col items-center justify-center min-h-screen">

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
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Chat with opponents. Figure out who's real.
                  </p>
                </div>
              </div>

              {/* Game Status Card - Shows live game state */}
              {gameState ? (
                <CaseStatusCard
                  gameState={{
                    state: gameState.state,
                    playerCount: gameState.playerCount,
                    registrationEnds: gameState.registrationEnds,
                    gameEnds: gameState.gameEnds,
                  }}
                />
              ) : (
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
                  <div className="h-20 bg-white/10 rounded" />
                </div>
              )}

              {/* Authentication - Unified MiniApp + Web */}
              <div className="w-full">
                <AuthComponent 
                  onAuthSuccess={(user, _token) => handleWebAuth(user)} 
                />
              </div>

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
                  <div className="flex gap-2">
                     <button
                       onClick={() => setShowLeaderboard(!showLeaderboard)}
                       className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20"
                     >
                       {showLeaderboard ? '← Back to Investigation' : '🏆 Stats'}
                     </button>
                     <button
                       onClick={handleLogout}
                       className="text-xs text-gray-400 hover:text-white transition-colors"
                     >
                       Switch
                     </button>
                   </div>
                </div>
              </div>

              {/* Live Game Status */}
              {gameState && (
                <CaseStatusCard
                  gameState={{
                    state: gameState.state,
                    playerCount: gameState.playerCount,
                    registrationEnds: gameState.registrationEnds,
                    gameEnds: gameState.gameEnds,
                  }}
                />
              )}

              {/* Toggle between Game View and Leaderboard */}
              {showLeaderboard ? (
                <div className="w-full space-y-4">
                  {/* Contextual Header */}
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-4">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">
                      {lastGameState === 'FINISHED' ? '🎉 Latest Game Results' : '📊 Your Career Stats'}
                    </div>
                    {lastGameState === 'FINISHED' && (
                      <p className="text-sm text-gray-300">
                        Great job! Here's how you performed in your last game.
                      </p>
                    )}
                  </div>

                  {/* Leaderboard */}
                  <Leaderboard
                    fid={sdkUser.fid}
                    mode={lastGameState === 'FINISHED' && gameResults ? 'career' : 'career'}
                    isGameEnd={lastGameState === 'FINISHED' && gameResults ? true : false}
                    accuracy={gameResults?.accuracy}
                    roundResults={gameResults?.roundResults}
                    playerRank={gameResults?.playerRank}
                    totalPlayers={gameResults?.totalPlayers}
                  />
                </div>
              ) : (
                <>
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
