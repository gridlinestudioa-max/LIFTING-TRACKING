import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  STORAGE_KEY_V1,
  defaultState,
  normalize,
  storageKey,
  syncAction,
  todayString,
  type DayInfo,
  type DietSettings,
  type Food,
  type FoodEntry,
  type Profile,
  type Settings,
  type TrackerState,
} from '@/logic';

import type { RemoteStore } from './cloud';

/** Where the data is saved right now. */
export type SyncStatus = 'device' | 'syncing' | 'synced' | 'offline';

interface Tracker {
  loaded: boolean;
  state: TrackerState;
  today: string;
  sync: SyncStatus;
  /** Change anything. Saves on the device and, when signed in, to the account. */
  update: (fn: (s: TrackerState) => TrackerState) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setDay: (s: string, patch: Partial<DayInfo>) => void;
  setGoal: (v: number | null) => void;
  /** Add or replace (same id) a food log entry. */
  saveEntry: (s: string, e: FoodEntry) => void;
  removeEntry: (s: string, id: string) => void;
  /** Add or replace (same id) a saved food: one the user created, or an Open Food Facts product. */
  saveFood: (f: Food) => void;
  deleteFood: (id: string) => void;
  setDiet: (d: DietSettings) => void;
  /** Save body stats. Suggested targets become the standard unless you already set your own numbers. */
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<Tracker | null>(null);

/** The first version kept everything under one key; after it's brought forward it's kept as a backup. */
const V1_BACKUP = 'mm_tracker_v1_backup';

async function loadLocal(user: string): Promise<TrackerState> {
  const raw = await AsyncStorage.getItem(storageKey(user));
  if (raw) return normalize(JSON.parse(raw));
  // First run with this account (or without one) on this device: bring forward the old data, once.
  const old = await AsyncStorage.getItem(STORAGE_KEY_V1);
  if (old) {
    const st = normalize(JSON.parse(old));
    await AsyncStorage.setItem(storageKey(user), JSON.stringify(st));
    await AsyncStorage.setItem(V1_BACKUP, old);
    await AsyncStorage.removeItem(STORAGE_KEY_V1);
    return st;
  }
  // Signing in for the first time on a device that was used without an account: start from that data.
  // (If the account already has newer data, syncing replaces this.)
  if (user !== 'local') {
    const local = await AsyncStorage.getItem(storageKey('local'));
    if (local) return normalize(JSON.parse(local));
  }
  return defaultState();
}

/**
 * One person's data. `user` picks the copy on this device ("local" without an account);
 * `remote`, when signed in, keeps it in sync with the account (the newer copy wins).
 */
export function TrackerProvider({ user, remote, children }: { user: string; remote: RemoteStore | null; children: ReactNode }) {
  const [state, setState] = useState<TrackerState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(todayString);
  const [sync, setSync] = useState<SyncStatus>(remote ? 'syncing' : 'device');
  const dirty = useRef(false);
  // The newest state, for sync callbacks that run later.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(async () => {
    if (!remote) return;
    setSync('syncing');
    try {
      await remote.save(latest.current);
      setSync('synced');
    } catch {
      setSync('offline');
    }
  }, [remote]);

  /** Compare with the account and take whichever copy is newer. */
  const reconcile = useCallback(async () => {
    if (!remote) return;
    setSync('syncing');
    try {
      const r = await remote.load();
      const local = latest.current;
      const action = syncAction(local.updatedAt, r, local.updatedAt > 0);
      if (action === 'pull' && r) {
        const st = normalize(r.data);
        setState(st);
        await AsyncStorage.setItem(storageKey(user), JSON.stringify(st)).catch(() => {});
        setSync('synced');
      } else if (action === 'push') {
        await push();
      } else setSync('synced');
    } catch {
      setSync('offline');
    }
  }, [remote, user, push]);

  useEffect(() => {
    let live = true;
    loadLocal(user)
      .catch(() => defaultState())
      .then((st) => {
        if (!live) return;
        latest.current = st;
        setState(st);
        setLoaded(true);
        reconcile();
      });
    return () => {
      live = false;
    };
  }, [user, reconcile]);

  useEffect(() => {
    if (!loaded || !dirty.current) return;
    AsyncStorage.setItem(storageKey(user), JSON.stringify(state)).catch(() => {});
    if (remote) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(push, 1200);
    }
  }, [state, loaded, user, remote, push]);

  // Keep "today" current across midnight, and check the account when the app comes back.
  useEffect(() => {
    const tick = () => setToday(todayString());
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      tick();
      reconcile();
    });
    const id = setInterval(tick, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [reconcile]);

  const update = useCallback((fn: (s: TrackerState) => TrackerState) => {
    dirty.current = true;
    setState((s) => ({ ...fn(s), updatedAt: Math.max(Date.now(), s.updatedAt + 1) }));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } })), [update]);
  const setDay = useCallback(
    (s: string, patch: Partial<DayInfo>) =>
      update((st) => {
        const day: DayInfo = { ...st.days[s], ...patch };
        (Object.keys(day) as (keyof DayInfo)[]).forEach((k) => day[k] == null && delete day[k]);
        const { [s]: _, ...rest } = st.days;
        return { ...st, days: Object.keys(day).length ? { ...rest, [s]: day } : rest };
      }),
    [update],
  );
  const setGoal = useCallback((v: number | null) => update((st) => ({ ...st, goal: v })), [update]);
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
      update((st) => ({ ...st, foods: st.foods.some((x) => x.id === f.id) ? st.foods.map((x) => (x.id === f.id ? f : x)) : [...st.foods, f] })),
    [update],
  );
  const deleteFood = useCallback((id: string) => update((st) => ({ ...st, foods: st.foods.filter((x) => x.id !== id) })), [update]);
  const setDiet = useCallback((d: DietSettings) => update((st) => ({ ...st, diet: d })), [update]);
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
      loaded, state, today, sync, update, setSettings, setDay, setGoal,
      saveEntry, removeEntry, saveFood, deleteFood, setDiet, setProfile,
    }),
    [loaded, state, today, sync, update, setSettings, setDay, setGoal, saveEntry, removeEntry, saveFood, deleteFood, setDiet, setProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): Tracker {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker must be used inside TrackerProvider');
  return v;
}
