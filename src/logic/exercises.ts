// The built-in exercise library (src/logic/data/exercises.json, made by scripts/build-exercises.py from
// free-exercise-db, public domain). About 650 KB, so it's loaded the first time it's needed.

import type { Exercise } from './lifting';

type Row = [string, string, string, string[], string[], string, string, string[], string];

export interface ExerciseFile {
  v: number;
  imageBase: string;
  exercises: Row[];
}

export function parseExercises(file: ExerciseFile): Exercise[] {
  return file.exercises.map(([id, name, equipment, primary, secondary, mechanic, level, instructions, image]) => {
    const e: Exercise = { id: `x:${id}`, name, equipment, primary, secondary, instructions };
    if (mechanic) e.mechanic = mechanic;
    if (level) e.level = level;
    if (image) e.image = file.imageBase + image;
    return e;
  });
}

let cache: Promise<Exercise[]> | null = null;

export function loadExercises(): Promise<Exercise[]> {
  cache ??= import('./data/exercises.json').then((m) => parseExercises((m.default ?? m) as unknown as ExerciseFile));
  return cache;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Exercises where every query word starts a word of the name, equipment or a muscle. Your own exercises
 * first, then names starting with the query, then simpler (beginner) ones and shorter names.
 */
export function searchExercises(all: readonly Exercise[], query: string, group: string[] | null = null, limit = 60): Exercise[] {
  const qw = words(query);
  const q = norm(query.trim());
  const scored: { e: Exercise; score: number }[] = [];
  for (const e of all) {
    if (group && !e.primary.some((m) => group.includes(m))) continue;
    const hay = words(`${e.name} ${e.equipment} ${e.primary.join(' ')}`);
    if (!qw.every((w) => hay.some((t) => t.startsWith(w)))) continue;
    const name = norm(e.name);
    let score = 0;
    if (q && name.startsWith(q)) score += 200;
    if (q && words(e.name).some((t) => t === qw[0])) score += 40;
    if (e.custom) score += 300;
    if (e.level === 'beginner') score += 15;
    if (e.level === 'expert') score -= 15;
    score -= name.length * 0.5;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((s) => s.e);
}
