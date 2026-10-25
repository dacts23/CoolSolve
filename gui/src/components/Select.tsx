import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectItem = string | { value?: string; id?: string; label?: string };

export interface SelectGroup {
  group: string;
  options: SelectItem[];
}

export type SelectOption = SelectItem | SelectGroup;

interface SelectProps {
  value: string;
  options: readonly SelectOption[] | SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
}

function isGroup(opt: SelectOption): opt is SelectGroup {
  return typeof opt === 'object' && opt !== null && 'group' in opt && Array.isArray((opt as unknown as SelectGroup).options);
}

function resolveItem(item: SelectItem): { val: string; lbl: string } {
  if (typeof item === 'string') return { val: item, lbl: item };
  const val = item.value ?? item.id ?? '';
  const lbl = item.label ?? val;
  return { val, lbl };
}

function findLabel(options: readonly SelectOption[], value: string): string | undefined {
  for (const opt of options) {
    if (isGroup(opt)) {
      for (const item of opt.options) {
        const { val, lbl } = resolveItem(item);
        if (val === value) return lbl;
      }
    } else {
      const { val, lbl } = resolveItem(opt);
      if (val === value) return lbl;
    }
  }
  return undefined;
}

export default function Select({
  value,
  options,
  onChange,
  className = '',
  style,
  placeholder,
  disabled = false,
  align = 'left',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selectedLabel = findLabel(options, value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && menuRef.current) {
      const activeEl = menuRef.current.querySelector('.custom-select-option.active') as HTMLElement | null;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const renderOptionBtn = (item: SelectItem) => {
    const { val, lbl } = resolveItem(item);
    const isSelected = val === value;
    return (
      <li key={val || lbl} role="option" aria-selected={isSelected}>
        <button
          type="button"
          className={`custom-select-option ${isSelected ? 'active' : ''}`}
          onClick={() => {
            onChange(val);
            setOpen(false);
          }}
        >
          <span className="custom-select-option-text">{lbl}</span>
          {isSelected && <Check size={12} className="custom-select-check" />}
        </button>
      </li>
    );
  };

  return (
    <div
      className={`custom-select ${className} ${align === 'right' ? 'align-right' : ''} ${disabled ? 'disabled' : ''}`}
      ref={rootRef}
      style={style}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="custom-select-label">
          {selectedLabel ?? (placeholder ?? (value || 'Select...'))}
        </span>
        <ChevronDown size={13} className={`custom-select-arrow ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <ul className="custom-select-menu" role="listbox" ref={menuRef}>
          {options.map((opt, idx) => {
            if (isGroup(opt)) {
              return (
                <li key={`grp-${idx}`} className="custom-select-group">
                  <div className="custom-select-group-header">{opt.group}</div>
                  <ul className="custom-select-group-items">
                    {opt.options.map(renderOptionBtn)}
                  </ul>
                </li>
              );
            }
            return renderOptionBtn(opt);
          })}
        </ul>
      )}
    </div>
  );
}
