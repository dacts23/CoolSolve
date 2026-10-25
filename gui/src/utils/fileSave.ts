/**
 * fileSave.ts — File saving helper that triggers the native Windows File Explorer
 * (via showSaveFilePicker) so the user can choose the exact directory and filename,
 * with a fallback to browser download for environments without File System Access API.
 */

export interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

export async function saveFileWithPicker(
  data: Blob | string,
  suggestedName: string,
  types?: FilePickerType[]
): Promise<{ saved: boolean; name?: string }> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName?: string;
          types?: FilePickerType[];
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName,
        types,
      });
      const writable = await handle.createWritable();
      try {
        await writable.write(data);
      } catch {
        await writable.abort().catch(() => {});
        return { saved: false };
      }
      await writable.close();
      return { saved: true, name: handle.name };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { saved: false };
      }
      // On permission or other errors, continue to fallback below
    }
  }

  // Fallback: a plain download starts here. The browser gives no
  // confirmation, so saved means "started", not "on disk".
  if (typeof document === 'undefined') return { saved: false };
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  // Revoke soon: long holds leak memory on rapid exports.
  const cleanup = () => {
    try {
      if (a.parentNode) document.body.removeChild(a);
    } catch { /* already removed */ }
    URL.revokeObjectURL(url);
  };
  setTimeout(cleanup, 5000);
  return { saved: true, name: suggestedName };
}
