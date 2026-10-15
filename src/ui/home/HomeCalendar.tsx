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
  calTarget,
  dayLog,
  dayProgress,
  onTarget,
  targetText,
  weekdayIndex,
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
  type DayProgress,
  type DayResult,
} from '@/logic';

import { RouteMap } from '../cardio/RouteMap';
import { LinkButton } from '../food/kit';
import { CardioIcon, LiftIcon } from '../TabBar';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors, type Palette } from '../theme';

function markColor(c: Palette, m: DayMark | null): string {
  return m === 'done' ? c.ok : m === 'missed' ? c.bad : m === 'partial' ? c.warn : m === 'planned' ? c.mute : c.line;
}

const RESULT_TEXT: Record<DayResult, string> = { all: 'All done', some: 'Some done', missed: 'Missed', planned: 'To do', rest: 'Rest day' };

/** The date's circle: filled green when everything was done, amber when some was, red when it was missed. */
function discStyle(c: Palette, r: DayResult, past: boolean): { bg: string; fg: string; border: string } {
  if (r === 'all') return { bg: c.ok, fg: '#ffffff', border: c.ok };
  if (r === 'some') return { bg: c.warn, fg: '#ffffff', border: c.warn };
  if (r === 'missed') return { bg: c.badbg, fg: c.bad, border: c.bad };
  if (r === 'planned') return { bg: 'transparent', fg: c.ink, border: c.mute };
  return { bg: 'transparent', fg: past ? c.mute : c.ink, border: 'transparent' };
}

/**
 * The plan on one calendar. Each date's circle says how the day went (green: all done, amber: some, red:
 * missed, outlined: still to do), small icons show cardio and lifting, and a thin bar shows the calorie
 * deficit (green) or surplus (red). Past days are shaded; today is outlined. Tap a day for its full review.
 */
export function HomeCalendar() {
  const c = useColors();
  const { state, today } = useTracker();
  const [view, setView] = useState(() => ({ y: toD(today).getFullYear(), m: toD(today).getMonth() }));
  const [open, setOpen] = useState<string | null>(today);
  const since = useMemo(() => firstWorkout(state), [state]);

  const cells = useMemo(() => {
    const out: ({ d: DayLog; p: DayProgress } | null)[] = [];
    for (let i = 0; i < monthOffset(view.y, view.m); i++) out.push(null);
    for (let n = 1; n <= daysInMonth(view.y, view.m); n++) {
      const s = `${view.y}-${pad(view.m + 1)}-${pad(n)}`;
      const d = dayLog(state, s, today, since);
      out.push({ d, p: dayProgress(d, today, calTarget(state, s)) });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [state, view, today, since]);
  const rows: ({ d: DayLog; p: DayProgress } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const todayCell = useMemo(() => {
    const d = dayLog(state, today, today, since);
    return dayProgress(d, today, calTarget(state, today));
  }, [state, today, since]);

  const shift = (n: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const thisMonth = view.y === toD(today).getFullYear() && view.m === toD(today).getMonth();
  const tc = todayCell.result === 'all' ? c.ok : todayCell.result === 'some' ? c.warn : c.ink;

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

      <View style={[st.todayBar, { backgroundColor: c.soft }]}>
        <Text style={{ color: c.ink, fontSize: 14, fontWeight: '800' }}>{`Today, ${shortDayLabel(today)}`}</Text>
        <Text style={{ color: tc, fontSize: 14, fontWeight: '700', ...tabular }}>
          {todayCell.total ? (todayCell.result === 'all' ? `All done ✓` : `${todayCell.done} of ${todayCell.total} done`) : 'Rest day'}
        </Text>
      </View>

      <View style={st.row}>
        {DAY_NAMES.map((d, i) => (
          <Text key={d} style={[st.dow, { color: i === weekdayIndex(today) && thisMonth ? c.ink : c.mute }]}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i}>
          <View style={st.row}>
            {r.map((x, j) =>
              x ? (
                <Cell key={x.d.s} d={x.d} p={x.p} today={today} selected={open === x.d.s} onPress={() => setOpen(open === x.d.s ? null : x.d.s)} />
              ) : (
                <View key={`b${j}`} style={st.cell} />
              ),
            )}
          </View>
          {open && r.some((x) => x?.d.s === open) ? <DayReview d={r.find((x) => x?.d.s === open)!.d} p={r.find((x) => x?.d.s === open)!.p} onClose={() => setOpen(null)} /> : null}
        </View>
      ))}
      <View style={st.key}>
        <KeyDisc r="all" label="All done" />
        <KeyDisc r="some" label="Some done" />
        <KeyDisc r="missed" label="Missed" />
        <KeyDisc r="planned" label="To do" />
      </View>
      <View style={[st.key, { marginTop: 4 }]}>
        <View style={st.keyItem}>
          <CardioIcon color={c.mute} focused={false} size={14} />
          <Text style={[st.keyText, { color: c.mute }]}>Cardio</Text>
        </View>
        <View style={st.keyItem}>
          <LiftIcon color={c.mute} focused={false} size={14} />
          <Text style={[st.keyText, { color: c.mute }]}>Lifting</Text>
        </View>
        <View style={st.keyItem}>
          <View style={[st.bar, { width: 14, backgroundColor: c.ok }]} />
          <Text style={[st.keyText, { color: c.mute }]}>Deficit</Text>
        </View>
        <View style={st.keyItem}>
          <View style={[st.bar, { width: 14, backgroundColor: c.bad }]} />
          <Text style={[st.keyText, { color: c.mute }]}>Surplus</Text>
        </View>
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

function KeyDisc({ r, label }: { r: DayResult; label: string }) {
  const c = useColors();
  const ds = discStyle(c, r, false);
  return (
    <View style={st.keyItem}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ds.bg, borderWidth: 1.5, borderColor: ds.border }} />
      <Text style={[st.keyText, { color: c.mute }]}>{label}</Text>
    </View>
  );
}

const Cell = memo(function Cell({ d, p, today, selected, onPress }: { d: DayLog; p: DayProgress; today: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const day = toD(d.s).getDate();
  const isToday = d.s === today;
  const past = d.s < today;
  const ds = discStyle(c, p.result, past);
  const a11y = [
    isToday ? `Today, ${shortDayLabel(d.s)}` : shortDayLabel(d.s),
    p.total ? `${RESULT_TEXT[p.result]}, ${p.done} of ${p.total}` : 'Rest day',
    d.cardio?.label ? `Cardio: ${d.cardio.label}` : null,
    d.lift?.label ? `Lifting: ${d.lift.label}` : null,
    d.net != null ? `${d.net >= 0 ? 'deficit' : 'surplus'} ${fmtInt(Math.abs(d.net))} calories` : null,
  ]
    .filter(Boolean)
    .join('. ');
  const cm = d.cardio?.mark && d.cardio.mark !== 'skipped' ? d.cardio.mark : null;
  const lm = d.lift?.mark && d.lift.mark !== 'skipped' ? d.lift.mark : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        st.cell,
        st.cellBox,
        {
          backgroundColor: selected ? c.soft : past ? c.bg : 'transparent',
          borderColor: isToday ? c.ink : selected ? c.line : 'transparent',
          borderWidth: isToday ? 2 : 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <View style={[st.disc, { backgroundColor: ds.bg, borderColor: ds.border }]}>
        <Text style={{ color: ds.fg, fontSize: 13.5, fontWeight: isToday || p.result !== 'rest' ? '800' : '600', ...tabular }}>{day}</Text>
      </View>
      <View style={st.icons}>
        {cm ? <CardioIcon color={markColor(c, cm)} focused={cm === 'done'} size={13} /> : null}
        {lm ? <LiftIcon color={markColor(c, lm)} focused={lm === 'done'} size={13} /> : null}
      </View>
      <View style={[st.bar, { backgroundColor: d.net == null ? 'transparent' : d.net >= 0 ? c.ok : c.bad }]} />
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
function DayReview({ d, p, onClose }: { d: DayLog; p: DayProgress; onClose: () => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const diff = dayDiff(d.s, today);
  const when = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : diff < 0 ? `${-diff} days ago` : `In ${diff} days`;
  const goal = calTarget(state, d.s);
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

      {p.total ? (
        <Text style={{ color: p.result === 'all' ? c.ok : p.result === 'some' ? c.warn : p.result === 'missed' ? c.bad : c.mute, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
          {`${RESULT_TEXT[p.result]} · ${p.done} of ${p.total}${d.s < today && calTarget(state, d.s) != null && d.net != null ? ' (workouts and calories)' : ''}`}
        </Text>
      ) : null}
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
          {goal != null && d.net != null ? (
            <Text style={{ color: onTarget(d.net, goal) ? c.ok : c.mute, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
              {`${onTarget(d.net, goal) ? 'On target' : 'Off target'} (${targetText(goal).toLowerCase()})`}
            </Text>
          ) : null}
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
  dow: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '700', marginBottom: 4 },
  cell: { flex: 1, minHeight: 64 },
  cellBox: { borderRadius: radius.sm, paddingVertical: 4, alignItems: 'center', margin: 1.5, gap: 3 },
  disc: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', gap: 2, height: 13, alignItems: 'center' },
  bar: { width: '60%', height: 3, borderRadius: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  todayBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.sm },
  key: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: 4, marginTop: space.sm, paddingHorizontal: 4 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  keyText: { fontSize: 11.5 },
  review: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginVertical: space.sm },
  reviewTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  block: { borderTopWidth: 1, paddingTop: space.sm, marginTop: space.sm },
});
