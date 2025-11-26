import { useEffect, useState } from 'react';
import SpinningDetective from '@/components/SpinningDetective';

type Props = {
    playerCount: number;
    onComplete: () => void;
};

export default function BotGeneration({ playerCount, onComplete }: Props) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev + Math.random() * 15 + 5; // 5-20% increments
                if (newProgress >= 100) {
                    setTimeout(onComplete, 500);
                    return 100;
                }
                return newProgress;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div className="text-center space-y-6 md:space-y-8">
            <div className="space-y-3 md:space-y-4">
                <SpinningDetective size="xl" className="mx-auto" />
                <h2 className="hero-title text-2xl md:text-3xl font-black text-stroke">
                    Generating AI Opponents
                </h2>
                <p className="text-gray-400 text-xs md:text-sm px-4">
                    Creating unique AI personas based on player profiles...
                </p>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 md:p-6 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                    <span className="text-xs md:text-sm font-medium text-white">Bot Generation</span>
                    <span className="text-xs md:text-sm font-bold text-blue-400">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-slate-700/50 h-2 md:h-3 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-200"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500 mt-3 md:mt-4">
                    Analyzing {playerCount} players · Creating {playerCount} AI opponents
                </p>
            </div>
        </div>
    );
}
