"use client";

import { useState, useCallback } from "react";

interface OnboardingProps {
    onComplete: () => void;
    playerName?: string;
}

const ONBOARDING_STEPS = [
    {
        icon: "🕵️",
        title: "Welcome, Detective",
        description: "You're about to enter 2 chat rooms simultaneously. Your mission: figure out who's human and who's AI.",
        highlight: "Each round, you'll chat with 2 opponents at once.",
    },
    {
        icon: "💬",
        title: "Start Chatting",
        description: "Type naturally and ask questions. Watch how your opponents respond - their timing, style, and answers.",
        highlight: "Look for: typos, response speed, personality quirks.",
    },
    {
        icon: "🤖",
        title: "Make Your Guess",
        description: "At the top of each chat is a toggle switch. Tap it to switch between HUMAN and BOT.",
        highlight: "Toggle: 👤 HUMAN ↔️ 🤖 BOT",
        visual: "toggle",
    },
    {
        icon: "📱",
        title: "Quick Navigation (Mobile)",
        description: "On mobile, swipe left or right to switch between chat rooms instantly.",
        highlight: "Swipe: ← → to navigate between chats",
        mobile: true,
    },
    {
        icon: "⏱️",
        title: "Time's Ticking",
        description: "You have 60 seconds per round. Your vote locks automatically when the timer ends.",
        highlight: "Can change your mind anytime before the timer ends!",
    },
    {
        icon: "🏆",
        title: "Beat the Bots",
        description: "Score points for correct guesses. Climb the leaderboard and prove your detective skills!",
        highlight: "Good luck! 🎯",
    },
];

export default function OnboardingModal({ onComplete, playerName }: OnboardingProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const step = ONBOARDING_STEPS[currentStep];
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

    const handleNext = useCallback(() => {
        if (isLastStep) {
            // Save that user has completed onboarding
            try {
                localStorage.setItem("detective_onboarding_complete", "true");
            } catch (e) {
                // localStorage might not be available
            }
            onComplete();
        } else {
            setCurrentStep((prev) => prev + 1);
        }
    }, [isLastStep, onComplete]);

    const handlePrevious = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    }, [currentStep]);

    const handleSkip = useCallback(() => {
        try {
            localStorage.setItem("detective_onboarding_complete", "true");
        } catch (e) {
            // localStorage might not be available
        }
        onComplete();
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Skip button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-sm transition-colors"
                >
                    Skip
                </button>

                {/* Content */}
                <div className="px-8 pt-12 pb-8 text-center">
                    {/* Icon with animation */}
                    <div className="text-6xl mb-6 animate-bounce-slow">
                        {step.icon}
                    </div>

                    {/* Welcome personalization */}
                    {currentStep === 0 && playerName && (
                        <p className="text-blue-400 text-sm font-medium mb-2">
                            Hey, {playerName}! 👋
                        </p>
                    )}

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-white mb-4">
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-gray-300 mb-4 leading-relaxed">
                        {step.description}
                    </p>

                    {/* Highlight box */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50 mb-6">
                        {step.visual === "toggle" ? (
                            <div className="flex justify-center mb-2">
                                {/* Toggle visualization */}
                                <div className="relative h-10 w-48 rounded-full p-1 bg-gradient-to-r from-green-900/50 to-green-800/50 border-2 border-green-500/50">
                                    <div className="absolute top-1 bottom-1 w-[45%] left-1 bg-green-600 rounded-full shadow-lg transition-all duration-500" />
                                    <div className="relative flex justify-between items-center h-full px-3">
                                        <span className="font-bold text-xs text-white drop-shadow-md">👤 HUMAN</span>
                                        <span className="font-bold text-xs text-gray-400/80">🤖 BOT</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        <p className="text-sm text-blue-300 font-medium">{step.highlight}</p>
                    </div>

                    {/* Step dots */}
                    <div className="flex justify-center gap-2 mb-6">
                        {ONBOARDING_STEPS.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentStep(index)}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === currentStep
                                        ? "bg-blue-500 w-6"
                                        : index < currentStep
                                            ? "bg-green-500"
                                            : "bg-slate-600"
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrevious}
                                className="flex-1 py-3 px-6 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-blue-500/25"
                        >
                            {isLastStep ? "Let's Go! 🚀" : "Next"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Hook to check if onboarding should be shown
 */
export function useOnboarding() {
    const shouldShowOnboarding = useCallback(() => {
        if (typeof window === 'undefined') return false;
        try {
            return !localStorage.getItem("detective_onboarding_complete");
        } catch {
            return true; // Show by default if localStorage unavailable
        }
    }, []);

    const resetOnboarding = useCallback(() => {
        try {
            localStorage.removeItem("detective_onboarding_complete");
        } catch {
            // Ignore
        }
    }, []);

    return { shouldShowOnboarding, resetOnboarding };
}
