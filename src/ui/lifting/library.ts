import { useEffect, useMemo, useState } from 'react';

import { loadExercises, type Exercise } from '@/logic';

import { useTracker } from '../store';

/** Your exercises plus the built-in library (loaded the first time it's needed). */
export function useLibrary(): { all: Exercise[]; byId: (id: string) => Exercise | undefined; loading: boolean } {
  const { state } = useTracker();
  const [lib, setLib] = useState<Exercise[] | null>(null);
  useEffect(() => {
    let live = true;
    loadExercises()
      .then((x) => live && setLib(x))
      .catch(() => live && setLib([]));
    return () => {
      live = false;
    };
  }, []);
  const all = useMemo(() => [...state.lifting.exercises, ...(lib ?? [])], [state.lifting.exercises, lib]);
  const map = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  return { all, byId: (id: string) => map.get(id), loading: lib == null };
}
