import { useState, useRef, useCallback, type ReactNode } from 'react';

interface TooltipProps {
  /** Content rendered inside the tooltip bubble */
  content: ReactNode;
  /** The trigger element (e.g. an info icon) */
  children: ReactNode;
  className?: string;
}

/**
 * An Obsidian-style viewport-aware tooltip that appears smoothly
 * above (or below when near top) its trigger element.
 */
export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; placeBottom: boolean }>({
    x: 0,
    y: 0,
    placeBottom: false,
  });
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placeBottom = rect.top < 110;
    const rawX = rect.left + rect.width / 2;
    const maxW = 300;
    const half = maxW / 2;
    const x = Math.max(half + 12, Math.min(rawX, window.innerWidth - half - 12));
    const y = placeBottom ? rect.bottom + 6 : rect.top - 6;

    setCoords({ x, y, placeBottom });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <span
      ref={wrapRef}
      className={`config-tooltip-wrap ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className={`config-tooltip ${coords.placeBottom ? 'place-bottom' : ''}`}
          style={{
            left: coords.x,
            top: coords.placeBottom ? coords.y : undefined,
            bottom: !coords.placeBottom ? window.innerHeight - coords.y : undefined,
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
