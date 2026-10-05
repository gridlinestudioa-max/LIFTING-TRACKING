export interface LiftEntry {
  w: number;
  done: boolean;
}

/** One day's log. Only submitted logs are persisted. */
export interface DayLog {
  submitted?: boolean;
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
