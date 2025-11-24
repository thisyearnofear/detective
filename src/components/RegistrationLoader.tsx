"use client";

import { useEffect, useState } from "react";

type LoadingStep = "score" | "scraping" | "style" | "opponents" | "complete";

interface RegistrationLoaderProps {
  isVisible: boolean;
}

export default function RegistrationLoader({ isVisible }: RegistrationLoaderProps) {
  const [currentStep, setCurrentStep] = useState<LoadingStep>("score");
  const [scrapedCount, setScrapedCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Score validation (300ms)
    const scoreTimer = setTimeout(() => {
      setCurrentStep("scraping");
    }, 300);

    // Scraping progress (posts 1-30 over 1.2s)
    const scrapingTimer = setInterval(() => {
      setScrapedCount((prev) => {
        const next = prev + 1;
        if (next >= 30) {
          clearInterval(scrapingTimer);
          setTimeout(() => setCurrentStep("style"), 100);
          return 30;
        }
        return next;
      });
    }, 40);

    // Style extraction (400ms)
    const styleTimer = setTimeout(() => {
      setCurrentStep("style");
    }, 1800);

    // Opponents preparation (200ms)
    const opponentsTimer = setTimeout(() => {
      setCurrentStep("opponents");
    }, 2300);

    // Complete
    const completeTimer = setTimeout(() => {
      setCurrentStep("complete");
    }, 2600);

    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(styleTimer);
      clearTimeout(opponentsTimer);
      clearTimeout(completeTimer);
      clearInterval(scrapingTimer);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const getStepProgress = (): number => {
    switch (currentStep) {
      case "score":
        return 20;
      case "scraping":
        return 20 + (scrapedCount / 30) * 40; // 20-60%
      case "style":
        return 65;
      case "opponents":
        return 85;
      case "complete":
        return 100;
    }
  };

  const currentProgress = getStepProgress();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-700 shadow-2xl">
        {/* Header */}
        <h2 className="text-2xl font-bold text-white mb-2">
          Setting up your game...
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Analyzing your Farcaster presence
        </p>

        {/* Status Messages */}
        <div className="space-y-3 mb-6">
          {/* Score Validation */}
          <div className={`flex items-center gap-3 transition-all ${
            currentStep === "score" || currentProgress > 20 ? "opacity-100" : "opacity-50"
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              currentProgress > 20
                ? "bg-green-500 text-white"
                : "bg-slate-700 text-slate-500 animate-pulse"
            }`}>
              {currentProgress > 20 ? "✓" : "•"}
            </div>
            <span className="text-sm text-gray-300">Validating Farcaster score</span>
          </div>

          {/* Scraping Posts */}
          <div className={`flex items-center gap-3 transition-all ${
            currentStep === "scraping" || currentProgress > 60 ? "opacity-100" : "opacity-50"
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              currentProgress > 60
                ? "bg-green-500 text-white"
                : currentStep === "scraping"
                  ? "bg-blue-500 text-white animate-pulse"
                  : "bg-slate-700 text-slate-500"
            }`}>
              {currentProgress > 60 ? "✓" : currentStep === "scraping" ? scrapedCount : "•"}
            </div>
            <span className="text-sm text-gray-300">
              Scraping recent casts{currentStep === "scraping" && ` (${scrapedCount}/30)`}
            </span>
          </div>

          {/* Style Extraction */}
          <div className={`flex items-center gap-3 transition-all ${
            currentStep === "style" || currentProgress > 65 ? "opacity-100" : "opacity-50"
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              currentProgress > 65
                ? "bg-green-500 text-white"
                : currentStep === "style"
                  ? "bg-blue-500 text-white animate-pulse"
                  : "bg-slate-700 text-slate-500"
            }`}>
              {currentProgress > 65 ? "✓" : "•"}
            </div>
            <span className="text-sm text-gray-300">Extracting writing style</span>
          </div>

          {/* Preparing Opponents */}
          <div className={`flex items-center gap-3 transition-all ${
            currentStep === "opponents" || currentProgress > 85 ? "opacity-100" : "opacity-50"
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              currentProgress > 85
                ? "bg-green-500 text-white"
                : currentStep === "opponents"
                  ? "bg-blue-500 text-white animate-pulse"
                  : "bg-slate-700 text-slate-500"
            }`}>
              {currentProgress > 85 ? "✓" : "•"}
            </div>
            <span className="text-sm text-gray-300">Preparing opponents</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {currentProgress === 100 ? "Ready to play!" : `${Math.round(currentProgress)}%`}
          </p>
        </div>

        {/* Neural Network Visual */}
        <div className="flex justify-center gap-3 mb-4">
          <div className={`w-2 h-2 rounded-full ${
            currentProgress > 20 ? "bg-green-500" : "bg-slate-700 animate-pulse"
          }`} />
          <div className={`w-2 h-2 rounded-full ${
            currentProgress > 60 ? "bg-green-500" : "bg-slate-700 animate-pulse"
          }`} />
          <div className={`w-2 h-2 rounded-full ${
            currentProgress > 85 ? "bg-green-500" : "bg-slate-700 animate-pulse"
          }`} />
        </div>

        {/* Complete Message */}
        {currentProgress === 100 && (
          <div className="text-center animate-fade-in">
            <p className="text-green-400 font-semibold text-sm">
              ✓ You're registered and ready!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
