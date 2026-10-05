import type { DayType } from './config';

export interface LiftEntry {
  w: number;
  done: boolean;
}

/** One day's log. Only submitted logs are persisted. */
export interface DayLog {
  submitted?: boolean;
  /** Workout skipped on purpose. Calories and notes can still be logged. */
  skipped?: boolean;
  /** Rest day only: the workout done instead of resting. */
  swap?: DayType;
  /** Rest day only: the skipped day whose workout was moved here. */
  makeupFor?: string;
  lifts?: Record<string, LiftEntry>;
  miles?: number;
  secs?: number;
  cin?: number;
  cout?: number;
  note?: string;
}

export interface TrackerState {
  start: string;
  goal: number | null;
  base: Record<string, number>;
  logs: Record<string, DayLog>;
}
