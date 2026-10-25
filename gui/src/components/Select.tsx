import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuPos, setMenuPos] = useState<{
    top?: number; bottom?: number; left?: number; right?: number; minWidth: number; maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selectedLabel = findLabel(options, value);

  // The menu renders in a portal on document.body: inside scrollable panels
  // (settings modals, sidebars) an in-flow menu grows their scroll region and
  // scrolls the panel when it opens.
  useEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null);
      return;
    }
    const r = rootRef.current.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const openUp = below < 180 && above > below;
    const maxHeight = Math.max(120, Math.min(240, (openUp ? above : below) - gap));
    const minWidth = Math.max(r.width, 140);
    if (align === 'right') {
      const right = Math.max(margin, window.innerWidth - r.right);
      if (openUp) setMenuPos({ bottom: window.innerHeight - r.top + gap, right, minWidth, maxHeight });
      else setMenuPos({ top: r.bottom + gap, right, minWidth, maxHeight });
    } else {
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - 328));
      if (openUp) setMenuPos({ bottom: window.innerHeight - r.top + gap, left, minWidth, maxHeight });
      else setMenuPos({ top: r.bottom + gap, left, minWidth, maxHeight });
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      (rootRef.current && rootRef.current.contains(t as Node)) ||
      (menuRef.current && menuRef.current.contains(t as Node));
    const onPointerDown = (e: PointerEvent) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // A scroll anywhere outside the menu would detach it from its trigger.
    const onScroll = (e: Event) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open && menuRef.current) {
      const menu = menuRef.current;
      const activeEl = menu.querySelector('.custom-select-option.active') as HTMLElement | null;
      if (activeEl) {
        // Scroll the menu itself only, never an ancestor panel.
        const menuBox = menu.getBoundingClientRect();
        const itemBox = activeEl.getBoundingClientRect();
        if (itemBox.top < menuBox.top) {
          menu.scrollTop -= menuBox.top - itemBox.top;
        } else if (itemBox.bottom > menuBox.bottom) {
          menu.scrollTop += itemBox.bottom - menuBox.bottom;
        }
      }
    }
  }, [open, menuPos]);

  const renderOptionBtn = (item: SelectItem, idx?: number) => {
    const { val, lbl } = resolveItem(item);
    const isSelected = val === value;
    return (
      <li key={`${val}::${lbl}::${idx ?? lbl}`} role="option" aria-selected={isSelected}>
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

      {open && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="custom-select-menu"
              role="listbox"
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPos.top,
                bottom: menuPos.bottom,
                left: menuPos.left,
                right: menuPos.right,
                minWidth: menuPos.minWidth,
                maxHeight: menuPos.maxHeight,
                zIndex: 3000,
              }}
            >
              {options.map((opt, idx) => {
                if (isGroup(opt)) {
                  return (
                    <li key={`grp-${idx}`} className="custom-select-group">
                      <div className="custom-select-group-header">{opt.group}</div>
                      <ul className="custom-select-group-items">
                        {opt.options.map((o, i) => renderOptionBtn(o, i))}
                      </ul>
                    </li>
                  );
                }
                return renderOptionBtn(opt, idx);
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
