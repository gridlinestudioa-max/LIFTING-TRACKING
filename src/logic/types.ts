import type { CardioData } from './cardio';
import type { DietSettings } from './diet';
import type { WidgetId } from './home';
import type { LiftingData } from './lifting';
import type { Food, FoodEntry } from './nutrition';
import type { Profile } from './profile';

/** Which parts of the app someone uses. Each one is a tab. */
export interface Sections {
  food: boolean;
  cardio: boolean;
  lifting: boolean;
}

export interface Settings {
  name: string;
  sections: Sections;
  /** Finished first-time setup. */
  onboarded: boolean;
  /** Cards on the Home tab, in order. */
  home: WidgetId[];
}

/**
 * What's logged for a day outside the food log: calories typed in, calories burned, a note, and the
 * body log (weight, water, sleep, steps), entered by hand. See body.ts.
 */
export interface DayInfo {
  cin?: number;
  cout?: number;
  note?: string;
  /** Body weight, pounds. */
  weightLb?: number;
  /** Water, fluid ounces. */
  waterOz?: number;
  /** Time asleep, minutes. */
  sleepMins?: number;
  steps?: number;
}

/** Everything one person tracks. Saved on the device and, when signed in, synced to their account. */
export interface TrackerState {
  v: 2;
  /** Last change, ms since 1970. Sync keeps whichever copy is newer. */
  updatedAt: number;
  settings: Settings;
  /** Optional daily deficit goal (kcal). */
  goal: number | null;
  days: Record<string, DayInfo>;
  /**
   * Foods saved on the device: ones the user created (`custom`), and Open Food Facts products that were
   * logged (so they work offline and show in recents). The built-in USDA list is not stored.
   */
  foods: Food[];
  /** Food log by date. */
  meals: Record<string, FoodEntry[]>;
  diet: DietSettings;
  /** Body stats for suggested targets, or null until entered. */
  profile: Profile | null;
  cardio: CardioData;
  lifting: LiftingData;
}
