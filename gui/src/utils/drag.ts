/**
 * Shared mouse-drag resize for the split panes and the sidebar.
 * Takes over the body cursor/selection while dragging and restores them on
 * release, so every resizable surface behaves the same way.
 */
let activeDrag: (() => void) | null = null;

export function startResizeDrag(
  cursor: 'col-resize' | 'row-resize',
  onMove: (e: MouseEvent) => void
): () => void {
  // A second drag steals the first drag's cursor snapshot: end the first one
  // cleanly instead of corrupting its restore.
  if (activeDrag) activeDrag();
  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = 'none';
  document.body.classList.add('is-resizing-pane');

  const onUp = () => {
    cleanup();
  };
  const onBlur = () => cleanup();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup();
  };
  function cleanup() {
    if (activeDrag === cleanup) activeDrag = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('keydown', onKey, true);
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    document.body.classList.remove('is-resizing-pane');
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('keydown', onKey, true);
  activeDrag = cleanup;
  return cleanup;
}
