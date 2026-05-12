import { useEffect, useRef } from 'react';
import { scrollProgressBar } from '../lib/gsap-fx';

interface ScrollProgressProps {
  color?: string;
  height?: number;
  zIndex?: number;
}

export function ScrollProgress({ color = '#7c3aed', height = 2, zIndex = 1000 }: ScrollProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = scrollProgressBar(barRef.current);
    return cleanup;
  }, []);

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height,
        background: color,
        zIndex,
        transformOrigin: 'left center',
        pointerEvents: 'none',
      }}
    />
  );
}
