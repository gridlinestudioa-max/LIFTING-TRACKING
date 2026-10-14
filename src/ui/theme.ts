import { useColorScheme } from 'react-native';

/** Colors for workout kinds: plan runs, lifting, other cardio, rest. */
export type Kind = 'push' | 'pull' | 'legs' | 'tempo' | 'easy' | 'long' | 'rest';

export interface Palette {
  /** Screen background (chalk). */
  bg: string;
  /** Raised surfaces: panels, inputs. */
  card: string;
  /** Inset surfaces: readouts, table headers. */
  soft: string;
  ink: string;
  mute: string;
  line: string;
  /** Primary action and selection. Deliberately neutral so color only ever means workout type or status. */
  accent: string;
  /** Text on top of `accent`. */
  onAccent: string;
  /** Soft highlight (current week, pressed rows). */
  accentbg: string;
  ok: string;
  okbg: string;
  bad: string;
  badbg: string;
  warn: string;
  warnbg: string;
  /** Text on top of a workout-type color. */
  onType: string;
  types: Record<Kind, string>;
}

const light: Palette = {
  bg: '#ebece8', card: '#ffffff', soft: '#e8eae6', ink: '#15181b', mute: '#5f656a', line: '#dcdfda',
  accent: '#15181b', onAccent: '#f2f3f0', accentbg: '#e2e5e0',
  ok: '#13733a', okbg: '#dff1e5', bad: '#bd2530', badbg: '#fae1e3', warn: '#8f5a08', warnbg: '#faedcb',
  onType: '#ffffff',
  types: { push: '#cc441c', pull: '#2f74c6', legs: '#6f65d4', tempo: '#a8610c', easy: '#4a7a14', long: '#0c6d58', rest: '#6f7478' },
};

const dark: Palette = {
  bg: '#0c0e10', card: '#181c1f', soft: '#21262a', ink: '#eceee9', mute: '#9aa1a6', line: '#2a3035',
  accent: '#eceee9', onAccent: '#0f1113', accentbg: '#262c30',
  ok: '#4fc77c', okbg: '#12301f', bad: '#f06a72', badbg: '#3a1a1d', warn: '#e2a63e', warnbg: '#38290f',
  onType: '#101214',
  types: { push: '#ee7a52', pull: '#5ea6f0', legs: '#9d95f2', tempo: '#d99137', easy: '#86b83c', long: '#3fb594', rest: '#7a8085' },
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** Map a logic tone to a color. */
export function toneColor(c: Palette, tone: 'ok' | 'bad' | 'warn' | 'mute'): string {
  return tone === 'ok' ? c.ok : tone === 'bad' ? c.bad : tone === 'warn' ? c.warn : c.mute;
}

/** Soft background that goes with a logic tone. */
export function toneBg(c: Palette, tone: 'ok' | 'bad' | 'warn' | 'mute'): string {
  return tone === 'ok' ? c.okbg : tone === 'bad' ? c.badbg : tone === 'warn' ? c.warnbg : c.soft;
}

/**
 * Typography. Barlow Condensed carries headings and numbers (race-bib / scoreboard feel);
 * the system font stays on body text and form fields. Fonts are loaded in `app/_layout.tsx`.
 */
export const fonts = {
  display: 'BarlowCondensed_700Bold',
  semi: 'BarlowCondensed_600SemiBold',
  medium: 'BarlowCondensed_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

/** Digits that line up in columns. */
export const tabular = { fontVariant: ['tabular-nums' as const] };
