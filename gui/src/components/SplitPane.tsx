import { useRef, useCallback, useEffect, useState } from 'react';

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
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-resizing-pane');
  }, [direction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newSize: number;

      if (direction === 'horizontal') {
        const offset = e.clientX - rect.left;
        newSize = (offset / rect.width) * 100;
      } else {
        const offset = e.clientY - rect.top;
        newSize = (offset / rect.height) * 100;
      }

      // Apply min/max constraints
      const containerPx = direction === 'horizontal' ? rect.width : rect.height;
      const minPct = (minSize / containerPx) * 100;
      const maxPct = maxSize ? (maxSize / containerPx) * 100 : Math.max(minPct, ((containerPx - minSize) / containerPx) * 100);

      newSize = Math.max(minPct, Math.min(maxPct, newSize));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('is-resizing-pane');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, minSize, maxSize, onResize]);

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
