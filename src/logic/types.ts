import type { DayType } from './config';
import type { DietSettings } from './diet';
import type { Food, FoodEntry } from './nutrition';

export interface LiftEntry {
  w: number;
  done: boolean;
}

/** One day's log. Only submitted logs are persisted. */
export interface DayLog {
  submitted?: boolean;
  /** Workout skipped on purpose. Calories and notes can still be logged. */
  skipped?: boolean;
  /** The workout done instead of the scheduled one (or instead of resting). */
  swap?: DayType;
  /** The other day whose workout was moved here. */
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
  /**
   * Foods saved on the device: ones the user created (`custom`), and Open Food Facts products that were
   * logged (so they work offline and show in recents). The built-in USDA list is not stored.
   */
  foods: Food[];
  /** Food log by date. Saved as soon as it changes (no Submit step). */
  meals: Record<string, FoodEntry[]>;
  diet: DietSettings;
  /**
   * Food log on: food logged on the Food tab counts as calories in, on top of any number typed on the day.
   * Off: the Food tab is hidden and calories in is only the typed number. Logged food is kept either way.
   */
  foodLog: boolean;
}
