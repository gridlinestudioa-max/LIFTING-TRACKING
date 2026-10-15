import AsyncStorage from '@react-native-async-storage/async-storage';

import { ingest, readSession, type GpsFix, type RecSession } from '@/logic';

// The recording in progress, shared by the recorder screen and the background location task, and saved
// after every change so it survives the app being sent to the background or closed.

const KEY = 'mm_recording_v1';

let current: RecSession | null = null;
let loaded = false;
const listeners = new Set<(s: RecSession | null) => void>();
// Changes run one at a time, in order (GPS batches can arrive while a save is still running).
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<RecSession | null> {
  if (!loaded) {
    const raw = await AsyncStorage.getItem(KEY).catch(() => null);
    try {
      current = raw ? readSession(JSON.parse(raw)) : null;
    } catch {
      current = null;
    }
    loaded = true;
  }
  return current;
}

function emit() {
  for (const l of listeners) l(current);
}

/** Change the session (null to clear it) and save it. */
export function updateSession(fn: (s: RecSession | null) => RecSession | null): Promise<RecSession | null> {
  const run = queue.then(async () => {
    const next = fn(await load());
    if (next === current) return current;
    current = next;
    emit();
    if (next) await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    else await AsyncStorage.removeItem(KEY).catch(() => {});
    return current;
  });
  queue = run.catch(() => {});
  return run;
}

/** Add GPS fixes to the recording, if one is running. */
export function addFixes(fixes: GpsFix[]): Promise<RecSession | null> {
  return updateSession((s) => (s ? ingest(s, fixes) : s));
}

export function getSession(): Promise<RecSession | null> {
  return queue.then(load);
}

export function subscribe(fn: (s: RecSession | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
