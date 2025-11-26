'use client';

import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export default function MobileOptimizedWrapper({ children, className = '' }: Props) {
  return (
    <div className={`min-h-screen w-full overflow-x-hidden ${className}`}>
      {/* Mobile-safe viewport */}
      <div className="min-h-[100vh] min-h-[100dvh] w-full max-w-md mx-auto relative">
        {/* Content with safe areas */}
        <div className="px-4 py-6 md:px-6 md:py-8 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}