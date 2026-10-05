import { useColorScheme } from 'react-native';

import type { DayType } from '@/logic';

export interface Palette {
  bg: string;
  card: string;
  ink: string;
  mute: string;
  line: string;
  accent: string;
  accentbg: string;
  ok: string;
  okbg: string;
  bad: string;
  badbg: string;
  warn: string;
  warnbg: string;
  types: Record<DayType, string>;
}

const light: Palette = {
  bg: '#faf8f4', card: '#ffffff', ink: '#1d1d1b', mute: '#6b6a65', line: '#e7e3da',
  accent: '#0f6e56', accentbg: '#e1f5ee',
  ok: '#1a8a3c', okbg: '#dff3e4', bad: '#c73030', badbg: '#fbe1e1', warn: '#b7791f', warnbg: '#fbefd2',
  types: { push: '#d85a30', pull: '#378add', legs: '#7f77dd', tempo: '#b06a10', easy: '#4f7f1a', long: '#0f6e56', rest: '#8d8b83' },
};

const dark: Palette = {
  bg: '#151513', card: '#1f1e1c', ink: '#f1efe8', mute: '#a3a198', line: '#34322e',
  accent: '#5dcaa5', accentbg: '#12342a',
  ok: '#52c27a', okbg: '#143222', bad: '#ef6a6a', badbg: '#3a1b1b', warn: '#e0a640', warnbg: '#3a2d12',
  types: { push: '#e8764f', pull: '#5aa0ea', legs: '#9a93ea', tempo: '#d28a2c', easy: '#7fae3a', long: '#3fb08c', rest: '#6f6d66' },
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
