import { useRef, useCallback, useState } from 'react';
import { startResizeDrag } from '../utils/drag.ts';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  defaultSize: number;       // initial size in % for the first pane
  minSize?: number;           // minimum size in px
  maxSize?: number;           // maximum size in px
  children: [React.ReactNode, React.ReactNode];
  className?: string;
  onResize?: (size: number) => void;
  collapsed?: 'first' | 'second' | 'both' | false;
}

export default function SplitPane({
  direction,
  defaultSize,
  minSize = 100,
  maxSize,
  children,
  className = '',
  onResize,
  collapsed = false,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(defaultSize);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const horizontal = direction === 'horizontal';
      startResizeDrag(horizontal ? 'col-resize' : 'row-resize', (ev) => {
        const offset = horizontal ? ev.clientX - rect.left : ev.clientY - rect.top;
        const containerPx = horizontal ? rect.width : rect.height;
        let newSize = (offset / containerPx) * 100;

        // Apply min/max constraints
        const minPct = (minSize / containerPx) * 100;
        const maxPct = maxSize ? (maxSize / containerPx) * 100 : Math.max(minPct, ((containerPx - minSize) / containerPx) * 100);
        newSize = Math.max(minPct, Math.min(maxPct, newSize));
        setSize(newSize);
        onResize?.(newSize);
      });
    },
    [direction, minSize, maxSize, onResize]
  );

  const isHorizontal = direction === 'horizontal';
  const isFirstCollapsed = collapsed === 'first' || collapsed === 'both';
  const isSecondCollapsed = collapsed === 'second' || collapsed === 'both';

  return (
    <div
      ref={containerRef}
      className={`split-pane ${isHorizontal ? 'split-horizontal' : 'split-vertical'} ${className}`}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* First pane */}
      <div
        className="split-pane-first"
        style={{
          [isHorizontal ? 'width' : 'height']: isFirstCollapsed ? 'auto' : `${size}%`,
          minWidth: !isFirstCollapsed && isHorizontal ? minSize : undefined,
          minHeight: !isFirstCollapsed && !isHorizontal ? minSize : undefined,
          flex: isSecondCollapsed && !isFirstCollapsed ? 1 : undefined,
          flexShrink: isFirstCollapsed ? 0 : undefined,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children[0]}
      </div>

      {/* Divider */}
      {!collapsed && (
        <div
          className={`split-divider ${isHorizontal ? 'split-divider-h' : 'split-divider-v'}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSize(defaultSize)}
          title="Drag to resize, double-click to reset"
        />
      )}

      {/* Second pane */}
      <div
        className="split-pane-second"
        style={{
          [isHorizontal ? 'width' : 'height']: isSecondCollapsed ? 'auto' : undefined,
          flex: isFirstCollapsed && !isSecondCollapsed ? 1 : isSecondCollapsed ? undefined : 1,
          flexShrink: isSecondCollapsed ? 0 : undefined,
          minWidth: !isSecondCollapsed && isHorizontal ? minSize : undefined,
          minHeight: !isSecondCollapsed && !isHorizontal ? minSize : undefined,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children[1]}
      </div>
    </div>
  );
}
