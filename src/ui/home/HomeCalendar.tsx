import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  DAY_NAMES,
  KIND_LABEL,
  MONTHS,
  SPORT_LABEL,
  dayDiff,
  calTarget,
  kDays,
  dayLog,
  dayProgress,
  weekdayIndex,
  daysInMonth,
  distText,
  firstWorkout,
  fmt,
  fmtInt,
  fmtSleep,
  fmtTime,
  fmtWater,
  monthOffset,
  pad,
  sgn,
  shortDayLabel,
  toD,
  type DayLog,
  type DayMark,
  type DayProgress,
  type DayResult,
} from '@/logic';

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
  const [keyOpen, setKeyOpen] = useState(false);
  const since = useMemo(() => firstWorkout(state), [state]);
  // The first day with calories logged: food counts toward a day's result from then on.
  const foodSince = useMemo(() => (state.settings.sections.food ? (kDays(state)[0]?.s ?? null) : null), [state]);
  const food = useCallback((s: string) => (state.settings.sections.food ? { target: calTarget(state, s), since: foodSince } : null), [state, foodSince]);

  const cells = useMemo(() => {
    const out: ({ d: DayLog; p: DayProgress } | null)[] = [];
    for (let i = 0; i < monthOffset(view.y, view.m); i++) out.push(null);
    for (let n = 1; n <= daysInMonth(view.y, view.m); n++) {
      const s = `${view.y}-${pad(view.m + 1)}-${pad(n)}`;
      const d = dayLog(state, s, today, since);
      out.push({ d, p: dayProgress(d, today, food(s)) });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [state, view, today, since, food]);
  const rows: ({ d: DayLog; p: DayProgress } | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const todayCell = useMemo(() => {
    const d = dayLog(state, today, today, since);
    return dayProgress(d, today, food(today));
  }, [state, today, since, food]);

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
          <Pressable onPress={() => setKeyOpen(true)} accessibilityRole="button" accessibilityLabel="What the colors mean" hitSlop={6} style={({ pressed }) => [st.nav, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: c.ink }}>?</Text>
          </Pressable>
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
          {open && r.some((x) => x?.d.s === open) ? <DayReview d={r.find((x) => x?.d.s === open)!.d} p={r.find((x) => x?.d.s === open)!.p} /> : null}
        </View>
      ))}
      <Modal visible={keyOpen} transparent animationType="fade" onRequestClose={() => setKeyOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setKeyOpen(false)} accessibilityLabel="Close the key" />
        <View style={[st.keyCard, { backgroundColor: c.card }]} accessibilityViewIsModal>
          <Text style={[st.keyTitle, { color: c.ink }]}>What the calendar shows</Text>
          <KeyRow icon={<KeyDisc r="all" />} title="All done" text="Every workout planned was done, and your calories were logged and on target." />
          <KeyRow icon={<KeyDisc r="some" />} title="Some done" text="Part of the day’s plan was done." />
          <KeyRow icon={<KeyDisc r="missed" />} title="Missed" text="Something was planned and none of it was done." />
          <KeyRow icon={<KeyDisc r="planned" />} title="To do" text="Planned for today or a day ahead." />
          <KeyRow icon={<View style={[st.keyBox, { borderColor: c.ink, borderWidth: 2 }]} />} title="Today" text="Outlined. Past days are shaded." />
          <KeyRow icon={<CardioIcon color={c.ok} focused size={18} />} title="Cardio" text="Green when done, red when missed, grey when planned." />
          <KeyRow icon={<LiftIcon color={c.ok} focused size={18} />} title="Lifting" text="Green when done, red when missed, grey when planned." />
          <KeyRow
            icon={
              <View style={{ gap: 3 }}>
                <View style={[st.bar, { width: 18, backgroundColor: c.ok }]} />
                <View style={[st.bar, { width: 18, backgroundColor: c.bad }]} />
              </View>
            }
            title="Calories"
            text="The thin bar: green for a deficit, red for a surplus."
          />
          <Text style={{ color: c.mute, fontSize: 13, marginTop: space.sm }}>Tap any day for its full review.</Text>
          <Pressable onPress={() => setKeyOpen(false)} accessibilityRole="button" style={({ pressed }) => [st.keyDone, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: c.card, fontWeight: '700', fontSize: 15 }}>Got it</Text>
          </Pressable>
        </View>
      </Modal>
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

function KeyDisc({ r }: { r: DayResult }) {
  const c = useColors();
  const ds = discStyle(c, r, false);
  return <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ds.bg, borderWidth: 1.5, borderColor: ds.border }} />;
}

function KeyRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={st.keyRow}>
      <View style={{ width: 28, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: c.mute, fontSize: 13.5, lineHeight: 18 }}>{text}</Text>
      </View>
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
function DayReview({ d, p }: { d: DayLog; p: DayProgress }) {
  const c = useColors();
  const { today } = useTracker();
  const diff = dayDiff(d.s, today);
  const when = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : diff < 0 ? `${-diff} days ago` : `In ${diff} days`;
  const empty = !d.cardio?.label && !d.lift?.label && !d.food && d.net == null && !Object.keys(d.info).length;

  return (
    <View style={[st.review, { backgroundColor: c.bg, borderColor: c.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={[st.reviewTitle, { color: c.ink }]}>{shortDayLabel(d.s)}</Text>
        <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>{when}</Text>
      </View>

      {p.total ? (
        <Text style={{ color: p.result === 'all' ? c.ok : p.result === 'some' ? c.warn : p.result === 'missed' ? c.bad : c.mute, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
          {`${RESULT_TEXT[p.result]} · ${p.done} of ${p.total}`}
        </Text>
      ) : null}
      {empty ? <Text style={{ color: c.mute, fontSize: 14, marginTop: space.sm }}>{d.s > today ? 'Nothing planned.' : 'Nothing logged.'}</Text> : null}

      {d.cardio && (d.cardio.planned.length || d.cardio.sessions.length) ? (
        <Block title="Cardio" mark={d.cardio.mark}>
          {d.cardio.sessions.length
            ? d.cardio.sessions.map((x) => <Small key={x.id}>{[CARDIO_LABEL[x.type], x.miles ? distText(x.type, x.miles) : x.secs ? fmtTime(x.secs) : null].filter(Boolean).join(' · ')}</Small>)
            : d.cardio.planned.map((wk) => <Small key={wk.sport}>{`${wk.race ? 'Race' : `${KIND_LABEL[wk.kind]} ${SPORT_LABEL[wk.sport].toLowerCase()}`} · ${distText(wk.sport, wk.miles)}`}</Small>)}
        </Block>
      ) : null}

      {d.lift && (d.lift.routine || d.lift.workout) ? (
        <Block title="Lifting" mark={d.lift.mark}>
          <Small>{d.lift.workout ? d.lift.workout.name : d.lift.routine!.name}</Small>
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
        </Block>
      ) : null}

      {d.cin != null || d.cout != null ? (
        <Block title="Calories">
          <View style={{ flexDirection: 'row' }}>
            <Stat value={d.cout != null ? fmtInt(d.cout) : '–'} label="Out" />
            <Stat value={d.net != null ? sgn(Math.round(d.net)) : '–'} label={d.net != null && d.net < 0 ? 'Surplus' : 'Deficit'} color={d.net == null ? undefined : d.net >= 0 ? c.ok : c.bad} />
          </View>
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  keyCard: { position: 'absolute', left: space.lg, right: space.lg, top: '12%', maxWidth: 440, alignSelf: 'center', borderRadius: radius.lg, padding: space.lg },
  keyTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, marginBottom: space.sm },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  keyBox: { width: 22, height: 22, borderRadius: 6 },
  keyDone: { alignItems: 'center', borderRadius: radius.md, paddingVertical: space.md, marginTop: space.md },
  review: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginVertical: space.sm },
  reviewTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  block: { borderTopWidth: 1, paddingTop: space.sm, marginTop: space.sm },
});
