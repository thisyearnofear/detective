import { useEffect } from 'react';
import { Player } from '@/lib/types';

type Props = {
    players: Player[];
    onComplete: () => void;
};

export default function PlayerReveal({ players, onComplete }: Props) {
    useEffect(() => {
        const timer = setTimeout(onComplete, 3000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="text-center space-y-6 md:space-y-8">
            <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke">
                Meet Your Opponents
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {players.map((player) => (
                    <div key={player.fid} className="bg-slate-900/50 border border-white/10 rounded-lg p-3 md:p-4 text-center animate-fade-in backdrop-blur-sm">
                        <div className="text-3xl md:text-4xl mb-2 md:mb-3">👤</div>
                        <div className="text-sm md:text-base font-bold text-white truncate">@{player.username}</div>
                        <div className="text-xs text-gray-400 mt-1">Real Player</div>
                    </div>
                ))}

                {players.map((_, idx) => (
                    <div key={`bot-${idx}`} className="bg-slate-900/50 border border-purple-500/30 rounded-lg p-3 md:p-4 text-center animate-fade-in backdrop-blur-sm">
                        <div className="text-3xl md:text-4xl mb-2 md:mb-3">🤖</div>
                        <div className="text-sm md:text-base font-bold text-purple-300">AI Bot {idx + 1}</div>
                        <div className="text-xs text-gray-400 mt-1">AI Opponent</div>
                    </div>
                ))}
            </div>

            <p className="text-xs md:text-sm text-gray-400">Get ready for simultaneous matches...</p>
        </div>
    );
}
