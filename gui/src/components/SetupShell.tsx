/**
 * SetupShell.tsx - shared left-sidebar shell and empty-state panel used by the
 * Parametric, Integral, Lookup Tables and Diagrams workspaces (and the
 * Residuals debug view), so their layout stays identical by construction.
 */
import { useState, type ReactNode, type CSSProperties } from 'react';

/** Left sidebar: icon title header + scrollable content. */
export function SetupShell({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="parametric-setup-sidebar">
      <div className="explorer-header">
        <div className="explorer-title-group">
          {icon}
          <span className="explorer-title">{title}</span>
        </div>
      </div>

      <div className="parametric-setup-content">{children}</div>
    </div>
  );
}

/** Settings row: title + hint on the left, control on the right. */
export function PlotRow({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-title">{title}</div>
        <div className="settings-hint">{hint}</div>
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}

/** On/Off segmented toggle button used in settings modals. */
export function PlotToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="segmented">
      <button className={checked ? 'active' : ''} onClick={() => onChange(true)}>On</button>
      <button className={!checked ? 'active' : ''} onClick={() => onChange(false)}>Off</button>
    </div>
  );
}

/** Text-first number field: typing never fights the min/max clamp. */
export function NumInput({ value, min, max, step = 1, onChange, title, width = 84 }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; title: string; width?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const commit = (raw: string) => {
    setText(null);
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <input
      type="number"
      className="settings-input"
      style={{ width }}
      min={min}
      max={max}
      step={step}
      value={text ?? value}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      title={title}
    />
  );
}

/** Footer pagination bar for large tables. */
export function TablePager({
  page,
  totalPages,
  onPageChange,
  label,
}: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="table-footer-status" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
      <button className="table-btn-pill" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        ‹ Prev
      </button>
      <span>{label ?? `Page ${page + 1} of ${totalPages}`}</span>
      <button className="table-btn-pill" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        Next ›
      </button>
    </div>
  );
}

/** Centered empty state: icon, title, one-line description, numbered steps. */
export function EmptyState({
  icon,
  title,
  description,
  steps,
  actions,
  style,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  steps: ReactNode[];
  actions?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="parametric-empty-state" style={style}>
      <div className="empty-state-content">
        <div className="empty-state-icon">{icon}</div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="empty-state-steps">
          {steps.map((step, i) => (
            <div className="step-item" key={i}>
              <span className="step-num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
        {actions}
      </div>
    </div>
  );
}
