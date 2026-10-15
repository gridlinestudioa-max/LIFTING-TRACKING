// The activity feed: every finished run, ride, swim and lifting workout, newest first, with what made it
// stand out (personal records). Pure logic, no React.

import { CARDIO_LABEL, distText, type CardioSession } from './cardio';
import { addDays } from './dates';
import { fmt, fmtInt } from './format';
import { volume, type Workout } from './lifting';
import { recordsSetBy } from './records';
import { e1rm, setsDone } from './stats';
import { fmtTime, paceText } from './time';
import type { TrackerState } from './types';

export interface FeedStat {
  label: string;
  value: string;
}

export type FeedItem =
  | { kind: 'cardio'; id: string; date: string; title: string; stats: FeedStat[]; prs: string[]; note: string | null; session: CardioSession }
  | { kind: 'lift'; id: string; date: string; title: string; stats: FeedStat[]; prs: string[]; note: string | null; workout: Workout };

export type FeedFilter = 'all' | 'cardio' | 'lift';

const onFoot = (t: CardioSession['type']) => t === 'run' || t === 'walk' || t === 'hike';

function cardioItem(state: TrackerState, x: CardioSession, today: string): FeedItem {
  const stats: FeedStat[] = [];
  if (x.miles) stats.push({ label: 'Distance', value: distText(x.type, x.miles) });
  if (onFoot(x.type) && x.miles && x.secs) stats.push({ label: 'Pace', value: paceText(x.miles, x.secs) });
  if (x.type === 'bike' && x.miles && x.secs) stats.push({ label: 'Speed', value: `${fmt(Math.round((x.miles / (x.secs / 3600)) * 10) / 10)} mph` });
  if (x.secs) stats.push({ label: 'Time', value: fmtTime(x.secs) });
  if (x.elevFt) stats.push({ label: 'Climb', value: `${fmtInt(x.elevFt)} ft` });
  if (x.hr) stats.push({ label: 'Avg HR', value: `${x.hr} bpm` });
  return {
    kind: 'cardio',
    id: x.id,
    date: x.date,
    title: CARDIO_LABEL[x.type],
    stats: stats.slice(0, 4),
    prs: recordsSetBy(state.cardio, x, today),
    note: x.note?.trim() || null,
    session: x,
  };
}

/** For each finished workout, the lifts where it beat every earlier workout's best (estimated max). */
function liftPRs(workouts: Workout[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const top = new Map<string, number>();
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date) || (a.end ?? 0) - (b.end ?? 0))) {
    for (const ex of w.exercises) {
      let best = 0;
      for (const s of ex.sets) if (s.done && s.w && s.reps && s.reps <= 12) best = Math.max(best, e1rm(s.w, s.reps));
      if (!best) continue;
      const before = top.get(ex.exId);
      if (before != null && best > before) out.set(w.id, [...(out.get(w.id) ?? []), ex.name]);
      if (before == null || best > before) top.set(ex.exId, best);
    }
  }
  return out;
}

function liftItem(w: Workout, prs: string[]): FeedItem {
  const stats: FeedStat[] = [{ label: 'Exercises', value: String(w.exercises.filter((e) => e.sets.some((s) => s.done)).length) }, { label: 'Sets', value: String(setsDone(w)) }];
  const v = volume(w);
  if (v) stats.push({ label: 'Volume', value: `${fmtInt(Math.round(v))} lb` });
  if (w.start && w.end && w.end > w.start) {
    const m = Math.round((w.end - w.start) / 60000);
    stats.push({ label: 'Time', value: m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` });
  }
  return { kind: 'lift', id: w.id, date: w.date, title: w.name || 'Workout', stats, prs, note: w.note?.trim() || null, workout: w };
}

/** Everything finished up to today, newest first. */
export function feedItems(state: TrackerState, today: string, filter: FeedFilter = 'all'): FeedItem[] {
  const on = state.settings.sections;
  const items: { item: FeedItem; order: number }[] = [];
  if (on.cardio && filter !== 'lift') state.cardio.sessions.forEach((x, i) => x.date <= today && items.push({ item: cardioItem(state, x, today), order: i }));
  if (on.lifting && filter !== 'cardio') {
    const done = state.lifting.workouts.filter((w) => w.done && w.date <= today);
    const prs = liftPRs(done);
    done.forEach((w, i) => items.push({ item: liftItem(w, prs.get(w.id) ?? []), order: w.end ?? i }));
  }
  // Newest day first; within a day, the one logged last first.
  return items.sort((a, b) => b.item.date.localeCompare(a.item.date) || b.order - a.order).map((x) => x.item);
}

/** "Today", "Yesterday", or the date. */
export function feedDay(s: string, today: string, label: (s: string) => string): string {
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return label(s);
}
