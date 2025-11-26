'use client';

import { useState } from 'react';

type Props = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

/**
 * CollapsibleSection - Compact disclosure component
 * 
 * Shows a title with toggle that reveals/hides content with smooth animation.
 * Keeps homepage compact while making all info accessible.
 */
export default function CollapsibleSection({ title, children, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-0 hover:text-white/70 transition-colors"
      >
        <h3 className="text-xs font-medium text-white/50 uppercase tracking-[0.3em]">
          {title}
        </h3>
        <span
          className={`text-white/50 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="pb-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
