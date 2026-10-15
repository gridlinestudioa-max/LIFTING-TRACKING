// Saving a file (text, or bytes such as a PDF) for the person to keep, and reading one they pick. Web version; the phone version is files.ts.

import { MAX_PICK_BYTES, type PickResult } from './files.types';

export type { PickResult, PickedText } from './files.types';

/** Downloads a file in the browser. Returns a message if it didn't work, else null. */
export async function saveText(name: string, text: string | Uint8Array, mime: string): Promise<string | null> {
  try {
    const url = URL.createObjectURL(new Blob([text as BlobPart], { type: typeof text === 'string' ? `${mime};charset=utf-8` : mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return null;
  } catch {
    return 'Couldn’t create that file. Try again.';
  }
}

/** Opens the browser's file chooser and reads the file as text. */
export function pickText(): Promise<PickResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx,.tcx,.xml,application/gpx+xml,text/xml,application/xml';
    input.addEventListener('cancel', () => resolve({ canceled: true }));
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return resolve({ canceled: true });
      if (f.size > MAX_PICK_BYTES) return resolve({ canceled: false, error: 'That file is too large to import.' });
      try {
        resolve({ canceled: false, file: { name: f.name, text: await f.text() } });
      } catch {
        resolve({ canceled: false, error: 'Couldn’t read that file.' });
      }
    });
    input.click();
  });
}
