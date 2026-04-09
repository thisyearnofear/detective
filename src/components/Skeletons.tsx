// src/components/Skeletons.tsx
/**
 * Skeleton Loading Components
 * 
 * Provides loading placeholders for better perceived performance
 * while data is being fetched.
 */

"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

/**
 * Base skeleton component with customizable styling
 */
export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseStyles = "bg-white/10";
  
  const variantStyles = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };
  
  const animationStyles = {
    pulse: "animate-pulse",
    wave: "skeleton-wave",
    none: "",
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

/**
 * Text skeleton with variable width
 */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? "60%" : "100%"}
          height={16}
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton placeholder
 */
export function AvatarSkeleton({ size = 48 }: { size?: number }) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className="flex-shrink-0"
    />
  );
}

/**
 * Card skeleton for game-related content
 */
export function GameCardSkeleton() {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-3">
        <AvatarSkeleton size={40} />
        <div className="flex-1">
          <Skeleton width={120} height={20} className="mb-2" />
          <Skeleton width={80} height={14} />
        </div>
      </div>
      <Skeleton height={60} />
      <div className="flex gap-2 mt-3">
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
      </div>
    </div>
  );
}

/**
 * Leaderboard skeleton
 */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton width={24} height={24} />
          <AvatarSkeleton size={32} />
          <div className="flex-1">
            <Skeleton width={100} height={16} className="mb-1" />
            <Skeleton width={60} height={12} />
          </div>
          <Skeleton width={50} height={24} />
        </div>
      ))}
    </div>
  );
}

/**
 * Player count skeleton
 */
export function PlayerCountSkeleton() {
  return (
    <div className="text-center">
      <Skeleton width={60} height={48} className="mx-auto mb-2" />
      <Skeleton width={100} height={16} />
    </div>
  );
}

export default {
  Skeleton,
  TextSkeleton,
  AvatarSkeleton,
  GameCardSkeleton,
  LeaderboardSkeleton,
  PlayerCountSkeleton,
};