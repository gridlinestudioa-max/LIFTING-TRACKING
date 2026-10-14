#!/usr/bin/env python3
"""
Build the bundled exercise list (src/logic/data/exercises.json) from free-exercise-db.

Source: https://github.com/yuhonas/free-exercise-db (dist/exercises.json), released into the public domain
(The Unlicense). Stretching and cardio entries are left out; this list is for lifting.

Usage:
  curl -o exercises.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
  python3 scripts/build-exercises.py exercises.json [out.json]

Output: {"v": 1, "imageBase": <url>, "fields": [...], "exercises": [record, ...]} where each record is:
  [id, name, equipment, primaryMuscles, secondaryMuscles, mechanic, level, instructions, image]
"""
import json
import sys

KEEP = {'strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics'}
IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'


def main(src, out):
    data = json.load(open(src))
    rows = []
    for x in data:
        if x.get('category') not in KEEP:
            continue
        rows.append([
            x['id'],
            x['name'].strip(),
            x.get('equipment') or 'other',
            x.get('primaryMuscles') or [],
            x.get('secondaryMuscles') or [],
            x.get('mechanic') or '',
            x.get('level') or '',
            [s.strip() for s in x.get('instructions') or [] if s.strip()],
            (x.get('images') or [''])[0],
        ])
    rows.sort(key=lambda r: r[1].lower())
    doc = {
        'v': 1,
        'source': 'free-exercise-db (github.com/yuhonas/free-exercise-db), public domain (The Unlicense).',
        'imageBase': IMAGE_BASE,
        'fields': ['id', 'name', 'equipment', 'primary', 'secondary', 'mechanic', 'level', 'instructions', 'image'],
        'exercises': rows,
    }
    with open(out, 'w') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} exercises -> {out}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'src/logic/data/exercises.json')
