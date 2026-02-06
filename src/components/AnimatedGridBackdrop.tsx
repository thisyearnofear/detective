'use client';

import { useEffect, useRef } from 'react';
import styles from './AnimatedGridBackdrop.module.css';

interface AnimatedGridBackdropProps {
  images: string[];
}

export default function AnimatedGridBackdrop({
  images,
}: AnimatedGridBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // OPTIMIZED: Only calculate layout once, no continuous mouse tracking
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return;
    }

    // Static grid - no ongoing calculations or event listeners needed
    // Original parallax effect removed for performance
  }, []);

  return (
    <div className={styles.backdrop} ref={containerRef}>
      <div className={styles.grid}>
        {images.map((image, idx) => (
          <div
            key={idx}
            className={styles.gridItem}
            style={{
              backgroundImage: `url(${image})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
