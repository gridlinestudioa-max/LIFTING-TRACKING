// The Home tab: a snapshot of the day built from cards the user picks and orders. Pure logic, no React.

import type { Sections } from './types';

export type WidgetId =
  | 'workout' | 'calories' | 'remaining' | 'protein' | 'macros' | 'fasting' | 'week' | 'plan' | 'tally' | 'streak' | 'last'
  | 'weight' | 'water' | 'sleep' | 'steps';

export const WIDGETS: { id: WidgetId; label: string; needs?: keyof Sections }[] = [
  { id: 'workout', label: 'Today’s workout' },
  { id: 'calories', label: 'Calories in vs out', needs: 'food' },
  { id: 'remaining', label: 'Calories left today', needs: 'food' },
  { id: 'protein', label: 'Protein target', needs: 'food' },
  { id: 'macros', label: 'Macros today', needs: 'food' },
  { id: 'fasting', label: 'Fasting window', needs: 'food' },
  { id: 'tally', label: 'Tally', needs: 'food' },
  { id: 'week', label: 'This week’s training' },
  { id: 'plan', label: 'Cardio plan progress', needs: 'cardio' },
  { id: 'last', label: 'Last cardio activity', needs: 'cardio' },
  { id: 'streak', label: 'Lifting streak', needs: 'lifting' },
  { id: 'weight', label: 'Weight' },
  { id: 'water', label: 'Water' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'steps', label: 'Steps' },
];

export const DEFAULT_HOME: WidgetId[] = ['workout', 'calories', 'protein', 'week'];

const IDS = new Set(WIDGETS.map((w) => w.id));

export function normalizeHome(v: unknown): WidgetId[] {
  if (!Array.isArray(v)) return [...DEFAULT_HOME];
  return [...new Set(v.filter((x): x is WidgetId => typeof x === 'string' && IDS.has(x as WidgetId)))];
}

/** The cards to show: chosen ones whose tab is turned on. */
export function visibleWidgets(home: WidgetId[], on: Sections): WidgetId[] {
  return home.filter((id) => {
    const w = WIDGETS.find((x) => x.id === id);
    return w && (!w.needs || on[w.needs]);
  });
}

/** Move a card up (-1) or down (+1). */
export function moveWidget(home: WidgetId[], id: WidgetId, d: -1 | 1): WidgetId[] {
  const i = home.indexOf(id);
  const j = i + d;
  if (i < 0 || j < 0 || j >= home.length) return home;
  const out = [...home];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
