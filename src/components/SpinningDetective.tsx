'use client';

interface SpinningDetectiveProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function SpinningDetective({ size = 'md', className = '' }: SpinningDetectiveProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16', 
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`inline-block ${className}`}>
      <img
        src="/detective.png"
        alt="Detective"
        className={`${sizeClasses[size]} animate-flip-rotate object-contain`}
        style={{
          filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.4))'
        }}
      />
    </div>
  );
}