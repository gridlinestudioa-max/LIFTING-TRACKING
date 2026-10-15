// The activity feed: every finished run, ride, swim and lifting workout, newest first, with what made it
// stand out (1st, 2nd and 3rd place on your record lists). Pure logic, no React.

import { CARDIO_LABEL, distText, type CardioSession } from './cardio';
import { addDays } from './dates';
import { fmt, fmtInt } from './format';
import { volume, type Workout } from './lifting';
import { cardioMedals, liftMedals, type Medal } from './records';
import { setsDone } from './stats';
import { fmtTime, paceText } from './time';
import type { TrackerState } from './types';

export interface FeedStat {
  label: string;
  value: string;
}

export type FeedItem =
  | { kind: 'cardio'; id: string; date: string; title: string; stats: FeedStat[]; medals: Medal[]; note: string | null; session: CardioSession }
  | { kind: 'lift'; id: string; date: string; title: string; stats: FeedStat[]; medals: Medal[]; note: string | null; workout: Workout };

export type FeedFilter = 'all' | 'cardio' | 'lift';

const onFoot = (t: CardioSession['type']) => t === 'run' || t === 'walk' || t === 'hike';

function cardioItem(x: CardioSession, medals: Medal[]): FeedItem {
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
    medals,
    note: x.note?.trim() || null,
    session: x,
  };
}

function liftItem(w: Workout, medals: Medal[]): FeedItem {
  const stats: FeedStat[] = [{ label: 'Exercises', value: String(w.exercises.filter((e) => e.sets.some((s) => s.done)).length) }, { label: 'Sets', value: String(setsDone(w)) }];
  const v = volume(w);
  if (v) stats.push({ label: 'Volume', value: `${fmtInt(Math.round(v))} lb` });
  if (w.start && w.end && w.end > w.start) {
    const m = Math.round((w.end - w.start) / 60000);
    stats.push({ label: 'Time', value: m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` });
  }
  return { kind: 'lift', id: w.id, date: w.date, title: w.name || 'Workout', stats, medals, note: w.note?.trim() || null, workout: w };
}

/** Everything finished up to today, newest first. */
export function feedItems(state: TrackerState, today: string, filter: FeedFilter = 'all'): FeedItem[] {
  const on = state.settings.sections;
  const items: { item: FeedItem; order: number }[] = [];
  if (on.cardio && filter !== 'lift') {
    const medals = cardioMedals(state.cardio, today);
    state.cardio.sessions.forEach((x, i) => x.date <= today && items.push({ item: cardioItem(x, medals.get(x.id) ?? []), order: i }));
  }
  if (on.lifting && filter !== 'cardio') {
    const medals = liftMedals(state.lifting, today);
    state.lifting.workouts.forEach((w, i) => w.done && w.date <= today && items.push({ item: liftItem(w, medals.get(w.id) ?? []), order: w.end ?? i }));
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
