import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  DAY_NAMES,
  KIND_LABEL,
  MEALS,
  MONTHS,
  SPORT_LABEL,
  dayDiff,
  dayLog,
  daysInMonth,
  distText,
  firstWorkout,
  fmt,
  fmtInt,
  fmtSleep,
  fmtTime,
  fmtWater,
  mealEntries,
  monthOffset,
  pad,
  paceText,
  sgn,
  shortDayLabel,
  sumTotals,
  toD,
  workoutLine,
  workoutStatus,
  type DayLog,
  type DayMark,
} from '@/logic';

import { RouteMap } from '../cardio/RouteMap';
import { LinkButton } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors, type Palette } from '../theme';

function markColor(c: Palette, m: DayMark | null): string {
  return m === 'done' ? c.ok : m === 'missed' ? c.bad : m === 'partial' ? c.warn : m === 'planned' ? c.mute : c.line;
}

/**
 * The whole plan on one calendar: each day shows its cardio and its lift (a green dot when done, red when
 * missed, grey when still to come) and the calorie deficit. Tap a day to open its full review underneath.
 */
export function HomeCalendar() {
  const c = useColors();
  const { state, today } = useTracker();
  const [view, setView] = useState(() => ({ y: toD(today).getFullYear(), m: toD(today).getMonth() }));
  const [open, setOpen] = useState<string | null>(today);
  const since = useMemo(() => firstWorkout(state), [state]);

  const cells = useMemo(() => {
    const out: (DayLog | null)[] = [];
    for (let i = 0; i < monthOffset(view.y, view.m); i++) out.push(null);
    for (let d = 1; d <= daysInMonth(view.y, view.m); d++) out.push(dayLog(state, `${view.y}-${pad(view.m + 1)}-${pad(d)}`, today, since));
    while (out.length % 7) out.push(null);
    return out;
  }, [state, view, today, since]);
  const rows: (DayLog | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const shift = (n: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const thisMonth = view.y === toD(today).getFullYear() && view.m === toD(today).getMonth();

  return (
    <View style={[st.card, { backgroundColor: c.card }]}>
      <View style={st.head}>
        <Text style={[st.month, { color: c.ink }]}>
          {MONTHS[view.m]} <Text style={{ fontFamily: fonts.semi, fontSize: 18, color: c.mute }}>{view.y}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {!thisMonth ? (
            <LinkButton
              label="Today"
              onPress={() => {
                setView({ y: toD(today).getFullYear(), m: toD(today).getMonth() });
                setOpen(today);
              }}
            />
          ) : null}
          <Nav label="‹" a11y="Previous month" onPress={() => shift(-1)} />
          <Nav label="›" a11y="Next month" onPress={() => shift(1)} />
        </View>
      </View>
      <View style={st.row}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={[st.dow, { color: c.mute }]}>
            {d.slice(0, 1)}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i}>
          <View style={st.row}>
            {r.map((d, j) => (d ? <Cell key={d.s} d={d} today={today} selected={open === d.s} onPress={() => setOpen(open === d.s ? null : d.s)} /> : <View key={`b${j}`} style={st.cell} />))}
          </View>
          {open && r.some((d) => d?.s === open) ? <DayReview d={r.find((d) => d?.s === open)!} onClose={() => setOpen(null)} /> : null}
        </View>
      ))}
      <View style={st.key}>
        <KeyDot color={c.ok} label="Done" />
        <KeyDot color={c.bad} label="Missed" />
        <KeyDot color={c.mute} label="Planned" />
        <Text style={{ color: c.mute, fontSize: 11.5 }}>± kcal deficit</Text>
      </View>
    </View>
  );
}

function Nav({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6} style={({ pressed }) => [st.nav, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
      <Text style={{ fontSize: 20, color: c.ink, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

function KeyDot({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={{ color: c.mute, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

function Line({ mark, label }: { mark: DayMark | null; label: string | null }) {
  const c = useColors();
  if (!label) return <View style={{ height: 13 }} />;
  return (
    <View style={st.line}>
      <View style={[st.dot, { backgroundColor: markColor(c, mark) }]} />
      <Text style={[st.lineText, { color: mark === 'skipped' ? c.mute : c.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const Cell = memo(function Cell({ d, today, selected, onPress }: { d: DayLog; today: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const day = toD(d.s).getDate();
  const isToday = d.s === today;
  const future = d.s > today;
  const a11y = [
    shortDayLabel(d.s),
    d.cardio?.label ? `${d.cardio.label}${d.cardio.mark ? `, ${d.cardio.mark}` : ''}` : null,
    d.lift?.label ? `${d.lift.label}${d.lift.mark ? `, ${d.lift.mark}` : ''}` : null,
    d.net != null ? `${d.net >= 0 ? 'deficit' : 'surplus'} ${fmtInt(Math.abs(d.net))} calories` : null,
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [st.cell, st.cellBox, { borderColor: selected ? c.ink : 'transparent', backgroundColor: selected ? c.soft : pressed ? c.soft : 'transparent' }]}>
      <View style={[st.num, isToday && { backgroundColor: c.ink }]}>
        <Text style={{ color: isToday ? c.onAccent : future ? c.mute : c.ink, fontSize: 13, fontWeight: '700', ...tabular }}>{day}</Text>
      </View>
      <Line mark={d.cardio?.mark ?? null} label={d.cardio?.label ?? null} />
      <Line mark={d.lift?.mark ?? null} label={d.lift?.label ?? null} />
      <Text style={[st.net, { color: d.net == null ? 'transparent' : d.net >= 0 ? c.ok : c.bad }]} numberOfLines={1}>
        {d.net == null ? '·' : sgn(Math.round(d.net))}
      </Text>
    </Pressable>
  );
});

function Block({ title, mark, children }: { title: string; mark?: DayMark | null; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[st.block, { borderTopColor: c.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {mark ? <View style={[st.dot, { width: 9, height: 9, borderRadius: 5, backgroundColor: markColor(c, mark) }]} /> : null}
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        {mark ? <Text style={{ color: markColor(c, mark), fontSize: 13, fontWeight: '700' }}>{MARK_TEXT[mark]}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const MARK_TEXT: Record<DayMark, string> = { done: 'Done', missed: 'Missed', partial: 'Part done', planned: 'Planned', skipped: 'Skipped' };

function Small({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20, ...tabular }}>{children}</Text>;
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: color ?? c.ink, fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular }}>{value}</Text>
      <Text style={{ color: c.mute, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/** A full look at one day: cardio, lifting, food, calories and the body log. */
function DayReview({ d, onClose }: { d: DayLog; onClose: () => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const diff = dayDiff(d.s, today);
  const when = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : diff < 0 ? `${-diff} days ago` : `In ${diff} days`;
  const goal = state.goal;
  const empty = !d.cardio?.label && !d.lift?.label && !d.food && d.net == null && !Object.keys(d.info).length;
  const route = d.cardio?.sessions.find((x) => x.route)?.route;

  return (
    <View style={[st.review, { backgroundColor: c.bg, borderColor: c.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={[st.reviewTitle, { color: c.ink }]}>{shortDayLabel(d.s)}</Text>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'baseline' }}>
          <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>{when}</Text>
          <LinkButton label="Close" onPress={onClose} />
        </View>
      </View>

      {empty ? <Text style={{ color: c.mute, fontSize: 14, marginTop: space.sm }}>{d.s > today ? 'Nothing planned.' : 'Nothing logged.'}</Text> : null}

      {d.cardio && (d.cardio.planned.length || d.cardio.sessions.length) ? (
        <Block title="Cardio" mark={d.cardio.mark}>
          {d.cardio.planned.map((wk) => (
            <Small key={wk.sport}>
              {`Plan: ${wk.race ? 'Race' : KIND_LABEL[wk.kind]} ${SPORT_LABEL[wk.sport].toLowerCase()} · ${distText(wk.sport, wk.miles)}${workoutStatus(state.cardio, wk, today) === 'moved' ? ' · done another day' : ''}`}
            </Small>
          ))}
          {d.cardio.sessions.map((x) => (
            <Small key={x.id}>
              {[CARDIO_LABEL[x.type], x.miles ? distText(x.type, x.miles) : null, x.secs ? fmtTime(x.secs) : null, x.miles && x.secs && x.type !== 'bike' && x.type !== 'swim' ? paceText(x.miles, x.secs) : null, x.hr ? `${x.hr} bpm` : null]
                .filter(Boolean)
                .join(' · ')}
            </Small>
          ))}
          {route ? <RouteMap route={route} height={130} style={{ marginTop: space.sm }} /> : null}
        </Block>
      ) : null}

      {d.lift && (d.lift.routine || d.lift.workout) ? (
        <Block title="Lifting" mark={d.lift.mark}>
          {d.lift.workout ? (
            <>
              <Small>{`${d.lift.workout.name} · ${workoutLine(d.lift.workout)}`}</Small>
              {d.lift.workout.exercises
                .filter((x) => x.sets.some((s) => s.done))
                .map((x, i) => {
                  const done = x.sets.filter((s) => s.done);
                  const top = done.reduce<number | null>((m, s) => (s.w != null && (m == null || s.w > m) ? s.w : m), null);
                  return (
                    <Text key={`${x.exId}${i}`} style={{ color: c.mute, fontSize: 13, ...tabular }}>
                      {`${x.name}: ${done.length} × ${done.map((s) => s.reps ?? 0).join('/')}${top != null ? ` @ ${fmt(top)} ${x.unit === 'plates' ? 'pl' : 'lb'}` : ''}`}
                    </Text>
                  );
                })}
            </>
          ) : (
            <Small>{`${d.lift.routine!.name} scheduled`}</Small>
          )}
        </Block>
      ) : null}

      {d.food ? (
        <Block title="Food">
          <View style={{ flexDirection: 'row' }}>
            <Stat value={fmtInt(d.food.totals.kcal)} label="kcal" />
            <Stat value={`${fmtInt(d.food.totals.protein)} g`} label="Protein" />
            <Stat value={`${fmtInt(d.food.totals.carbs)} g`} label="Carbs" />
            <Stat value={`${fmtInt(d.food.totals.fat)} g`} label="Fat" />
          </View>
          <Text style={{ color: c.mute, fontSize: 13, marginTop: 4 }}>
            {MEALS.map((m) => ({ m, k: sumTotals(mealEntries(d.food!.entries, m.id)).kcal }))
              .filter((x) => x.k > 0)
              .map((x) => `${x.m.label} ${fmtInt(x.k)}`)
              .join(' · ')}
          </Text>
        </Block>
      ) : null}

      {d.cin != null || d.cout != null ? (
        <Block title="Calories">
          <View style={{ flexDirection: 'row' }}>
            <Stat value={d.cin != null ? fmtInt(d.cin) : '–'} label="In" />
            <Stat value={d.cout != null ? fmtInt(d.cout) : '–'} label="Out" />
            <Stat value={d.net != null ? sgn(Math.round(d.net)) : '–'} label={d.net != null && d.net < 0 ? 'Surplus' : 'Deficit'} color={d.net == null ? undefined : d.net >= 0 ? c.ok : c.bad} />
          </View>
          {goal && d.net != null ? <Text style={{ color: c.mute, fontSize: 13, marginTop: 4 }}>{d.net >= goal ? `Goal of ${fmtInt(goal)} met` : `${fmtInt(goal - d.net)} short of your ${fmtInt(goal)} goal`}</Text> : null}
        </Block>
      ) : null}

      {d.info.weightLb != null || d.info.waterOz != null || d.info.sleepMins != null || d.info.steps != null ? (
        <Block title="Body">
          <View style={{ flexDirection: 'row' }}>
            {d.info.weightLb != null ? <Stat value={`${fmt(d.info.weightLb)} lb`} label="Weight" /> : null}
            {d.info.waterOz != null ? <Stat value={fmtWater(d.info.waterOz)} label="Water" /> : null}
            {d.info.sleepMins != null ? <Stat value={fmtSleep(d.info.sleepMins)} label="Sleep" /> : null}
            {d.info.steps != null ? <Stat value={fmtInt(d.info.steps)} label="Steps" /> : null}
          </View>
        </Block>
      ) : null}

      {d.info.note ? (
        <Block title="Note">
          <Small>{d.info.note}</Small>
        </Block>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.md, flexWrap: 'wrap' }}>
        {d.cardio ? <LinkButton label="Cardio ›" onPress={() => router.navigate('/cardio')} /> : null}
        {d.lift ? <LinkButton label="Lifting ›" onPress={() => router.navigate('/lifting')} /> : null}
        {state.settings.sections.food ? <LinkButton label="Food ›" onPress={() => router.navigate('/food')} /> : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.md, marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, paddingHorizontal: 4 },
  month: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  nav: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  cell: { flex: 1, minHeight: 70 },
  cellBox: { borderWidth: 1.5, borderRadius: radius.sm, paddingVertical: 3, paddingHorizontal: 2, alignItems: 'stretch', margin: 1 },
  num: { alignSelf: 'center', minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 13 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  lineText: { flex: 1, fontSize: 9.5, fontWeight: '600', letterSpacing: -0.2 },
  net: { fontSize: 9.5, fontWeight: '700', textAlign: 'center', marginTop: 1, ...tabular },
  key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.sm, paddingHorizontal: 4 },
  review: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginVertical: space.sm },
  reviewTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  block: { borderTopWidth: 1, paddingTop: space.sm, marginTop: space.sm },
});
