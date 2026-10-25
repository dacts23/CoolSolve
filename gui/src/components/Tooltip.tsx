import { useState, useRef, useEffect, useLayoutEffect } from 'react';
/**
 * Global application tooltip provider that intercepts native `title` attributes
 * across the app, replacing harsh OS rectangles with CoolSolve's refined visual language.
 */
export function GlobalTooltip() {
  const [data, setData] = useState<{
    text: string;
    x: number;
    y: number;
    placement: 'right' | 'top' | 'bottom';
  } | null>(null);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const stashedTitles = useRef(new Map<HTMLElement, string>());

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el || !data) return;

    if (data.placement === 'right') {
      const rect = el.getBoundingClientRect();
      const pad = 8;
      if (rect.bottom > window.innerHeight - pad) {
        const overflow = rect.bottom - (window.innerHeight - pad);
        el.style.top = `${data.y - overflow}px`;
      } else if (rect.top < pad) {
        el.style.top = `${pad}px`;
      }
      return;
    }

    // Top / Bottom placement: horizontally centered on trigger button.
    // Dynamically nudge only if the rendered bubble overflows the window boundary.
    const rect = el.getBoundingClientRect();
    const pad = 10;
    if (rect.right > window.innerWidth - pad) {
      const overflow = rect.right - (window.innerWidth - pad);
      el.style.transform = `translateX(calc(-50% - ${overflow}px))`;
    } else if (rect.left < pad) {
      const overflow = pad - rect.left;
      el.style.transform = `translateX(calc(-50% + ${overflow}px))`;
    } else {
      el.style.transform = 'translateX(-50%)';
    }
  }, [data]);

  useEffect(() => {
    const resolveTooltip = (target: HTMLElement): string | null => {
      // Text input fields have placeholders and text selection; never show tooltips on them
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.classList.contains('monaco-inputbox')) {
        return null;
      }

      // Transfer title to data-tooltip once so native OS tooltip never displays
      const titleAttr = target.getAttribute('title');
      if (titleAttr) {
        if (!stashedTitles.current.has(target)) stashedTitles.current.set(target, titleAttr);
        target.setAttribute('data-tooltip', titleAttr);
        target.removeAttribute('title');
      }

      const rawText =
        target.getAttribute('data-tooltip') ||
        target.getAttribute('title') ||
        target.getAttribute('aria-label') ||
        '';
      const text = rawText.trim();
      if (!text) return null;

      // Do not display help tooltips for Close buttons — they are completely self-explanatory
      const lower = text.toLowerCase();
      if (
        lower === 'close' ||
        lower.startsWith('close ') ||
        lower.startsWith('close(') ||
        lower.startsWith('close (') ||
        lower.startsWith('close tab') ||
        target.classList.contains('codicon-widget-close')
      ) {
        return null;
      }
      return text;
    };

    const showTooltipFor = (target: HTMLElement, text: string) => {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      let placement: 'right' | 'top' | 'bottom' = 'bottom';
      let x = rect.left + rect.width / 2;
      let y = rect.bottom + 8;

      const findWidget = target.closest<HTMLElement>('.find-widget');
      const inActivityBar = Boolean(target.closest('.activity-bar'));

      if (findWidget) {
        // In the search modal: always position cleanly below the entire find/replace box,
        // centered horizontally under the button you're hovering. Never cuts off or overlaps inputs!
        const fwRect = findWidget.getBoundingClientRect();
        placement = 'bottom';
        x = rect.left + rect.width / 2;
        y = fwRect.bottom + 8;
      } else if (inActivityBar) {
        // Left rail (ActivityBar): always anchor 10px to the right of the entire bar
        placement = 'right';
        const actBar = target.closest('.activity-bar');
        const actRect = actBar ? actBar.getBoundingClientRect() : rect;
        x = actRect.right + 10;
        y = rect.top + rect.height / 2;
      } else if (
        target.closest('.status-bar, .editor-status, footer, .bottom-panel-header') ||
        rect.bottom > window.innerHeight - 80
      ) {
        // Bottom bar: place neatly above, clear of cursor
        placement = 'top';
        x = rect.left + rect.width / 2;
        y = rect.top - 8;
      }

      setData({ text, x, y, placement });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        '[title], [data-tooltip], .find-widget .button, .find-widget [role="button"], .find-widget [role="checkbox"], .find-widget .monaco-custom-checkbox, .find-widget .monaco-custom-toggle'
      );
      if (!target || currentTargetRef.current === target) return;

      const text = resolveTooltip(target);
      currentTargetRef.current = target;
      if (!text) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      // Deliberate 750ms timer so casual mouse travel never pops up tooltips
      timerRef.current = setTimeout(() => {
        if (currentTargetRef.current !== target) return;
        showTooltipFor(target, text);
      }, 750);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      // If moving to a child within the same target, do not cancel or dismiss
      if (currentTargetRef.current && currentTargetRef.current.contains(related)) {
        return;
      }
      currentTargetRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      setData(null);
    };

    const handleDismiss = () => {
      currentTargetRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      setData(null);
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('mousedown', handleDismiss, true);
    window.addEventListener('wheel', handleDismiss, { passive: true, capture: true });
    const handleFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      // Only show on keyboard focus (:focus-visible), never on mouse clicks.
      if (!el || typeof el.matches !== 'function' || !el.matches(':focus-visible')) return;
      const target = typeof el.closest === 'function'
        ? el.closest<HTMLElement>('[title], [data-tooltip]')
        : null;
      if (!target || target === currentTargetRef.current) return;
      const text = resolveTooltip(target);
      currentTargetRef.current = target;
      if (!text) return;
      showTooltipFor(target, text);
    };
    const handleFocusOut = () => {
      currentTargetRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      setData(null);
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    const titles = stashedTitles.current;
    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('mousedown', handleDismiss, true);
      window.removeEventListener('wheel', handleDismiss, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      for (const [el, title] of titles) {
        if (!el.getAttribute('title')) el.setAttribute('title', title);
      }
      titles.clear();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!data) return null;

  return (
    <div
      ref={tooltipRef}
      className={`app-tooltip placement-${data.placement}`}
      style={{
        left: data.x,
        top: data.placement === 'top' ? undefined : data.y,
        bottom: data.placement === 'top' ? window.innerHeight - data.y : undefined,
      }}
    >
      {data.text}
    </div>
  );
}
