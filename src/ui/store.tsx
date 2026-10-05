import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  STORAGE_KEY,
  defaultState,
  logFromForm,
  normalize,
  planFor,
  snapStart,
  submitError,
  todayString,
  type DayForm,
  type TrackerState,
} from '@/logic';

interface Tracker {
  loaded: boolean;
  state: TrackerState;
  today: string;
  selected: string;
  select: (s: string) => void;
  /** Unsubmitted edits per date. In memory only. */
  drafts: Record<string, DayForm>;
  setDraft: (s: string, f: DayForm) => void;
  /** Date just submitted (shows "Submitted ✓"). */
  flash: string | null;
  /** Returns an error message, or null on success. */
  submit: (s: string, f: DayForm) => string | null;
  setBase: (id: string, v: number) => void;
  setGoal: (v: number | null) => void;
  setStart: (s: string) => void;
}

const Ctx = createContext<Tracker | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackerState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(todayString);
  const [selected, setSelected] = useState(todayString);
  const [drafts, setDrafts] = useState<Record<string, DayForm>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState(normalize(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !dirty.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // Keep "today" current across midnight and when the app comes back to the foreground.
  useEffect(() => {
    const tick = () => setToday(todayString());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    const id = setInterval(tick, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  const update = useCallback((fn: (s: TrackerState) => TrackerState) => {
    dirty.current = true;
    setState(fn);
  }, []);

  const select = useCallback((s: string) => {
    setSelected(s);
    setFlash(null);
  }, []);

  const setDraft = useCallback((s: string, f: DayForm) => {
    setDrafts((d) => ({ ...d, [s]: f }));
    setFlash(null);
  }, []);

  const submit = useCallback(
    (s: string, f: DayForm) => {
      const p = planFor(state.start, s);
      if (!p) return null;
      const log = logFromForm(state, p, f);
      const err = submitError(p, log);
      if (err) return err;
      update((st) => ({ ...st, logs: { ...st.logs, [s]: { ...log, submitted: true } } }));
      setDrafts((d) => {
        const { [s]: _, ...rest } = d;
        return rest;
      });
      setFlash(s);
      return null;
    },
    [state, update],
  );

  const setBase = useCallback(
    (id: string, v: number) => update((st) => ({ ...st, base: { ...st.base, [id]: v } })),
    [update],
  );
  const setGoal = useCallback((v: number | null) => update((st) => ({ ...st, goal: v })), [update]);
  const setStart = useCallback((s: string) => update((st) => ({ ...st, start: snapStart(s) })), [update]);

  const value = useMemo(
    () => ({ loaded, state, today, selected, select, drafts, setDraft, flash, submit, setBase, setGoal, setStart }),
    [loaded, state, today, selected, select, drafts, setDraft, flash, submit, setBase, setGoal, setStart],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): Tracker {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker must be used inside TrackerProvider');
  return v;
}
