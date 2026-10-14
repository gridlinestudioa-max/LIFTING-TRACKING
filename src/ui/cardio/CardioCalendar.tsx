import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  DAY_NAMES,
  KIND_SHORT,
  MONTHS,
  dayStatus,
  daysInMonth,
  distText,
  monthOffset,
  pad,
  plannedOn,
  type CardioData,
} from '@/logic';

import { StatusMark, type MarkKind } from '../marks';
import { kindColor } from './kinds';
import { fonts, radius, space, tabular, useColors, type Palette } from '../theme';

interface Props {
  cardio: CardioData;
  today: string;
  selected: string;
  year: number;
  month: number;
  onSelect: (s: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CardioCalendar({ cardio, today, selected, year, month, onSelect, onPrev, onNext }: Props) {
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
              <DayCell key={d} s={d} cardio={cardio} today={today} selected={d === selected} onSelect={onSelect} />
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
  cardio,
  today,
  selected,
  onSelect,
}: {
  s: string;
  cardio: CardioData;
  today: string;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  const c = useColors();
  const planned = plannedOn(cardio.plan, date);
  const run = planned[0] ?? null;
  const st = dayStatus(cardio, date, today);
  const isToday = date === today;
  const logged = cardio.sessions.filter((x) => x.date === date);
  const miles = logged.reduce((t, x) => t + (x.miles ?? 0), 0);
  // Swims alone show meters; anything else shows miles.
  const loggedText = miles > 0 ? distText(logged.every((x) => x.type === 'swim') ? 'swim' : 'run', miles).replace(/\.(\d)\d+ mi/, '.$1 mi') : null;

  // Planned workouts sit on a white tile; other days stay flat unless something was logged.
  let bg = run || logged.length ? c.card : 'transparent';
  let border = run || logged.length ? c.line : 'transparent';
  if (st === 'done') { bg = c.okbg; border = c.okbg; }
  if (st === 'missed') { bg = c.badbg; border = c.badbg; }
  if (st === 'partial') { bg = c.warnbg; border = c.warnbg; }
  const faded = st === 'skipped' || st === 'moved';

  let mark: { kind: MarkKind; color: string } | null = null;
  if (st === 'done' || (!run && logged.length)) mark = { kind: 'done', color: c.ok };
  else if (st === 'missed') mark = { kind: 'missed', color: c.bad };
  else if (st === 'partial') mark = { kind: 'partial', color: c.warn };

  const tag = run
    ? run.race
      ? 'RACE'
      : planned.length > 1
        ? planned.some((x) => x.kind === 'brick') ? 'Brick' : `${planned.length} workouts`
        : KIND_SHORT[run.kind]
    : logged.length
      ? CARDIO_LABEL[logged[0].type]
      : null;
  const meta = loggedText ?? (run && planned.length === 1 ? distText(run.sport, run.miles) : logged.length ? `${logged.length}×` : null);

  return (
    <View style={s.cellWrap}>
      <Pressable
        onPress={() => onSelect(date)}
        accessibilityRole="button"
        accessibilityLabel={`${date}${tag ? `, ${tag}` : ''}${st && st !== 'open' ? `, ${st}` : ''}`}
        style={[s.cell, { backgroundColor: bg, borderColor: border }, faded && { borderStyle: 'dashed', borderColor: c.mute }]}>
        {run ? <View style={[s.band, { backgroundColor: kindColor(c, run.kind) }, faded && { opacity: 0.35 }]} /> : null}
        <View style={s.top}>
          <View style={[s.dnWrap, isToday && { backgroundColor: c.accent }]}>
            <Text style={[s.dn, { color: isToday ? c.onAccent : c.ink }]}>{Number(date.slice(8))}</Text>
          </View>
          {mark ? <StatusMark kind={mark.kind} color={mark.color} size={15} /> : null}
        </View>
        {tag ? (
          <Text numberOfLines={1} ellipsizeMode="clip" style={[s.tag, { color: c.ink }, faded && { opacity: 0.5 }]}>
            {st === 'moved' ? 'Moved' : st === 'skipped' ? 'Skipped' : tag}
          </Text>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} ellipsizeMode="clip" style={[s.meta, { color: loggedText ? c.ok : c.mute, fontWeight: loggedText ? '700' : '400' }]}>
            {meta}
          </Text>
        ) : null}
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
  cell: { minHeight: 64, borderRadius: radius.md - 2, borderWidth: 1, paddingTop: 7, paddingHorizontal: 3, paddingBottom: 8, gap: 2, overflow: 'hidden' },
  // Top band = planned workout kind.
  band: { position: 'absolute', top: 0, left: 6, right: 6, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 1 },
  dnWrap: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dn: { fontFamily: fonts.semi, fontSize: 17, lineHeight: 20 },
  tag: { fontSize: 10, fontWeight: '700', paddingLeft: 2, letterSpacing: -0.15 },
  meta: { fontSize: 10, paddingLeft: 2, letterSpacing: -0.2, ...tabular },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderRadius: radius.md - 2 },
});
