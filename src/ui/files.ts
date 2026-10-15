// Saving a text file for the person to keep, and reading one they pick. Phone version; the web version is files.web.ts.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { MAX_PICK_BYTES, type PickResult } from './files.types';

export type { PickResult, PickedText } from './files.types';

/** Hands a file to the phone's share sheet (Save to Files, Drive, email, …). Returns a message if it didn't work, else null. */
export async function saveText(name: string, text: string, mime: string): Promise<string | null> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'Sharing isn’t available on this device.';
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
    return null;
  } catch {
    return 'Couldn’t create that file. Try again.';
  }
}

/** Lets the person choose a file and reads it as text. File types for GPX and TCX aren't reliable, so any file can be picked. */
export async function pickText(): Promise<PickResult> {
  try {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return { canceled: true };
    const a = r.assets[0];
    if (a.size != null && a.size > MAX_PICK_BYTES) return { canceled: false, error: 'That file is too large to import.' };
    return { canceled: false, file: { name: a.name, text: await new File(a.uri).text() } };
  } catch {
    return { canceled: false, error: 'Couldn’t read that file.' };
  }
}
