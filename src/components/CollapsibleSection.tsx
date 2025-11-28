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
        className="w-full flex items-center justify-between py-5 px-0 hover:bg-white/5 transition-all duration-300 rounded-lg group"
      >
        <h3 className="text-sm font-bold text-white/80 group-hover:text-white uppercase tracking-wider">
          {title}
        </h3>
        <span
          className={`text-white/60 group-hover:text-white transition-all duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="pb-6 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
