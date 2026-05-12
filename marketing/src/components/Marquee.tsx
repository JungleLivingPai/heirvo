import { useEffect, useRef } from 'react';
import { infiniteMarquee } from '../lib/gsap-fx';

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  gap?: string;
  separator?: string;
  style?: React.CSSProperties;
}

export function Marquee({
  children,
  speed = 35,
  direction = 'left',
  pauseOnHover = true,
  gap = '4rem',
  separator,
  style = {},
}: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = infiniteMarquee(trackRef.current, { speed, direction, pauseOnHover });
    return cleanup;
  }, [speed, direction, pauseOnHover]);

  const items = Array.isArray(children) ? children : [children];
  const withSep = separator
    ? items.flatMap((child, i) => [
        child,
        <span key={`sep-${i}`} aria-hidden="true" style={{ opacity: 0.3 }}>{separator}</span>,
      ])
    : items;

  return (
    <div style={{ overflow: 'hidden', width: '100%', ...style }}>
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap,
          whiteSpace: 'nowrap',
          willChange: 'transform',
        }}
      >
        {withSep}
      </div>
    </div>
  );
}
