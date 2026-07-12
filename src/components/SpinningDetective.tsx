'use client';

import Image from "next/image";

interface SpinningDetectiveProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_PX: Record<NonNullable<SpinningDetectiveProps["size"]>, number> = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
};

export default function SpinningDetective({ size = 'md', className = '' }: SpinningDetectiveProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`inline-block ${className}`}>
      <Image
        src="/detective.png"
        alt="Detective"
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
        className={`${sizeClasses[size]} animate-flip-rotate object-contain`}
        style={{
          filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.4))'
        }}
      />
    </div>
  );
}
