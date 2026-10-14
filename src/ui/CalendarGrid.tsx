import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DAY_NAMES,
  LIFTS,
  MONTHS,
  TYPES,
  cinFor,
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

import { StatusMark, type MarkKind } from './marks';
import { fonts, radius, space, tabular, useColors, type Palette } from './theme';

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
        <View style={s.mtitle}>
          <Text style={[s.month, { color: c.ink }]}>{MONTHS[month]}</Text>
          <Text style={{ fontSize: 16, color: c.mute }}>{year}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <NavButton label="‹" a11y="Previous month" onPress={onPrev} c={c} />
          <NavButton label="›" a11y="Next month" onPress={onNext} c={c} />
        </View>
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
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [s.nav, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
      <Text style={{ fontSize: 22, color: c.ink, lineHeight: 24 }}>{label}</Text>
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

  // Open workout days sit on a white tile; rest days and days outside the plan stay flat.
  let bg = p && st !== 'rest' ? c.card : 'transparent';
  let border = p ? c.line : 'transparent';
  if (st === 'done') { bg = c.okbg; border = c.okbg; }
  if (st === 'missed') { bg = c.badbg; border = c.badbg; }
  if (st === 'partial') { bg = c.warnbg; border = c.warnbg; }
  const moved = st === 'moved';
  const skipped = st === 'skipped' || moved;

  let meta: { text: string; ok: boolean } | null = null;
  let mark: { kind: MarkKind; color: string } | null = null;
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
    if (st === 'done') mark = { kind: 'done', color: c.ok };
    else if (st === 'missed') mark = { kind: 'missed', color: c.bad };
    else if (st === 'partial') mark = { kind: 'partial', color: c.warn };
  }
  const cin = cinFor(state, date);
  const hasK = l && cin != null && l.cout != null;
  const isRest = p ? TYPES[p.type].kind === 'rest' : false;

  return (
    <View style={s.cellWrap}>
      <Pressable
        onPress={() => onSelect(date)}
        accessibilityRole="button"
        accessibilityLabel={`${date}${p ? `, ${p.race ? 'Race' : TYPES[p.type].label}` : ''}${st && st !== 'open' && st !== 'rest' ? `, ${st}` : ''}`}
        style={[
          s.cell,
          { backgroundColor: bg, borderColor: border },
          !p && { minHeight: 44 },
          skipped && { borderStyle: 'dashed', borderColor: c.mute },
        ]}>
        {p ? <View style={[s.band, { backgroundColor: c.types[p.type] }, skipped && { opacity: 0.35 }]} /> : null}
        <View style={s.top}>
          <View style={[s.dnWrap, isToday && { backgroundColor: c.accent }]}>
            <Text style={[s.dn, { color: isToday ? c.onAccent : p ? c.ink : c.mute }]}>{Number(date.slice(8))}</Text>
          </View>
          {mark ? <StatusMark kind={mark.kind} color={mark.color} size={15} /> : null}
        </View>
        {p ? (
          <Text numberOfLines={1} ellipsizeMode="clip" style={[s.tag, { color: isRest ? c.mute : c.ink }, skipped && { opacity: 0.5 }]}>
            {p.race ? 'RACE' : TYPES[p.type].label}
          </Text>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} ellipsizeMode="clip" style={[s.meta, { color: meta.ok ? c.ok : c.mute, fontWeight: meta.ok ? '700' : '400' }]}>
            {meta.text}
          </Text>
        ) : null}
        {hasK ? <View style={[s.kbar, { backgroundColor: l!.cout! - cin! >= 0 ? c.ok : c.bad }]} /> : null}
        {selected ? <View pointerEvents="none" style={[s.ring, { borderColor: c.accent }]} /> : null}
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  mhead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  mtitle: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  month: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  nav: { borderWidth: 1, borderRadius: radius.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginHorizontal: -2 },
  dow: { flex: 1, fontSize: 12, textAlign: 'center', marginBottom: 2 },
  cellWrap: { flex: 1, paddingHorizontal: 2 },
  cell: { minHeight: 72, borderRadius: radius.md - 2, borderWidth: 1, paddingTop: 7, paddingHorizontal: 3, paddingBottom: 8, gap: 2, overflow: 'hidden' },
  // Top band = workout type. Bottom bar = calories (green deficit, red surplus).
  band: { position: 'absolute', top: 0, left: 6, right: 6, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  kbar: { position: 'absolute', bottom: 0, left: 6, right: 6, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 1 },
  dnWrap: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dn: { fontFamily: fonts.semi, fontSize: 17, lineHeight: 20 },
  tag: { fontSize: 10, fontWeight: '700', paddingLeft: 2, letterSpacing: -0.15 },
  meta: { fontSize: 10, paddingLeft: 2, letterSpacing: -0.2, ...tabular },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderRadius: radius.md - 2 },
});
