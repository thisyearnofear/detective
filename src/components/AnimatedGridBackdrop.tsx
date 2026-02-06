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
  const gridItemsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const canTrackPointer = window.matchMedia?.('(pointer: fine)').matches;

    if (prefersReducedMotion) {
      return;
    }

    // Get random value
    const getRandom = (min: number, max: number) =>
      (Math.random() * (max - min) + min).toFixed(2);

    // Calculate window size
    let winsize = { width: window.innerWidth, height: window.innerHeight };
    const calcWinsize = () => {
      winsize = { width: window.innerWidth, height: window.innerHeight };
    };
    window.addEventListener('resize', calcWinsize);

    // Line equation
    const lineEq = (y2: number, y1: number, x2: number, x1: number, currentVal: number) => {
      const m = (y2 - y1) / (x2 - x1);
      const b = y1 - m * x1;
      return m * currentVal + b;
    };

    const items = gridItemsRef.current.filter(Boolean);
    const config = {
      tiltOffset: { min: 5, max: 40 },
    };

    // Spread grid items with random positions and tilt values
    const spread = () => {
      items.forEach((item) => {
        const randnum = parseFloat(getRandom(config.tiltOffset.min, config.tiltOffset.max));
        const minTy = -1 * randnum;
        const maxTy = randnum;

        item.dataset.minTy = minTy.toString();
        item.dataset.maxTy = maxTy.toString();
        
        // Initial transform is at scale 0.5 with no translation
        item.dataset.ctx = '0';
        item.dataset.cty = '0';
        item.style.transform = `translate(0px, 0px) scale(0.5)`;
      });
    };

    // Tilt effect on mouse move
    const tilt = (ev: MouseEvent) => {
      const mousepos = { x: ev.pageX, y: ev.pageY };
      const docScrolls = {
        left: document.body.scrollLeft + document.documentElement.scrollLeft,
        top: document.body.scrollTop + document.documentElement.scrollTop,
      };
      const relmousepos = {
        x: mousepos.x - docScrolls.left,
        y: mousepos.y - docScrolls.top,
      };

      items.forEach((item) => {
        const ctx = parseFloat(item.dataset.ctx || '0');
        const cty = parseFloat(item.dataset.cty || '0');
        const minTy = parseFloat(item.dataset.minTy || '0');
        const maxTy = parseFloat(item.dataset.maxTy || '0');

        const tiltY = cty + lineEq(maxTy, minTy, winsize.height, 0, relmousepos.y);
        item.style.transform = `translate(${ctx}px, ${tiltY}px) scale(0.5)`;
      });
    };

    spread();

    const tiltHandler = (ev: MouseEvent) => {
      requestAnimationFrame(() => tilt(ev));
    };

    if (canTrackPointer) {
      window.addEventListener('mousemove', tiltHandler);
    }

    return () => {
      if (canTrackPointer) {
        window.removeEventListener('mousemove', tiltHandler);
      }
      window.removeEventListener('resize', calcWinsize);
    };
  }, []);

  return (
    <div className={styles.backdrop} ref={containerRef}>
      <div className={styles.grid}>
        {images.map((image, idx) => (
          <div
            key={idx}
            ref={(el) => {
              if (el) gridItemsRef.current[idx] = el;
            }}
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
