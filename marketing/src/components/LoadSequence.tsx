import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface LoadSequenceProps {
  wordmark?: React.ReactNode;
  accentColor?: string;
  bgColor?: string;
  onComplete?: () => void;
  skip?: boolean;
}

export function LoadSequence({
  wordmark    = '●',
  accentColor = '#ffffff',
  bgColor     = '#050508',
  onComplete,
  skip        = false,
}: LoadSequenceProps) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const wipeRef     = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (skip || prefersReduced) {
      setDone(true);
      onComplete?.();
      return;
    }

    document.body.style.overflow = 'hidden';

    const finish = () => {
      document.body.style.overflow = '';
      setDone(true);
      onComplete?.();
    };

    // Safety net — if animation stalls on iOS Safari, force-complete after 3s
    const safetyTimer = setTimeout(finish, 3000);

    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(safetyTimer);
        finish();
      },
    });

    gsap.set(wordmarkRef.current, {
      clipPath: 'inset(0% 100% 0% 0%)',
      willChange: 'clip-path',
    });

    tl.to(wordmarkRef.current, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 0.8,
      ease: 'power4.inOut',
      delay: 0.3,
    })
    .to({}, { duration: 0.7 })
    .to(wordmarkRef.current, {
      opacity: 0,
      y: -12,
      duration: 0.4,
      ease: 'power2.in',
    })
    .to(wipeRef.current, {
      scaleY: 0,
      transformOrigin: 'bottom center',
      duration: 1.0,
      ease: 'power4.inOut',
      willChange: 'transform',
      onComplete: () => gsap.set(wipeRef.current, { willChange: 'auto' }),
    }, '-=0.1');

    return () => {
      clearTimeout(safetyTimer);
      tl.kill();
      document.body.style.overflow = '';
    };
  }, [skip, onComplete]);

  if (done) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={wipeRef}
        style={{ position: 'absolute', inset: 0, background: bgColor }}
      />
      <div
        ref={wordmarkRef}
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          fontWeight: 300,
          fontStyle: 'italic',
          letterSpacing: '0.05em',
          color: accentColor,
          userSelect: 'none',
          willChange: 'clip-path',
        }}
      >
        {wordmark}
      </div>
    </div>
  );
}
