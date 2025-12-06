"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UserProfile } from "@/lib/types";
import { extractColorsFromImage } from "@/lib/colorExtraction";

interface OpponentCardProps {
  opponent: UserProfile;
  isNewMatch?: boolean;
  compact?: boolean;
  onColorsExtracted?: (primaryRgb: [number, number, number], secondaryRgb: [number, number, number]) => void;
}

export default function OpponentCard({
  opponent,
  isNewMatch = false,
  compact = false,
  onColorsExtracted,
}: OpponentCardProps) {
  const [colors, setColors] = useState({
    primary: "rgb(59, 130, 246)", // blue-500 fallback
    secondary: "rgb(139, 92, 246)", // violet-500 fallback
    primaryRgb: [59, 130, 246] as [number, number, number],
    secondaryRgb: [139, 92, 246] as [number, number, number],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const extractColors = async () => {
      try {
        const extracted = await extractColorsFromImage(opponent.pfpUrl, opponent.fid);
        setColors(extracted);
        if (onColorsExtracted) {
          onColorsExtracted(extracted.primaryRgb, extracted.secondaryRgb);
        }
      } catch (error) {
        console.error("Color extraction failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    extractColors();
  }, [opponent.pfpUrl, opponent.fid, onColorsExtracted]);

  const cardClass = isNewMatch ? "animate-scale-in" : "";
  const baseClass = compact
    ? "p-3 rounded-lg border border-slate-700"
    : "p-6 rounded-xl border-2 border-slate-700";

  return (
    <div
      className={`${baseClass} ${cardClass} transition-all duration-300 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm`}
      style={{
        borderLeftColor: colors.primary,
        borderLeftWidth: compact ? "3px" : "4px",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Profile Picture with Glow Effect */}
        <div className="relative flex-shrink-0">
          {/* Animated glow wrapper */}
          <div
            className={`absolute inset-0 rounded-full blur-md opacity-40 ${isLoading ? "animate-pulse" : "animate-fade-in"}`}
            style={{ backgroundColor: colors.primary }}
          />

          {/* Profile picture */}
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2"
            style={{ borderColor: colors.primary }}>
            <Image
              src={opponent.pfpUrl}
              alt={opponent.displayName}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-white truncate ${compact ? "text-sm" : "text-lg"}`}>
            {opponent.displayName}
          </h3>
          <p className={`text-gray-400 truncate ${compact ? "text-xs" : "text-sm"}`}>
            @{opponent.username}
          </p>
          {!compact && (
            <p className="text-xs text-gray-500 mt-1">FID: {opponent.fid}</p>
          )}
        </div>

        {/* Mystery Badge */}
        <div className="flex-shrink-0 text-center">
          <div className="text-2xl mb-1">🔍</div>
          <p className={`font-semibold ${compact ? "text-xs" : "text-sm"} text-gray-300`}>
            {compact ? "?" : "Who?"}
          </p>
        </div>
      </div>
    </div>
  );
}
