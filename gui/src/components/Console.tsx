import { useEffect, useRef, useMemo } from 'react';
import { useModelStore } from '../stores/modelStore';
import { jumpToLine } from './editorUtils';
import type { Diagnostic } from '../api/types';

export function useActiveDiagnostics(): Diagnostic[] {
  const parseErrors = useModelStore((s) => s.parseErrors);
  const parseDiagnostics = useModelStore((s) => s.parseDiagnostics);
  const solveDiagnostics = useModelStore((s) => s.lastResult?.diagnostics);
  const equationCount = useModelStore((s) => s.equationCount);
  const variableCount = useModelStore((s) => s.variableCount);
  const isSquare = useModelStore((s) => s.isSquare);

  return useMemo(() => {
    const map = new Map<string, Diagnostic>();
    for (const err of parseErrors) {
      const key = `SYNTAX:${err.line}:${err.message}`;
      map.set(key, {
        severity: 'Error',
        code: 'SYNTAX',
        message: err.message,
        line: err.line,
        column: err.column || 1,
        source: 'parser',
      });
    }
    if (equationCount > 0 && !isSquare) {
      const diff = variableCount - equationCount;
      const msg = diff > 0
        ? `System is under-determined (${diff} free variable${diff === 1 ? '' : 's'})`
        : `System is over-determined (${-diff} extra equation${-diff === 1 ? '' : 's'})`;
      map.set(`DOF:0:${msg}`, {
        severity: 'Warning',
        code: 'DOF',
        message: msg,
        line: 0,
        column: 0,
        source: 'structural',
      });
    }
    for (const d of parseDiagnostics) {
      map.set(`${d.code}:${d.line}:${d.message}`, d);
    }
    if (solveDiagnostics) {
      for (const d of solveDiagnostics) {
        map.set(`${d.code}:${d.line}:${d.message}`, d);
      }
    }
    const order: Record<Diagnostic['severity'], number> = { Error: 0, Warning: 1, Info: 2 };
    return Array.from(map.values()).sort(
      (a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || (a.line || 999999) - (b.line || 999999)
    );
  }, [parseErrors, parseDiagnostics, solveDiagnostics, equationCount, variableCount, isSquare]);
}

export function DiagnosticsView() {
  const items = useActiveDiagnostics();

  if (items.length === 0) {
    return (
      <div className="console">
        <div className="console-line" style={{ color: 'var(--text-muted)' }}>
          No warnings or diagnostics.
        </div>
      </div>
    );
  }

  const sevColor = (sev: Diagnostic['severity']) =>
    sev === 'Error' ? 'var(--error-color, #f87171)' : sev === 'Warning' ? '#fbbf24' : 'var(--accent-color, #60a5fa)';

  const sevLabel = (sev: Diagnostic['severity']) =>
    sev === 'Error' ? 'ERR' : sev === 'Warning' ? 'WARN' : 'INFO';

  return (
    <div className="console" style={{ padding: '4px 0' }}>
      {items.map((d, idx) => {
        const line = d.line ?? 0;
        return (
          <div
            key={`${d.code}-${line}-${idx}`}
            onClick={() => { if (line > 0) jumpToLine(line, d.column || 1); }}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '4px 12px',
              fontSize: 12,
              borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,0.1))',
              cursor: line > 0 ? 'pointer' : 'default',
            }}
            title={line > 0 ? `Click to jump to line ${line}` : undefined}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: sevColor(d.severity),
                minWidth: 34,
                letterSpacing: '0.03em',
              }}
            >
              {sevLabel(d.severity)}
            </span>
            <code
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                padding: '1px 5px',
                borderRadius: 3,
                flexShrink: 0,
              }}
            >
              {d.code}
            </code>
            <span style={{ flex: 1, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {d.message}
            </span>
            {d.source && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                {d.source}
              </span>
            )}
            {line > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--accent-color)',
                  fontFamily: 'var(--mono-font)',
                  flexShrink: 0,
                }}
              >
                Ln {line}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Console() {
  const consoleLines = useModelStore((s) => s.consoleLines);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Auto-scroll only when already at the bottom: lets users read history.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const getLineClass = (line: string) => {
    if (line.includes('[Error]') || line.includes('ERROR') || line.includes('FAIL')) return 'console-line error';
    if (line.includes('[Warning]')) return 'console-line warning';
    if (line.includes('SUCCESS') || line.includes('converged')) return 'console-line success';
    if (line[0] === '>' || line[0] === '-') return 'console-line info';
    return 'console-line';
  };

  return (
    <div className="console" ref={containerRef} onScroll={onScroll}>
      {consoleLines.length === 0 ? (
        <div className="console-line" style={{ color: 'var(--text-muted)' }}>
          Ready. Open a file or enter equations to begin.
        </div>
      ) : (
        consoleLines.map((line, i) => (
          <div key={i} className={getLineClass(line)}>
            {line}
          </div>
        ))
      )}
    </div>
  );
}
