import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  STORAGE_KEY,
  defaultState,
  foodKcal,
  logFromForm,
  normalize,
  planFor,
  snapStart,
  submitError,
  todayString,
  type DayForm,
  type DietSettings,
  type Profile,
  type Food,
  type FoodEntry,
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
  /** Add or replace (same id) a food log entry. Saved right away. */
  saveEntry: (s: string, e: FoodEntry) => void;
  removeEntry: (s: string, id: string) => void;
  /** Add or replace (same id) a saved food: one the user created, or an Open Food Facts product. */
  saveFood: (f: Food) => void;
  deleteFood: (id: string) => void;
  setDiet: (d: DietSettings) => void;
  setFoodLog: (on: boolean) => void;
  /** Save body stats. Suggested targets become the standard unless you already set your own numbers. */
  setProfile: (p: Profile) => void;
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
      const err = submitError(p, log, foodKcal(state, s) != null);
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

  const saveEntry = useCallback(
    (s: string, e: FoodEntry) =>
      update((st) => {
        const list = st.meals[s] ?? [];
        const next = list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e];
        return { ...st, meals: { ...st.meals, [s]: next } };
      }),
    [update],
  );
  const removeEntry = useCallback(
    (s: string, id: string) =>
      update((st) => {
        const next = (st.meals[s] ?? []).filter((x) => x.id !== id);
        const { [s]: _, ...rest } = st.meals;
        return { ...st, meals: next.length ? { ...rest, [s]: next } : rest };
      }),
    [update],
  );
  const saveFood = useCallback(
    (f: Food) =>
      update((st) => {
        const food = f;
        const foods = st.foods.some((x) => x.id === f.id) ? st.foods.map((x) => (x.id === f.id ? food : x)) : [...st.foods, food];
        return { ...st, foods };
      }),
    [update],
  );
  const deleteFood = useCallback((id: string) => update((st) => ({ ...st, foods: st.foods.filter((x) => x.id !== id) })), [update]);
  const setDiet = useCallback((d: DietSettings) => update((st) => ({ ...st, diet: d })), [update]);
  const setFoodLog = useCallback((on: boolean) => update((st) => ({ ...st, foodLog: on })), [update]);
  const setProfile = useCallback(
    (p: Profile) =>
      update((st) => {
        // No numbers of your own yet: start from the suggestions.
        const own = Object.values(st.diet.limits).some((v) => v != null) && !st.diet.auto;
        return { ...st, profile: p, diet: own ? st.diet : { ...st.diet, auto: true } };
      }),
    [update],
  );

  const value = useMemo(
    () => ({
      loaded, state, today, selected, select, drafts, setDraft, flash, submit, setBase, setGoal, setStart,
      saveEntry, removeEntry, saveFood, deleteFood, setDiet, setFoodLog, setProfile,
    }),
    [
      loaded, state, today, selected, select, drafts, setDraft, flash, submit, setBase, setGoal, setStart,
      saveEntry, removeEntry, saveFood, deleteFood, setDiet, setFoodLog, setProfile,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): Tracker {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker must be used inside TrackerProvider');
  return v;
}
