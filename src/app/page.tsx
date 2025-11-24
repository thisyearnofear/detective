'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeMiniApp = async () => {
      try {
        // Get context from Farcaster SDK
        const context = await sdk.context.user.getCurrent();
        
        // Extract user from context
        if (context && 'user' in context) {
          setUser((context as any).user);
        } else {
          setUser(context);
        }

        // Signal to Farcaster that the app is ready
        await sdk.actions.ready();
      } catch (err) {
        console.error('Error initializing mini app:', err);
        setError('Failed to initialize. Make sure you are on Farcaster.');
      } finally {
        setLoading(false);
      }
    };

    initializeMiniApp();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">🔍 Detective</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-400">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">🔍 Detective</h1>
          <p className="text-xl text-gray-300">
            Can you tell if you're chatting with a real person or an AI bot?
          </p>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8">
            <p className="text-gray-400 mb-2">Logged in as:</p>
            <p className="text-lg font-semibold">@{user.username}</p>
            <p className="text-sm text-gray-500">FID: {user.fid}</p>
          </div>
        )}

        {/* Game Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Game Status</h2>
          <p className="text-gray-400 mb-4">
            The game is in early development. Check back soon for the first game cycle!
          </p>
          <div className="space-y-2 text-sm">
            <p className="text-gray-500">Phase: Planning</p>
            <p className="text-gray-500">Players: 0/50</p>
            <p className="text-gray-500">Next cycle: TBD</p>
          </div>
        </div>

        {/* How to Play */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">How to Play</h2>
          <ol className="space-y-3 text-gray-300 text-sm">
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">1.</span>
              <span>Register for a game cycle (players must have Neynar score &gt; 0.8)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">2.</span>
              <span>Chat with an opponent for 4 minutes. They might be a real user or an AI bot trained on their Farcaster posts.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">3.</span>
              <span>Vote: Do you think you were talking to a real person or a bot?</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-400">4.</span>
              <span>Complete 5 matches during the game cycle and climb the leaderboard.</span>
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
