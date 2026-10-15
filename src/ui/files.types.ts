/** A text file the person picked. */
export interface PickedText {
  name: string;
  text: string;
}

/** Picked, cancelled, or couldn't be read (`error` says why in plain words). */
export type PickResult = { canceled: true } | { canceled: false; file: PickedText } | { canceled: false; error: string };

/** Longest file read into memory, in bytes. Matches the importer's own limit with room to spare. */
export const MAX_PICK_BYTES = 25_000_000;
