import type { WorkoutKind } from '@/logic';

import type { Kind, Palette } from '../theme';

/** Color for a planned workout: easy, hard (tempo or intervals), or long (long, brick, race). */
export function kindColor(c: Palette, kind: WorkoutKind): string {
  const k: Kind = kind === 'easy' ? 'easy' : kind === 'tempo' || kind === 'intervals' ? 'tempo' : 'long';
  return c.types[k];
}
