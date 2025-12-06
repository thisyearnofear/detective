import { Player, UserProfile } from '@/lib/types';
import LoadingOverlay from '@/components/LoadingOverlay';

type Props = {
    currentPlayer: UserProfile;
    registeredPlayers: Player[];
    maxPlayers: number;
    timeLeft: number;
    isRegistered: boolean;
    isLoading: boolean;
    error: string | null;
    onRegister: () => void;
    onReady: () => void;
    phaseMessage?: string;
};

export default function Lobby({
    currentPlayer,
    registeredPlayers,
    maxPlayers,
    timeLeft,
    isRegistered,
    isLoading,
    error,
    onRegister,
    onReady,
    phaseMessage
}: Props) {
    const spotsLeft = maxPlayers - registeredPlayers.length;
    const isFull = spotsLeft === 0;

    const formatTimeLeft = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6">
            <LoadingOverlay variant="registration" isVisible={isLoading} inline />

            {/* Registration Status Header */}
            <div className="text-center">
                <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke mb-2">
                    Game Lobby
                </h2>
                <p className="text-gray-400 text-xs md:text-sm">
                    {isFull ? 'Lobby is full!' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining`}
                </p>
                {phaseMessage && (
                    <p className="text-gray-500 text-xs mt-2 italic">
                        {phaseMessage}
                    </p>
                )}
            </div>

            {/* Registration Progress */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                    <span className="text-xs md:text-sm font-medium text-white">Players Registered</span>
                    <span className="text-xs md:text-sm font-bold text-blue-400">{registeredPlayers.length}/{maxPlayers}</span>
                </div>
                <div className="w-full bg-slate-700/50 h-2 md:h-3 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                        style={{ width: `${(registeredPlayers.length / maxPlayers) * 100}%` }}
                    />
                </div>
            </div>

            {/* Time Remaining */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 text-center backdrop-blur-sm">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Time Remaining</span>
                <div className="text-4xl md:text-5xl font-black text-white mt-2">
                    {formatTimeLeft(timeLeft)}
                </div>
            </div>

            {/* Registered Players List */}
            {registeredPlayers.length > 0 && (
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
                    <h3 className="font-bold text-white mb-4 text-sm md:text-base">Registered Players</h3>
                    <div className="space-y-2">
                        {registeredPlayers.map((player: Player) => (
                            <div
                                key={player.fid}
                                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-xs font-bold">
                                            {player.username.slice(0, 1).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">@{player.username}</div>
                                        <div className="text-xs text-gray-500">{player.displayName}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {player.fid === currentPlayer.fid && (
                                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                                            You
                                        </span>
                                    )}
                                    {player.isReady && (
                                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                                            Ready
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Registration Button - Mobile optimized */}
            {!isRegistered ? (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Registration button clicked'); // Debug log
                        onRegister();
                    }}
                    disabled={isLoading || isFull}
                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm md:text-base touch-manipulation active:scale-[0.98] min-h-[44px]"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                    {isLoading ? 'Registering...' : isFull ? 'Lobby Full' : 'Register for Game'}
                </button>
            ) : (
                <div className="space-y-3">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center text-green-300 text-sm">
                        ✅ You're registered!
                    </div>

                    {registeredPlayers.length >= 4 && (
                        <div className="animate-fade-in">
                            {registeredPlayers.find((p: Player) => p.fid === currentPlayer.fid)?.isReady ? (
                                <div className="w-full px-6 py-4 bg-slate-700/50 border border-slate-600 rounded-lg text-center text-gray-300 font-bold">
                                    Waiting for other players...
                                </div>
                            ) : (
                                <button
                                    onClick={onReady}
                                    disabled={isLoading}
                                    className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20 animate-pulse"
                                >
                                    {isLoading ? 'Setting Ready...' : 'Ready to Start!'}
                                </button>
                            )}
                            <p className="text-xs text-center text-gray-500 mt-2">
                                Game starts when all players are ready (min 4)
                            </p>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-200 text-sm text-center backdrop-blur-sm">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}
