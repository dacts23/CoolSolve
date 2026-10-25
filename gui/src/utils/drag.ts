/**
 * Shared mouse-drag resize for the split panes and the sidebar.
 * Takes over the body cursor/selection while dragging and restores them on
 * release, so every resizable surface behaves the same way.
 */
export function startResizeDrag(
  cursor: 'col-resize' | 'row-resize',
  onMove: (e: MouseEvent) => void
): void {
  document.body.style.cursor = cursor;
  document.body.style.userSelect = 'none';
  document.body.classList.add('is-resizing-pane');

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('is-resizing-pane');
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
