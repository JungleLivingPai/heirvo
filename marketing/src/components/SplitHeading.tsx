import { useEffect, useRef } from 'react';
import { splitReveal } from '../lib/gsap-fx';

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4';

interface SplitHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingTag;
  delay?: number;
  stagger?: number;
  duration?: number;
  ease?: string;
}

export function SplitHeading({
  as: Tag = 'h2',
  children,
  className = '',
  delay = 0,
  stagger = 0.12,
  duration = 0.8,
  ease = 'cinematic',
  ...props
}: SplitHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const cleanup = splitReveal(ref.current, { delay, stagger, duration, ease });
    return cleanup;
  }, [delay, stagger, duration, ease]);

  return (
    <Tag ref={ref} className={className} {...props}>
      {children}
    </Tag>
  );
}
