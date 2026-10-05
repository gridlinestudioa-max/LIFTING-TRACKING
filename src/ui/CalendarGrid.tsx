import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DAY_NAMES,
  LIFTS,
  MONTHS,
  TYPES,
  daysInMonth,
  fmt,
  liftsDone,
  monthOffset,
  pad,
  effectivePlan,
  status,
  type LiftGroup,
  type TrackerState,
} from '@/logic';

import { useColors, type Palette } from './theme';

interface Props {
  state: TrackerState;
  today: string;
  selected: string;
  year: number;
  month: number;
  onSelect: (s: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarGrid({ state, today, selected, year, month, onSelect, onPrev, onNext }: Props) {
  const c = useColors();
  const offset = monthOffset(year, month);
  const dim = daysInMonth(year, month);
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={s.mhead}>
        <NavButton label="‹" a11y="Previous month" onPress={onPrev} c={c} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink }}>
          {MONTHS[month]} {year}
        </Text>
        <NavButton label="›" a11y="Next month" onPress={onNext} c={c} />
      </View>
      <View style={s.row}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={[s.dow, { color: c.mute }]}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.row, { marginTop: 4 }]}>
          {r.map((d, j) =>
            d ? (
              <DayCell key={d} s={d} state={state} today={today} selected={d === selected} onSelect={onSelect} />
            ) : (
              <View key={`b${j}`} style={s.cellWrap} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function NavButton({ label, a11y, onPress, c }: { label: string; a11y: string; onPress: () => void; c: Palette }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={a11y}
      hitSlop={8}
      style={({ pressed }) => [s.nav, { borderColor: c.line, backgroundColor: c.bg, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ fontSize: 20, color: c.ink, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

const DayCell = memo(function DayCell({
  s: date,
  state,
  today,
  selected,
  onSelect,
}: {
  s: string;
  state: TrackerState;
  today: string;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  const c = useColors();
  const p = effectivePlan(state, date);
  const l = state.logs[date];
  const st = status(state, date, today);
  const isToday = date === today;

  let bg = c.bg, border = c.line;
  if (st === 'done') { bg = c.okbg; border = c.ok; }
  if (st === 'missed') { bg = c.badbg; border = c.bad; }
  if (st === 'partial') { bg = c.warnbg; border = c.warn; }
  const moved = st === 'moved';
  const skipped = st === 'skipped' || moved;

  let meta: { text: string; ok: boolean } | null = null;
  let mark: { ch: string; color: string } | null = null;
  if (p) {
    const kind = TYPES[p.type].kind;
    if (skipped) {
      meta = { text: moved ? 'Moved' : 'Skipped', ok: false };
    } else if (kind === 'run') {
      meta = l && l.miles! > 0 ? { text: `${fmt(l.miles!)} mi`, ok: true } : { text: `${fmt(p.miles)} mi`, ok: false };
    } else if (kind === 'lift') {
      const n = liftsDone(p.type as LiftGroup, l);
      if (n > 0) meta = { text: `${n}/${LIFTS[p.type as LiftGroup].length}`, ok: true };
    }
    if (st === 'done') mark = { ch: '✓', color: c.ok };
    else if (st === 'missed') mark = { ch: '✕', color: c.bad };
    else if (st === 'partial') mark = { ch: '◐', color: c.warn };
  }
  const hasK = l && l.cin != null && l.cout != null;

  return (
    <View style={s.cellWrap}>
      <Pressable
        onPress={() => onSelect(date)}
        accessibilityRole="button"
        accessibilityLabel={`${date}${p ? `, ${p.race ? 'Race' : TYPES[p.type].label}` : ''}${st && st !== 'open' && st !== 'rest' ? `, ${st}` : ''}`}
        style={[
          s.cell,
          { backgroundColor: bg, borderColor: selected ? c.accent : border, borderWidth: selected ? 2 : 1 },
          skipped && !selected && { borderStyle: 'dashed', borderColor: c.mute },
        ]}>
        {mark ? <Text style={[s.mark, { color: mark.color }]}>{mark.ch}</Text> : null}
        <Text style={[s.dn, { color: isToday ? c.accent : c.mute, fontWeight: isToday ? '800' : '400' }]}>
          {Number(date.slice(8))}
        </Text>
        {p ? (
          <Text numberOfLines={1} style={[s.tag, { backgroundColor: c.types[p.type] }, skipped && { opacity: 0.45 }]}>
            {p.race ? 'RACE' : TYPES[p.type].label}
          </Text>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} style={[s.meta, { color: meta.ok ? c.ok : c.mute, fontWeight: meta.ok ? '700' : '400' }]}>
            {meta.text}
          </Text>
        ) : null}
        {hasK ? <View style={[s.kdot, { backgroundColor: l!.cout! - l!.cin! >= 0 ? c.ok : c.bad }]} /> : null}
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  mhead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nav: { borderWidth: 1, borderRadius: 8, width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginHorizontal: -2 },
  dow: { flex: 1, fontSize: 11, textAlign: 'center' },
  cellWrap: { flex: 1, paddingHorizontal: 2 },
  cell: { minHeight: 66, borderRadius: 8, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 3, gap: 3, overflow: 'hidden' },
  dn: { fontSize: 11, paddingLeft: 2 },
  mark: { position: 'absolute', top: 2, right: 4, fontSize: 13, fontWeight: '800', lineHeight: 15 },
  tag: {
    fontSize: 10, fontWeight: '700', color: '#fff', borderRadius: 4, overflow: 'hidden',
    paddingHorizontal: 1, paddingVertical: 1, textAlign: 'center', letterSpacing: -0.2,
  },
  meta: { fontSize: 10, textAlign: 'center' },
  kdot: { position: 'absolute', bottom: 4, right: 4, width: 7, height: 7, borderRadius: 3.5 },
});
