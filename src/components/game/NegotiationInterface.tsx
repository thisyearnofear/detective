"use client";

import { useState, useEffect } from "react";
import type { NegotiationMatch, ResourcePool, NegotiationAction } from "@/lib/types";
import { validateProposal } from "@/lib/gameMode";

type Props = {
  match: NegotiationMatch;
  onAction: (action: NegotiationAction, message: string, proposal?: { myShare: ResourcePool; theirShare: ResourcePool }) => Promise<void>;
  isProcessing?: boolean;
};

/**
 * NegotiationInterface - UI for negotiation game mode
 * 
 * MODULAR: Self-contained negotiation UI
 * CLEAN: Clear separation from conversation UI
 */
export default function NegotiationInterface({ match, onAction, isProcessing = false }: Props) {
  const [message, setMessage] = useState("");
  const [myShare, setMyShare] = useState<ResourcePool>({
    books: Math.floor(match.resourcePool.books / 2),
    hats: Math.floor(match.resourcePool.hats / 2),
    balls: Math.floor(match.resourcePool.balls / 2),
  });
  
  // Calculate time remaining
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, match.endTime - Date.now());
      setTimeRemaining(remaining);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [match.endTime]);
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };
  
  // Calculate their share automatically
  const theirShare: ResourcePool = {
    books: match.resourcePool.books - myShare.books,
    hats: match.resourcePool.hats - myShare.hats,
    balls: match.resourcePool.balls - myShare.balls,
  };

  const validation = validateProposal(myShare, theirShare, match.resourcePool);
  const canPropose = validation.valid && message.trim().length > 0;

  const handlePropose = async () => {
    if (!canPropose || isProcessing) return;
    await onAction('propose', message, { myShare, theirShare });
    setMessage("");
  };

  const handleAccept = async () => {
    if (!match.currentProposal || isProcessing) return;
    await onAction('accept', message || "I accept this deal");
    setMessage("");
  };

  const handleReject = async () => {
    if (isProcessing) return;
    await onAction('reject', message || "Let's keep negotiating");
    setMessage("");
  };

  // Calculate potential score
  const calculateScore = (share: ResourcePool) => {
    const score = (
      share.books * match.playerValuation.books +
      share.hats * match.playerValuation.hats +
      share.balls * match.playerValuation.balls
    );
    const maxScore = (
      match.resourcePool.books * match.playerValuation.books +
      match.resourcePool.hats * match.playerValuation.hats +
      match.resourcePool.balls * match.playerValuation.balls
    );
    return ((score / maxScore) * 100).toFixed(0);
  };

  const myScore = calculateScore(myShare);
  const currentProposalScore = match.currentProposal 
    ? calculateScore(
        match.currentProposal.proposer === match.player.fid 
          ? match.currentProposal.myShare 
          : match.currentProposal.theirShare
      )
    : null;

  return (
    <div className="w-full space-y-4">
      {/* Timer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          Round {match.rounds.length + 1} of 5
        </div>
        <div className={`text-sm font-bold ${timeRemaining < 10000 ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
          ⏱️ {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Outcome Display (if match finished) */}
      {match.outcome && (
        <div className={`border-2 rounded-xl p-4 text-center ${
          match.outcome.dealReached 
            ? 'bg-green-900/20 border-green-500/50' 
            : 'bg-red-900/20 border-red-500/50'
        }`}>
          <div className="text-3xl mb-2">
            {match.outcome.dealReached ? '🤝' : '💔'}
          </div>
          <div className="text-lg font-bold text-white mb-1">
            {match.outcome.dealReached ? 'Deal Reached!' : 'No Deal'}
          </div>
          <div className="text-sm text-gray-300">
            Your score: {(match.outcome.playerScore * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {match.outcome.dealReached 
              ? `Agreement reached in ${match.outcome.rounds} rounds`
              : 'Time ran out - both players lose 50%'
            }
          </div>
        </div>
      )}

      {/* Negotiation History */}
      {match.rounds.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-40 overflow-y-auto">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">
            History
          </div>
          <div className="space-y-2">
            {match.rounds.slice(-5).map((round, idx) => {
              const isPlayer = round.actor === match.player.fid;
              return (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded ${
                    isPlayer ? 'bg-purple-900/20 border-l-2 border-purple-500' : 'bg-blue-900/20 border-l-2 border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">
                      {isPlayer ? 'You' : match.opponent.username}
                    </span>
                    <span className="text-gray-500">
                      {round.action === 'propose' ? '📝' : round.action === 'accept' ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className="text-gray-300">{round.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resource Pool Display */}
      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-500/30 rounded-xl p-4">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">
          Resources to Split
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['books', 'hats', 'balls'] as const).map((resource) => (
            <div key={resource} className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">
                {resource === 'books' ? '📚' : resource === 'hats' ? '🎩' : '⚽'}
              </div>
              <div className="text-lg font-bold text-white">
                {match.resourcePool[resource]}
              </div>
              <div className="text-xs text-gray-400 capitalize">{resource}</div>
              <div className="text-xs text-purple-400 mt-1">
                Worth {match.playerValuation[resource]} pts
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Proposal (if any) */}
      {match.currentProposal && (
        <div className="bg-yellow-900/20 border-2 border-yellow-500/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-yellow-400 uppercase tracking-widest">
              Current Proposal
            </div>
            <div className="text-xs text-gray-400">
              Round {match.rounds.length}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm text-white">
              "{match.currentProposal.message}"
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">You get:</div>
                <div className="space-y-1 text-xs">
                  {(['books', 'hats', 'balls'] as const).map((r) => {
                    const amount = match.currentProposal!.proposer === match.player.fid
                      ? match.currentProposal!.myShare[r]
                      : match.currentProposal!.theirShare[r];
                    return (
                      <div key={r} className="flex justify-between">
                        <span className="capitalize">{r}:</span>
                        <span className="font-bold text-white">{amount}</span>
                      </div>
                    );
                  })}
                </div>
                {currentProposalScore && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs text-purple-400">
                    Score: {currentProposalScore}%
                  </div>
                )}
              </div>
              
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">They get:</div>
                <div className="space-y-1 text-xs">
                  {(['books', 'hats', 'balls'] as const).map((r) => {
                    const amount = match.currentProposal!.proposer === match.player.fid
                      ? match.currentProposal!.theirShare[r]
                      : match.currentProposal!.myShare[r];
                    return (
                      <div key={r} className="flex justify-between">
                        <span className="capitalize">{r}:</span>
                        <span className="font-bold text-white">{amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Builder */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">
          Your Proposal
        </div>
        
        <div className="space-y-3">
          {/* Sliders for each resource */}
          {(['books', 'hats', 'balls'] as const).map((resource) => (
            <div key={resource} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="capitalize text-gray-300">{resource}</span>
                  <span className="text-xs text-purple-400">
                    (worth {match.playerValuation[resource]} pts each)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-bold">{myShare[resource]}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">{theirShare[resource]}</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={match.resourcePool[resource]}
                value={myShare[resource]}
                onChange={(e) => setMyShare({ ...myShare, [resource]: parseInt(e.target.value) })}
                disabled={isProcessing}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0 pts</span>
                <span>{match.resourcePool[resource] * match.playerValuation[resource]} pts</span>
              </div>
            </div>
          ))}
          
          {/* Score Preview with Fairness Indicator */}
          <div className="space-y-2">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Your potential score:</span>
                <span className="text-lg font-bold text-purple-400">{myScore}%</span>
              </div>
            </div>
            
            {/* Fairness Meter */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Proposal Balance:</span>
                <span className={`text-xs font-semibold ${
                  parseInt(myScore) > 70 ? 'text-green-400' :
                  parseInt(myScore) > 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {parseInt(myScore) > 70 ? '🟢 Favorable' :
                   parseInt(myScore) > 40 ? '🟡 Fair' :
                   '🔴 Unfavorable'}
                </span>
              </div>
              <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    parseInt(myScore) > 70 ? 'bg-green-500' :
                    parseInt(myScore) > 40 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${myScore}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Tip: Aim for 50-70% for balanced deals
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Input */}
      {!match.outcome && (
        <>
          <div className="space-y-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message..."
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canPropose) {
                  handlePropose();
                }
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePropose}
              disabled={!canPropose || isProcessing}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
            >
              Propose
            </button>
            
            <button
              onClick={handleAccept}
              disabled={!match.currentProposal || isProcessing}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
            >
              Accept
            </button>
            
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
            >
              Reject
            </button>
          </div>

          {/* Validation Error */}
          {!validation.valid && (
            <div className="text-xs text-red-400 text-center">
              {validation.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
