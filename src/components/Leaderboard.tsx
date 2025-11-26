'use client';

import useSWR from 'swr';
import { LeaderboardEntry } from '@/lib/types';
import Image from 'next/image';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LeaderboardMode = 'current' | 'career' | 'insights' | 'multi-chain';
type Chain = 'arbitrum' | 'monad';
type LeaderboardType = 'current-game' | 'season' | 'all-time' | 'nft-holders' | 'token-holders';
type TimeFrame = '24h' | '7d' | '30d' | 'all';

interface CareerStats {
  totalGames: number;
  overallAccuracy: number;
  totalVotes: number;
  totalCorrect: number;
  bestAccuracy: number;
  worstAccuracy: number;
  avgSpeed: number;
  leaderboardHistory: Array<{
    gameId: string;
    timestamp: number;
    rank: number;
    totalPlayers: number;
    accuracy: number;
  }>;
}

const getRankColor = (rank: number) => {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-yellow-600';
  return 'text-gray-500';
};

const getChainBadge = (chain: Chain) => {
  const configs = {
    arbitrum: {
      name: 'Arbitrum',
      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: '🔷',
      description: 'Early Access NFT'
    },
    monad: {
      name: 'Monad',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: '🟣',
      description: 'Token & Rewards'
    }
  };
  return configs[chain];
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up': return '📈';
    case 'down': return '📉';
    default: return '➡️';
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getStrengthEmoji = (area: string) => {
  switch (area) {
    case 'speed': return '⚡';
    case 'accuracy': return '🎯';
    case 'consistency': return '🔄';
    default: return '💪';
  }
};

const getLeaderboardTitle = (type: LeaderboardType) => {
  const titles = {
    'current-game': 'Current Game',
    'season': 'Season Rankings',
    'all-time': 'All-Time Legends',
    'nft-holders': 'NFT Holder Ranks',
    'token-holders': 'Token Holder Ranks'
  };
  return titles[type];
};

interface GameResultsProps {
  isGameEnd?: boolean;
  accuracy?: number;
  roundResults?: Array<{ roundNumber: number; correct: boolean; opponentUsername: string; opponentType: "REAL" | "BOT" }>;
  playerRank?: number;
  totalPlayers?: number;
  onPlayAgain?: () => void;
}

interface PlayerInsights {
  personalRank: number;
  totalPlayers: number;
  percentile: number;
  recentTrend: 'up' | 'down' | 'stable';
  strengthArea: 'speed' | 'accuracy' | 'consistency';
  weaknessArea: 'speed' | 'accuracy' | 'consistency';
  nextMilestone: {
    type: 'rank' | 'achievement' | 'streak';
    target: number | string;
    progress: number;
  };
  competitiveAnalysis: {
    beatenRecently: string[];
    lostToRecently: string[];
    rivalUsername?: string;
  };
}

interface ChainStats {
  chain: Chain;
  totalPlayers: number;
  totalGames: number;
  nftHolders: number;
  tokenHolders?: number;
  topAccuracy: number;
  avgAccuracy: number;
}

interface MultiChainLeaderboardData {
  arbitrum: LeaderboardEntry[];
  monad: LeaderboardEntry[];
  chainStats: {
    arbitrum: ChainStats;
    monad: ChainStats;
  };
  crossChainRankings: LeaderboardEntry[];
}

export default function Leaderboard({ 
  fid, 
  mode: initialMode = 'current',
  isGameEnd = false,
  accuracy = 0,
  roundResults = [],
  playerRank = 1,
  totalPlayers = 1,
  onPlayAgain,
  chain = 'arbitrum',
}: { fid?: number; mode?: LeaderboardMode; chain?: Chain } & GameResultsProps = {}) {
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);
  const [selectedChain, setSelectedChain] = useState<Chain>(chain);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('current-game');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');
  
  const { data: leaderboard, error } = useSWR<LeaderboardEntry[]>(
    (mode as string) === 'current' ? '/api/leaderboard/current' : null,
    fetcher, 
    {
      refreshInterval: 10000,
    }
  );

  const { data: careerStats } = useSWR<CareerStats>(
    (mode as string) === 'career' && fid ? `/api/stats/career?fid=${fid}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const { data: insights } = useSWR<PlayerInsights>(
    (mode as string) === 'insights' && fid ? `/api/leaderboard/insights?fid=${fid}&chain=${selectedChain}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: multiChainData, isLoading: isMultiChainLoading } = useSWR<MultiChainLeaderboardData>(
    (mode as string) === 'multi-chain' ? `/api/leaderboard/multi-chain?chain=${selectedChain}&type=${leaderboardType}&timeframe=${timeFrame}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  // Game end mode - show results with current leaderboard
  if (isGameEnd) {
    const percentile = totalPlayers > 0 ? Math.round(((totalPlayers - playerRank) / totalPlayers) * 100) : 0;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
        {/* Results Summary */}
        <div className="max-w-2xl w-full mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-white mb-2">🎮 Mission Complete</h1>
            <p className="text-xl font-bold text-slate-300">GAME OVER</p>
            <p className="text-sm text-gray-400 mt-2">Here's how you performed</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-purple-400 mb-2">{accuracy.toFixed(0)}%</div>
              <div className="text-xs text-gray-400 uppercase">Accuracy</div>
              <div className="text-sm text-gray-500 mt-1">
                {roundResults.filter(r => r.correct).length}/{roundResults.length} correct
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-yellow-400 mb-2">#{playerRank}</div>
              <div className="text-xs text-gray-400 uppercase">Rank</div>
              <div className="text-sm text-gray-500 mt-1">of {totalPlayers}</div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700">
              <div className="text-4xl font-bold text-blue-400 mb-2">{percentile}%</div>
              <div className="text-xs text-gray-400 uppercase">Percentile</div>
              <div className="text-sm text-gray-500 mt-1">top players</div>
            </div>
          </div>

          {/* Motivation */}
          <div className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700 mb-8">
            <p className="text-gray-300 text-sm">
              {accuracy >= 80 ? "🔥 Incredible detective work! You're a natural." :
               accuracy >= 60 ? "💪 Nice work! Keep playing to improve." :
               accuracy >= 40 ? "📈 Not bad! You'll get better with practice." :
               "🎯 Keep playing - You'll improve"}
            </p>
          </div>

          {/* Round Breakdown */}
          {roundResults.length > 0 && (
            <div className="mb-8">
              <h3 className="font-bold text-white mb-4 text-center">Round Breakdown</h3>
              <div className="space-y-2">
                {roundResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700/50">
                    <div className="text-sm text-gray-400">
                      Round {result.roundNumber} <span className="text-gray-600">vs @{result.opponentUsername}</span> <span className={result.opponentType === 'BOT' ? 'text-red-400' : 'text-green-400'}>{result.opponentType}</span>
                    </div>
                    <div className="text-lg">{result.correct ? '✅' : '❌'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={onPlayAgain}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
            >
              Register for Next Game
            </button>
            <a
              href="/"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              Back to Home
            </a>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">Stats saved automatically</p>
        </div>
      </div>
    );
  }

  // Insights mode
  if ((mode as string) === 'insights') {
    if (!insights) {
      return (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <h3 className="font-bold text-white mb-6 text-center">
          📊 Your Detective Insights
        </h3>

        <div className="space-y-6">
          {/* Current Standing */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Current Ranking</span>
              <span className={`text-sm ${getTrendColor(insights.recentTrend)}`}>
                {getTrendIcon(insights.recentTrend)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">#{insights.personalRank}</span>
              <span className="text-gray-400 text-sm">of {insights.totalPlayers.toLocaleString()}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Top {insights.percentile}% - {insights.recentTrend === 'up' ? 'Rising' : insights.recentTrend === 'down' ? 'Falling' : 'Stable'}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="text-green-400 text-xs uppercase tracking-wide mb-1">Strength</div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStrengthEmoji(insights.strengthArea)}</span>
                <span className="font-medium text-white capitalize">{insights.strengthArea}</span>
              </div>
            </div>
            
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <div className="text-orange-400 text-xs uppercase tracking-wide mb-1">Focus Area</div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStrengthEmoji(insights.weaknessArea)}</span>
                <span className="font-medium text-white capitalize">{insights.weaknessArea}</span>
              </div>
            </div>
          </div>

          {/* Next Milestone */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 text-sm font-medium">Next Milestone</span>
              <span className="text-blue-300 text-sm">{insights.nextMilestone.progress}%</span>
            </div>
            
            <div className="mb-3">
              {insights.nextMilestone.type === 'rank' && (
                <span className="text-white font-medium">Reach rank #{insights.nextMilestone.target}</span>
              )}
              {insights.nextMilestone.type === 'achievement' && (
                <span className="text-white font-medium">Unlock: {insights.nextMilestone.target}</span>
              )}
              {insights.nextMilestone.type === 'streak' && (
                <span className="text-white font-medium">Achieve {insights.nextMilestone.target} game win streak</span>
              )}
            </div>
            
            <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${insights.nextMilestone.progress}%` }}
              />
            </div>
          </div>

          {/* Competitive Analysis */}
          {(insights.competitiveAnalysis.beatenRecently.length > 0 || insights.competitiveAnalysis.lostToRecently.length > 0) && (
            <div className="bg-slate-800/30 rounded-lg p-4">
              <h4 className="font-medium text-white mb-3 text-sm">Recent Matchups</h4>
              
              {insights.competitiveAnalysis.beatenRecently.length > 0 && (
                <div className="mb-3">
                  <div className="text-green-400 text-xs mb-1">Recently Outperformed</div>
                  <div className="flex flex-wrap gap-1">
                    {insights.competitiveAnalysis.beatenRecently.slice(0, 3).map((username, idx) => (
                      <span key={idx} className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                        @{username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {insights.competitiveAnalysis.lostToRecently.length > 0 && (
                <div className="mb-3">
                  <div className="text-red-400 text-xs mb-1">Learning Opportunities</div>
                  <div className="flex flex-wrap gap-1">
                    {insights.competitiveAnalysis.lostToRecently.slice(0, 3).map((username, idx) => (
                      <span key={idx} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">
                        @{username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {insights.competitiveAnalysis.rivalUsername && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded p-2 mt-2">
                  <div className="text-purple-400 text-xs mb-1">Rival Detected</div>
                  <div className="text-white text-sm font-medium">
                    🎯 @{insights.competitiveAnalysis.rivalUsername}
                  </div>
                  <div className="text-xs text-gray-400">Similar skill level - challenge them!</div>
                </div>
              )}
            </div>
          )}

          {/* Pro Tips */}
          <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2 text-sm flex items-center gap-2">
              💡 Pro Tips
            </h4>
            <div className="text-xs text-gray-300 space-y-1">
              {insights.strengthArea === 'speed' && insights.weaknessArea === 'accuracy' && (
                <p>You're fast! Try slowing down slightly to improve accuracy for better overall scores.</p>
              )}
              {insights.strengthArea === 'accuracy' && insights.weaknessArea === 'speed' && (
                <p>Your accuracy is excellent! Try making quicker decisions to boost your speed score.</p>
              )}
              {insights.strengthArea === 'consistency' && (
                <p>Your consistent performance is your edge - keep playing regularly to maintain your ranking!</p>
              )}
              <p>💎 Remember: NFT holders get ranking multipliers on Arbitrum, token holders on Monad!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multi-chain leaderboard mode
  if ((mode as string) === 'multi-chain') {
    if (isMultiChainLoading) {
      return (
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-48 mx-auto mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header & Chain Stats */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Detective Leaderboards</h2>
            <p className="text-gray-400 text-sm">Multi-chain rankings and synthetic identity performance</p>
          </div>

          {/* Chain Overview */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {multiChainData?.chainStats && Object.entries(multiChainData.chainStats).map(([chainKey, stats]) => {
              const chain = chainKey as Chain;
              const config = getChainBadge(chain);
              
              return (
                <div 
                  key={chain}
                  className={`border rounded-xl p-4 transition-all cursor-pointer ${
                    selectedChain === chain 
                      ? config.color + ' border-opacity-100' 
                      : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                  }`}
                  onClick={() => setSelectedChain(chain)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{config.icon}</span>
                      <h3 className="font-bold text-white">{config.name}</h3>
                    </div>
                    <span className="text-xs bg-slate-700/50 px-2 py-1 rounded">
                      {config.description}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400">Players</div>
                      <div className="font-bold text-white">{stats.totalPlayers.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Games</div>
                      <div className="font-bold text-white">{stats.totalGames.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">NFT Holders</div>
                      <div className="font-bold text-blue-400">{stats.nftHolders.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Top Score</div>
                      <div className="font-bold text-green-400">{stats.topAccuracy.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard Controls */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Leaderboard Type Selector */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
              {(['current-game', 'season', 'all-time', 'nft-holders'] as LeaderboardType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setLeaderboardType(type)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    leaderboardType === type
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </button>
              ))}
            </div>

            {/* Time Frame Selector */}
            {leaderboardType !== 'current-game' && (
              <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                {(['24h', '7d', '30d', 'all'] as TimeFrame[]).map((time) => (
                  <button
                    key={time}
                    onClick={() => setTimeFrame(time)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      timeFrame === time
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-center">
            <h3 className="font-bold text-white">
              {getLeaderboardTitle(leaderboardType)} - {getChainBadge(selectedChain).name}
            </h3>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
          {multiChainData?.[selectedChain] && multiChainData[selectedChain].length > 0 ? (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 text-sm font-medium text-gray-400">Rank</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-400">Player</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-400">Accuracy</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiChainData[selectedChain].map((entry, index) => (
                      <tr key={entry.player.fid} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-yellow-400' :
                              index === 1 ? 'text-gray-300' :
                              index === 2 ? 'text-yellow-600' :
                              'text-gray-500'
                            }`}>
                              #{index + 1}
                            </span>
                            {index < 3 && (
                              <span className="text-sm">
                                {index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-bold">
                                {entry.player.username.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-white">@{entry.player.username}</div>
                              <div className="text-xs text-gray-400">{entry.player.displayName}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4">
                          <span className="text-lg font-bold text-white">{entry.accuracy.toFixed(1)}%</span>
                        </td>
                        
                        <td className="py-4">
                          <div className="flex gap-1">
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                              NFT
                            </span>
                            {selectedChain === 'monad' && (
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">
                                TOKEN
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-400">No players found for the selected criteria.</p>
            </div>
          )}
        </div>

        {/* Cross-Chain Insights */}
        {multiChainData?.crossChainRankings && (
          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-purple-500/30 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="font-bold text-white mb-4 text-center">
              🌐 Cross-Chain Elite Rankings
            </h3>
            <p className="text-gray-300 text-sm text-center mb-4">
              Top performers across both Arbitrum and Monad ecosystems
            </p>
            
            <div className="grid md:grid-cols-3 gap-4">
              {multiChainData.crossChainRankings.slice(0, 3).map((entry, index) => (
                <div key={entry.player.fid} className="bg-slate-900/50 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">
                    {index === 0 ? '👑' : index === 1 ? '⭐' : '🔥'}
                  </div>
                  <div className="font-bold text-white">@{entry.player.username}</div>
                  <div className="text-purple-300 font-bold">{entry.accuracy.toFixed(1)}%</div>
                  <div className="text-xs text-gray-400 mt-1">Cross-chain champion</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-red-400">Failed to load leaderboard.</div>;
  }

  if (!leaderboard) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-gray-400">Loading Leaderboard...</div>;
  }

  // Career stats mode
  if ((mode as string) === 'career') {
    if (!careerStats) {
      return (
        <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center">
          <div className="animate-pulse mb-4">
            <div className="h-8 bg-slate-700 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-32 mx-auto"></div>
          </div>
          <p className="text-gray-500">Loading your stats...</p>
        </div>
      );
    }

    const speedSeconds = (careerStats.avgSpeed / 1000).toFixed(1);

    return (
      <div className="bg-slate-800 rounded-lg p-6 mt-8">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setMode('current' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'current'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Game
          </button>
          <button
            onClick={() => setMode('career' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'career'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Career Stats
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Career Stats</h2>

        {/* Main stats grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Games Played</div>
            <div className="text-3xl font-bold text-white">
              {careerStats.totalGames}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-purple-500/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Overall Accuracy</div>
            <div className="text-3xl font-bold text-purple-300">
              {careerStats.overallAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {careerStats.totalCorrect} of {careerStats.totalVotes} correct
            </div>
          </div>

          <div className="bg-slate-900/50 border border-green-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Best Game</div>
            <div className="text-3xl font-bold text-green-400">
              {careerStats.bestAccuracy.toFixed(0)}%
            </div>
          </div>

          <div className="bg-slate-900/50 border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Avg Decision Speed</div>
            <div className="text-3xl font-bold text-blue-400">{speedSeconds}s</div>
            <div className="text-xs text-gray-500 mt-1">per correct vote</div>
          </div>
        </div>

        {/* Game history */}
        {careerStats.leaderboardHistory.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-white mb-3">Game History</h3>
            <div className="space-y-2">
              {careerStats.leaderboardHistory.map((entry, idx) => {
                const date = new Date(entry.timestamp).toLocaleDateString();
                const percentile = Math.round(
                  ((entry.totalPlayers - entry.rank) / entry.totalPlayers) * 100
                );

                return (
                  <div
                    key={entry.gameId}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        Game #{careerStats.totalGames - idx}
                      </div>
                      <div className="text-xs text-gray-500">{date}</div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-300">
                          {entry.accuracy.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-500">accuracy</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-300">
                          #{entry.rank}
                        </div>
                        <div className="text-xs text-gray-500">
                          top {percentile}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        {careerStats.totalGames > 0 && (
          <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-4 mt-6">
            <h3 className="font-bold text-white mb-2">Insights</h3>
            <div className="space-y-2 text-sm text-gray-300">
              {careerStats.totalGames < 3 ? (
                <p>💡 Play more games to unlock deeper insights about your playstyle!</p>
              ) : (
                <>
                  <p>
                    📈{' '}
                    {careerStats.overallAccuracy >= 60
                      ? "You're above average! Keep playing to stay sharp."
                      : 'Keep practicing - you improve with each game!'}
                  </p>
                  <p>
                    ⚡ You make decisions{' '}
                    {careerStats.avgSpeed < 20000
                      ? 'very quickly'
                      : careerStats.avgSpeed < 35000
                        ? 'at a good pace'
                        : 'more carefully'}{' '}
                    - this is your strength!
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Current game leaderboard mode
  if (!leaderboard) {
    return <div className="bg-slate-800 rounded-lg p-6 mt-8 text-center text-gray-400">Loading Leaderboard...</div>;
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 mt-8">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setMode('current' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'current'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Game
          </button>
          {fid && (
            <button
              onClick={() => setMode('career' as LeaderboardMode)}
              className={`px-4 py-2 font-medium transition-colors ${
                (mode as string) === 'career'
                  ? 'border-b-2 border-blue-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Career Stats
            </button>
          )}
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
        <p className="text-gray-400 text-center">No scores recorded yet. Play a match to get on the board!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 mt-8">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        <button
          onClick={() => setMode('current' as LeaderboardMode)}
          className={`px-4 py-2 font-medium transition-colors ${
            (mode as string) === 'current'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Current Game
        </button>
        {fid && (
          <button
            onClick={() => setMode('career' as LeaderboardMode)}
            className={`px-4 py-2 font-medium transition-colors ${
              (mode as string) === 'career'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Career Stats
          </button>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-slate-700">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-0">Rank</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Player</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.player.fid}>
                    <td className={`whitespace-nowrap py-4 pl-4 pr-3 text-lg font-bold sm:pl-0 ${getRankColor(index + 1)}`}>
                      #{index + 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <Image className="h-10 w-10 rounded-full" src={entry.player.pfpUrl} alt="" width={40} height={40} />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-white">{entry.player.displayName}</div>
                          <div className="text-gray-500">@{entry.player.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-lg font-semibold text-white">{entry.accuracy.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

