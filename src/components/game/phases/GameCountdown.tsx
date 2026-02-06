import { useEffect, useState, useRef } from 'react';

type Props = {
    playerCount: number;
    onComplete: () => void;
};

export default function GameCountdown({ playerCount, onComplete }: Props) {
    const [count, setCount] = useState(5);
    const hasCompletedRef = useRef(false);

    useEffect(() => {
        hasCompletedRef.current = false;
        
        const interval = setInterval(() => {
            setCount(prev => {
                if (prev <= 1 && !hasCompletedRef.current) {
                    hasCompletedRef.current = true;
                    clearInterval(interval);
                    // Defer onComplete to avoid React hook mismatch during state transition
                    setTimeout(() => onComplete(), 0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div className="text-center space-y-6 md:space-y-8 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px]">
            <p className="text-gray-400 text-xs md:text-sm">Game starts in</p>
            <div className="text-7xl md:text-9xl font-black text-white animate-bounce">
                {count}
            </div>
            <div className="space-y-2 text-center">
                <p className="text-gray-400 text-xs md:text-sm">Prepare yourself...</p>
                <p className="text-xs text-gray-500">You'll manage {playerCount} simultaneous conversations</p>
            </div>
        </div>
    );
}
