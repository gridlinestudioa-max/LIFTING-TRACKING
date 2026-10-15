import { createContext, useContext, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  METERS_PER_MILE,
  MEALS,
  MICROS,
  MUSCLE_GROUPS,
  SPORT_GROUPS,
  avgBars,
  avgByBucket,
  dayDiff,
  calTarget,
  cardioBars,
  cardioRecordHistory,
  dietFor,
  e1rmBars,
  fiberTarget,
  fmt,
  fmtInt,
  fmtTime,
  foodDays,
  groupOf,
  kDays,
  liftBars,
  liftRecordHistory,
  liftedExercises,
  macroCalories,
  macroTargets,
  mealKcal,
  microDay,
  microOf,
  microTarget,
  muscleBars,
  muscleGroupOf,
  rangeSpan,
  recordsIn,
  shortDayLabel,
  spanAt,
  statsOf,
  suggestTargets,
  weightSeries,
  weightTrend,
  type Bucket,
  type FoodDay,
  type GrainPlan,
  type MicroKey,
  type Range,
  type RangeSpan,
  type RecordPoint,
  type SportGroup,
} from '@/logic';

import { BarChart, ChartCaption, ChartKey, Legend, LineChart, RangeTabs, SERIES, StackedBarChart } from '../charts';
import { Mute, Section } from '../components';
import { Pill } from '../food/kit';
import { useLibrary } from '../lifting/library';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';

// Bar sizes for each range: what one bar (or point) covers.
const DAYS_WEEKS: GrainPlan = { week: 'day', month: 'day', year: 'week', all: 'month' };
const DAY_WEEK_WEEK: GrainPlan = { week: 'day', month: 'week', year: 'week', all: 'month' };
const DAY_WEEK_MONTH: GrainPlan = { week: 'day', month: 'week', year: 'month', all: 'month' };
const DAY_DAY_MONTH: GrainPlan = { week: 'day', month: 'day', year: 'month', all: 'month' };

/** One chart in a deck: a title and the chart for a range. */
export interface Graph {
  id: string;
  title: string;
  Chart: ComponentType<{ range: Range }>;
}

/**
 * A card that holds several charts for one area (calories, cardio, lifting). Arrows (or the dots) move
 * between them; the Week / Month / Year / All choice stays the same as you go.
 */
export function GraphDeck({ title, graphs, header }: { title: string; graphs: Graph[]; header?: ReactNode }) {
  const c = useColors();
  const [i, setI] = useState(0);
  const [range, setRange] = useState<Range>('month');
  if (!graphs.length) return null;
  const n = graphs.length;
  const at = Math.min(i, n - 1);
  const g = graphs[at];
  const go = (d: number) => setI((at + d + n) % n);
  return (
    <Section title={title} action={<Text style={{ color: c.mute, fontSize: 13, fontWeight: '700', ...tabular }}>{`${at + 1} of ${n}`}</Text>}>
      <View style={st.nav}>
        <Arrow label="‹" a11y={`Previous chart: ${graphs[(at - 1 + n) % n].title}`} onPress={() => go(-1)} />
        <Text style={[st.gtitle, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
          {g.title}
        </Text>
        <Arrow label="›" a11y={`Next chart: ${graphs[(at + 1) % n].title}`} onPress={() => go(1)} />
      </View>
      <View style={st.dots}>
        {graphs.map((x, j) => (
          <Pressable key={x.id} onPress={() => setI(j)} accessibilityRole="button" accessibilityLabel={`Show ${x.title}`} hitSlop={6}>
            <View style={[st.dot, { backgroundColor: j === at ? c.ink : c.line }]} />
          </Pressable>
        ))}
      </View>
      {header}
      <RangeTabs value={range} onChange={setRange} />
      <g.Chart key={g.id} range={range} />
    </Section>
  );
}

function Arrow({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8} style={({ pressed }) => [st.arrow, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
      <Text style={{ fontSize: 20, color: c.ink, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

const labels = (span: RangeSpan) => span.buckets.map((b) => b.label);
const avgPer = (span: RangeSpan) => (span.grain === 'day' ? 'per day' : `average per day, by ${span.per}`);
/** A dated point for each bucket that has a value, at the bucket's start: for lines over long ranges. */
const bucketPts = (buckets: Bucket[], vals: (number | null)[]) =>
  buckets.map((b, i) => (vals[i] == null ? null : { s: b.start, v: vals[i] as number })).filter((p): p is { s: string; v: number } => p != null);

function Total({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', marginTop: space.sm, ...tabular }}>{children}</Text>;
}


const points = (buckets: Bucket[], vals: (number | null)[]) => bucketPts(buckets, vals);
const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
/** How many weeks a range covers (at least one). */
const weeksIn = (span: RangeSpan) => Math.max(1, (dayDiff(span.to, span.from) + 1) / 7);
const sumOf = (vals: (number | null)[]) => vals.reduce<number>((t, v) => t + (v ?? 0), 0);
const avgOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
/** "Last 30 days · miles per day". */
const cap = (span: RangeSpan, what: string) => `${span.caption} · ${what}`;
const byWhat = (span: RangeSpan, avg = false) => (avg ? `average per day, by ${span.grain}` : `per ${span.grain}`);

/** A row of choices that scrolls sideways (sports, exercises, nutrients). */
function Choices<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingVertical: 2 }} style={{ marginBottom: space.sm }}>
      {options.map((o) => (
        <Pill key={o.id} label={o.label} selected={o.id === value} onPress={() => onChange(o.id)} style={{ paddingHorizontal: space.md, minHeight: 34, paddingVertical: 5 }} />
      ))}
    </ScrollView>
  );
}

// ---------- Cardio ----------

const SportCtx = createContext<SportGroup>('run');
const SPORT_WORD: Record<SportGroup, { one: string; many: string }> = {
  run: { one: 'run', many: 'runs' },
  bike: { one: 'ride', many: 'rides' },
  swim: { one: 'swim', many: 'swims' },
  walk: { one: 'walk', many: 'walks and hikes' },
  other: { one: 'workout', many: 'workouts' },
};

function useSport() {
  const sport = useContext(SportCtx);
  const { state, today } = useTracker();
  const sessions = useMemo(
    () => state.cardio.sessions.filter((x) => x.date <= today && groupOf(x.type) === sport).sort((a, b) => a.date.localeCompare(b.date)),
    [state.cardio.sessions, today, sport],
  );
  return { sport, sessions, today, w: SPORT_WORD[sport], swim: sport === 'swim' };
}

/** Distance in the sport's unit: meters for swims, miles otherwise. */
const distUnit = (swim: boolean) => (swim ? 'm' : 'mi');
const distVal = (swim: boolean, mi: number | null) => (mi == null ? null : swim ? Math.round(mi * METERS_PER_MILE) : Math.round(mi * 10) / 10);

function DistanceGraph({ range }: { range: Range }) {
  const { sessions, today, swim, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAYS_WEEKS);
  const b = cardioBars(sessions, span.buckets);
  const vals = b.miles.map((v) => distVal(swim, v));
  return (
    <>
      <ChartCaption>{cap(span, `${swim ? 'meters' : 'miles'} ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit={distUnit(swim)} label={`Distance, ${span.caption.toLowerCase()}`} />
      <Total>{`${swim ? fmtInt(sumOf(vals)) : fmt(Math.round(sumOf(vals) * 10) / 10)} ${distUnit(swim)} in ${fmtInt(sumOf(b.count))} ${w.many}`}</Total>
      <Why>Total training volume: whether your distance is building or slipping.</Why>
    </>
  );
}

function PaceGraph({ range }: { range: Range }) {
  const { sessions, today, sport, swim, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAY_WEEK_WEEK);
  const b = cardioBars(sessions, span.buckets);
  const bike = sport === 'bike';
  // Riders think in speed; swimmers in time per 100 m; everyone else in minutes per mile.
  const conv = (secPerMi: number | null) => (secPerMi == null ? null : bike ? Math.round((3600 / secPerMi) * 10) / 10 : swim ? Math.round(secPerMi / (METERS_PER_MILE / 100)) : Math.round(secPerMi));
  const vals = b.pace.map(conv);
  const pts = points(span.buckets, vals);
  const totMi = sessions.filter((x) => x.date >= span.from && x.miles && x.secs).reduce((t, x) => t + (x.miles ?? 0), 0);
  const totS = sessions.filter((x) => x.date >= span.from && x.miles && x.secs).reduce((t, x) => t + (x.secs ?? 0), 0);
  const overall = totMi ? conv(totS / totMi) : null;
  const unit = bike ? 'mph' : swim ? '/100m' : '/mi';
  const show = (v: number) => (bike ? `${fmt(v)} mph` : `${fmtTime(v)} ${unit}`);
  return (
    <>
      <ChartCaption>{cap(span, `${bike ? 'average speed' : 'average pace'}${span.grain === 'day' ? ' by day' : ` by ${span.grain}`}${bike ? '' : ' (lower is faster)'}`)}</ChartCaption>
      {pts.length ? (
        <LineChart label={`Pace, ${span.caption.toLowerCase()}`} unit={unit} from={span.from} to={span.to} tick={bike ? undefined : (v) => fmtTime(Math.round(v))} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} />
      ) : (
        <NoData what={`timed ${w.many}`} />
      )}
      {overall != null ? <Total>{`Average ${bike ? 'speed' : 'pace'}: ${show(overall)}`}</Total> : null}
      <Why>{`Time divided by distance (moving time when recorded), so longer ${w.many} count more. ${bike ? 'Higher is faster.' : 'Lower is faster.'}`}</Why>
    </>
  );
}

function FrequencyGraph({ range }: { range: Range }) {
  const { sessions, today, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAY_WEEK_MONTH);
  const b = cardioBars(sessions, span.buckets);
  const weeks = weeksIn(span);
  return (
    <>
      <ChartCaption>{cap(span, `${w.many} ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={b.count} labels={labels(span)} unit={w.many} label={`Number of ${w.many}, ${span.caption.toLowerCase()}`} />
      <Total>{`${fmtInt(sumOf(b.count))} ${w.many} · ${fmt(Math.round((sumOf(b.count) / weeks) * 10) / 10)} a week`}</Total>
      <Why>Consistency: showing up often usually comes before getting faster.</Why>
    </>
  );
}

function AvgDistanceGraph({ range }: { range: Range }) {
  const { sessions, today, swim, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAY_WEEK_MONTH);
  const b = cardioBars(sessions, span.buckets);
  const vals = b.avgMiles.map((v) => distVal(swim, v));
  const pts = points(span.buckets, vals);
  const n = sumOf(b.count);
  const total = sumOf(b.miles);
  return (
    <>
      <ChartCaption>{cap(span, `average ${distUnit(swim) === 'm' ? 'meters' : 'miles'} per ${w.one}, by ${span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label={`Average distance per ${w.one}`} zero unit={distUnit(swim)} from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData />}
      {n ? <Total>{`${swim ? fmtInt(total * METERS_PER_MILE) : fmt(Math.round((total / n) * 10) / 10)} ${swim ? 'm total' : `mi per ${w.one} on average`}`}</Total> : null}
      <Why>{`Endurance: whether a typical ${w.one} is getting longer, apart from how often you go.`}</Why>
    </>
  );
}

function HeartRateGraph({ range }: { range: Range }) {
  const { sessions, today, w } = useSport();
  const withHr = sessions.filter((x) => x.hr);
  const span = spanAt(range, today, withHr[0]?.date, DAY_WEEK_MONTH);
  const b = cardioBars(withHr, span.buckets);
  const pts = points(span.buckets, b.hr);
  const inRange = withHr.filter((x) => x.date >= span.from && x.secs);
  const secs = inRange.reduce((t, x) => t + (x.secs ?? 0), 0);
  const avg = secs ? Math.round(inRange.reduce((t, x) => t + (x.hr ?? 0) * (x.secs ?? 0), 0) / secs) : null;
  return (
    <>
      <ChartCaption>{cap(span, `average heart rate (bpm), by ${span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label={`Average heart rate, ${span.caption.toLowerCase()}`} unit="bpm" from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData what={`${w.many} with heart rate`} />}
      {avg != null ? <Total>{`Average ${avg} bpm over ${inRange.length} ${inRange.length === 1 ? w.one : w.many}`}</Total> : null}
      <Why>Averaged by duration. A lower heart rate at the same pace usually means better aerobic fitness. Add heart rate when you log, or import from a watch.</Why>
    </>
  );
}

function TimeGraph({ range }: { range: Range }) {
  const { sessions, today, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAY_WEEK_MONTH);
  const b = cardioBars(sessions, span.buckets);
  const hours = span.grain !== 'day';
  const vals = b.minutes.map((m) => (m == null ? null : hours ? Math.round((m / 60) * 10) / 10 : m));
  const mins = sumOf(b.minutes);
  return (
    <>
      <ChartCaption>{cap(span, `${hours ? 'hours' : 'minutes'} ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit={hours ? 'h' : 'min'} label={`Time, ${span.caption.toLowerCase()}`} />
      <Total>{`${Math.floor(mins / 60)} h ${mins % 60} min of ${w.many}`}</Total>
      <Why>Time counts effort that distance misses, like hills and easy days.</Why>
    </>
  );
}

// ---------- Lifting ----------

function useDone() {
  const { state, today } = useTracker();
  return useMemo(() => state.lifting.workouts.filter((w) => w.done && w.date <= today).sort((a, b) => a.date.localeCompare(b.date)), [state.lifting.workouts, today]);
}

/** Exercise choices, most-done first, optionally with "All exercises". */
function useExercises(all: boolean) {
  const { state } = useTracker();
  const list = useMemo(() => liftedExercises(state.lifting), [state.lifting]);
  const opts = list.slice(0, 15).map((e) => ({ id: e.exId, label: e.name }));
  return all ? [{ id: '*', label: 'All exercises' }, ...opts] : opts;
}

function WorkoutsGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const span = spanAt(range, today, done[0]?.date, DAY_WEEK_MONTH);
  const b = liftBars(done, span.buckets);
  const weeks = weeksIn(span);
  return (
    <>
      <ChartCaption>{cap(span, `workouts ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={b.workouts} labels={labels(span)} unit="workouts" label={`Workouts, ${span.caption.toLowerCase()}`} />
      <Total>{`${sumOf(b.workouts)} workouts · ${fmt(Math.round((sumOf(b.workouts) / weeks) * 10) / 10)} a week`}</Total>
      <Why>Whether you’re keeping your routine, even when strength numbers bounce around.</Why>
    </>
  );
}

function OneRepMaxGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const opts = useExercises(false);
  const [ex, setEx] = useState<string | null>(null);
  const id = ex ?? opts[0]?.id ?? null;
  if (!id) return <NoData what="workouts with weights" />;
  const first = done.find((w) => w.exercises.some((e) => e.exId === id))?.date;
  const span = spanAt(range, today, first, DAY_WEEK_MONTH);
  const vals = e1rmBars(done, span.buckets, id);
  const pts = points(span.buckets, vals);
  const known = pts.map((p) => p.v);
  const ch = known.length >= 2 ? known[known.length - 1] - known[0] : null;
  return (
    <>
      <Choices options={opts} value={id} onChange={setEx} />
      <ChartCaption>{cap(span, `best estimated one-rep max (lb), by ${span.grain === 'day' ? 'workout' : span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label="Estimated one-rep max" unit="lb" from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData what="sets of 12 reps or fewer" />}
      {known.length ? <Total>{`Best ${fmtInt(Math.max(...known))} lb${ch != null ? ` · ${ch >= 0 ? '+' : '−'}${fmtInt(Math.abs(ch))} lb in this range` : ''}`}</Total> : null}
      <Why>Weight × (1 + reps ÷ 30), from sets of 12 reps or fewer. Going from 135 × 8 to 155 × 8 shows up here without testing a max.</Why>
    </>
  );
}

function MuscleGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const { byId } = useLibrary();
  const span = spanAt(range, today, done[0]?.date, DAY_WEEK_MONTH);
  const sets = muscleBars(done, span.buckets, (exId) => muscleGroupOf(byId(exId)));
  const series = MUSCLE_GROUPS.map((g, i) => ({ label: g.label, color: SERIES.palette[i % SERIES.palette.length], values: sets[g.id] }));
  const totals = MUSCLE_GROUPS.map((g) => ({ label: g.label, n: sets[g.id].reduce((a, b) => a + b, 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  return (
    <>
      <ChartCaption>{cap(span, `sets per muscle group, ${byWhat(span)}`)}</ChartCaption>
      <StackedBarChart series={series} labels={labels(span)} unit="sets" label={`Sets per muscle group, ${span.caption.toLowerCase()}`} />
      <Legend items={series.filter((x) => x.values.some((v) => v)).map((x) => ({ label: x.label, color: x.color }))} />
      {totals.length ? <Total>{totals.map((t) => `${t.label} ${t.n}`).join(' · ')}</Total> : <NoData />}
      <Why>Each finished set counts once, toward the exercise’s main muscle (a bench press counts for chest, not triceps too), so nothing is counted twice.</Why>
    </>
  );
}

function RepsGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const opts = useExercises(true);
  const [ex, setEx] = useState('*');
  const span = spanAt(range, today, done[0]?.date, DAY_WEEK_MONTH);
  const b = liftBars(done, span.buckets, ex === '*' ? null : ex);
  const pts = points(span.buckets, b.reps);
  const avg = avgOf(b.reps);
  return (
    <>
      <Choices options={opts} value={ex} onChange={setEx} />
      <ChartCaption>{cap(span, `average reps per set, by ${span.grain === 'day' ? 'workout' : span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label="Average reps per set" zero unit="reps" from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData />}
      {avg != null ? <Total>{`About ${fmt(Math.round(avg * 10) / 10)} reps a set`}</Total> : null}
      <Why>Low reps (1–5) lean toward strength, middle (6–12) toward size, high (13+) toward endurance. Read it with the weight you lifted.</Why>
    </>
  );
}

function DurationGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const span = spanAt(range, today, done[0]?.date, DAY_WEEK_MONTH);
  const b = liftBars(done, span.buckets);
  const avg = avgOf(b.minutes);
  return (
    <>
      <ChartCaption>{cap(span, `average minutes per workout, ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={b.minutes} labels={labels(span)} unit="min" label={`Workout length, ${span.caption.toLowerCase()}`} />
      {avg != null ? <Total>{`About ${fmtInt(Math.round(avg))} min a workout`}</Total> : <NoData what="timed workouts" />}
      <Why>From start to finish, for workouts recorded with the timer. Longer isn’t always more productive.</Why>
    </>
  );
}

// ---------- Food ----------

function useFood() {
  const { state, today } = useTracker();
  const days = useMemo(() => foodDays(state.meals, today), [state.meals, today]);
  const stats = statsOf(state.profile, today);
  // The diet's targets, filling gaps with the ones suggested from your profile.
  const limits = { ...(stats ? suggestTargets(stats, state.diet.style).limits : {}), ...dietFor(state, today).limits };
  const kcal = limits.kcalMax ?? null;
  return { days, today, limits, kcal, style: state.diet.style, sex: state.profile?.sex ?? null, age: stats?.age ?? null };
}

function CaloriesGraph({ range }: { range: Range }) {
  const { days, today, kcal } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAYS_WEEKS);
  const vals = avgBars(days, span.buckets, (d) => d.t.kcal).map((v) => (v == null ? null : Math.round(v)));
  const avg = avgOf(avgBars(days, rangeSpan(range, today, days[0]?.s).buckets, (d) => d.t.kcal));
  const n = days.filter((d) => d.s >= span.from).length;
  return (
    <>
      <ChartCaption>{cap(span, `kcal eaten ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="kcal" goal={kcal} label={`Calories eaten, ${span.caption.toLowerCase()}`} />
      {kcal ? <ChartKey items={['logged', 'goal']} /> : null}
      {avg != null ? <Total>{`Average ${fmtInt(Math.round(avg))} kcal a day${kcal ? ` · target ${fmtInt(kcal)}` : ''} (${n} days logged)`}</Total> : <NoData />}
      <Why>Only days with food logged count toward averages.</Why>
    </>
  );
}

function MacroGramsGraph({ range }: { range: Range }) {
  const { days, today } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAYS_WEEKS);
  const p = avgBars(days, span.buckets, (d) => d.t.protein);
  const cb = avgBars(days, span.buckets, (d) => d.t.carbs);
  const f = avgBars(days, span.buckets, (d) => d.t.fat);
  const series = [
    { label: 'Protein', color: SERIES.protein, values: p.map(r1) },
    { label: 'Carbs', color: SERIES.carbs, values: cb.map(r1) },
    { label: 'Fat', color: SERIES.fat, values: f.map(r1) },
  ];
  const a = (v: (number | null)[]) => fmtInt(Math.round(avgOf(v) ?? 0));
  return (
    <>
      <ChartCaption>{cap(span, `grams ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <StackedBarChart series={series} labels={labels(span)} unit="g" label={`Macros in grams, ${span.caption.toLowerCase()}`} />
      <Legend items={series.map((x) => ({ label: x.label, color: x.color }))} />
      {avgOf(p) != null ? <Total>{`Average a day: ${a(p)} g protein · ${a(cb)} g carbs · ${a(f)} g fat`}</Total> : <NoData />}
    </>
  );
}

function MacroGoalGraph({ range }: { range: Range }) {
  const { days, today, limits, kcal, style } = useFood();
  // A carb limit is a target only on low-carb diets; otherwise it's a loose cap, and carbs fill the rest.
  const carbCap = style === 'keto' || style === 'lowcarb' ? (limits.netCarbsMax ?? null) : null;
  const t = macroTargets(kcal, limits.proteinMin ?? null, limits.fatPctMax ?? null, carbCap);
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_WEEK);
  if (!t.protein && !t.carbs && !t.fat) {
    return <Mute style={{ marginVertical: space.lg }}>Set a calorie target (Settings → Your details, or a cut or bulk plan) to see how close you get to your macro targets.</Mute>;
  }
  const pct = (get: (d: FoodDay) => number, target: number | null) => (target ? avgBars(days, span.buckets, (d) => (get(d) / target) * 100).map((v) => (v == null ? null : Math.round(v))) : null);
  const lines = [
    { label: `Protein (${fmtInt(t.protein ?? 0)} g)`, color: SERIES.protein, v: pct((d) => d.t.protein, t.protein) },
    { label: `Carbs (${fmtInt(t.carbs ?? 0)} g)`, color: SERIES.carbs, v: pct((d) => d.t.carbs, t.carbs) },
    { label: `Fat (${fmtInt(t.fat ?? 0)} g)`, color: SERIES.fat, v: pct((d) => d.t.fat, t.fat) },
  ].filter((x) => x.v);
  const series = lines.flatMap((x) => {
    const pts = points(span.buckets, x.v!);
    return [{ pts, style: 'line' as const, color: x.color }, { pts, style: 'dots' as const, color: x.color }];
  });
  return (
    <>
      <ChartCaption>{cap(span, `% of each daily target, ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      {series.some((s) => s.pts.length) ? <LineChart label="Macro targets reached" zero unit="%" from={span.from} to={span.to} refs={[{ v: 100 }]} series={series} /> : <NoData />}
      <Legend items={[...lines.map((x) => ({ label: x.label, color: x.color, shape: 'line' as const })), { label: '100% of target', color: '#888888', shape: 'dash' }]} />
      <Why>Percent of target, so protein and fat compare fairly. Carbs and fat come from your calorie target (fat 30% of calories, carbs the rest) unless your diet sets them.</Why>
    </>
  );
}

function ProteinGraph({ range }: { range: Range }) {
  const { days, today, limits } = useFood();
  const target = limits.proteinMin ?? null;
  const span = spanAt(range, today, days[0]?.s, DAYS_WEEKS);
  const vals = avgBars(days, span.buckets, (d) => d.t.protein).map((v) => (v == null ? null : Math.round(v)));
  const inRange = days.filter((d) => d.s >= span.from);
  const hit = target ? inRange.filter((d) => d.t.protein >= target).length : null;
  return (
    <>
      <ChartCaption>{cap(span, `grams of protein ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="g" goal={target} label={`Protein, ${span.caption.toLowerCase()}`} />
      {target ? <ChartKey items={['logged', 'goal']} /> : null}
      {inRange.length ? <Total>{`Average ${fmtInt(Math.round(avgOf(vals) ?? 0))} g a day${hit != null ? ` · target met ${hit} of ${inRange.length} days` : ''}`}</Total> : <NoData />}
      <Why>Steady protein matters most for building and keeping muscle.</Why>
    </>
  );
}

function SourcesGraph({ range }: { range: Range }) {
  const { days, today } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_MONTH);
  const k = (key: 'protein' | 'carbs' | 'fat') => avgBars(days, span.buckets, (d) => macroCalories(d.t)[key]);
  const series = [
    { label: 'Protein', color: SERIES.protein, values: k('protein') },
    { label: 'Carbs', color: SERIES.carbs, values: k('carbs') },
    { label: 'Fat', color: SERIES.fat, values: k('fat') },
  ];
  const inRange = days.filter((d) => d.s >= span.from);
  const tot = inRange.reduce((t, d) => {
    const m = macroCalories(d.t);
    return { p: t.p + m.protein, c: t.c + m.carbs, f: t.f + m.fat };
  }, { p: 0, c: 0, f: 0 });
  const all = tot.p + tot.c + tot.f;
  const pc = (v: number) => `${Math.round((v / all) * 100)}%`;
  return (
    <>
      <ChartCaption>{cap(span, `share of calories from each macro, ${byWhat(span)}`)}</ChartCaption>
      <StackedBarChart series={series} labels={labels(span)} percent label={`Calorie sources, ${span.caption.toLowerCase()}`} />
      <Legend items={series.map((x) => ({ label: x.label, color: x.color }))} />
      {all ? <Total>{`Protein ${pc(tot.p)} · carbs ${pc(tot.c)} · fat ${pc(tot.f)}`}</Total> : <NoData />}
      <Why>4 kcal per gram of protein and carbs, 9 per gram of fat. It may not match logged calories exactly (fiber, alcohol and label rounding).</Why>
    </>
  );
}

function FiberGraph({ range }: { range: Range }) {
  const { days, today, sex, kcal } = useFood();
  const target = fiberTarget(sex, kcal);
  const span = spanAt(range, today, days[0]?.s, DAY_DAY_MONTH);
  const vals = avgBars(days, span.buckets, (d) => d.t.fiber).map((v) => (v == null ? null : Math.round(v)));
  const avg = avgOf(vals);
  return (
    <>
      <ChartCaption>{cap(span, `grams of fiber ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="g" goal={target} label={`Fiber, ${span.caption.toLowerCase()}`} />
      <ChartKey items={['logged', 'goal']} />
      {avg != null ? <Total>{`Average ${fmtInt(Math.round(avg))} g a day · aim for ${target} g`}</Total> : <NoData />}
      <Why>About 14 g per 1,000 kcal. Fiber is a good sign of overall diet quality.</Why>
    </>
  );
}

function SugarGraph({ range }: { range: Range }) {
  const { days, today, kcal } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_MONTH);
  const total = avgBars(days, span.buckets, (d) => d.t.sugar).map(r1);
  const added = avgBars(days, span.buckets, (d) => microDay(d.entries, 'addedSugar')?.sum ?? null).map(r1);
  const limit = microTarget('addedSugar', null, null, kcal);
  const tp = points(span.buckets, total);
  const ap = points(span.buckets, added);
  return (
    <>
      <ChartCaption>{cap(span, `grams of sugar ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      {tp.length ? (
        <LineChart
          label="Sugar"
          zero
          unit="g"
          from={span.from}
          to={span.to}
          refs={[{ v: limit, color: SERIES.fat }]}
          series={[
            { pts: tp, style: 'line', color: SERIES.carbs },
            { pts: tp, style: 'dots', color: SERIES.carbs },
            { pts: ap, style: 'line', color: SERIES.fat },
            { pts: ap, style: 'dots', color: SERIES.fat },
          ]}
        />
      ) : (
        <NoData />
      )}
      <Legend items={[{ label: 'Total sugar', color: SERIES.carbs, shape: 'line' }, { label: 'Added sugar', color: SERIES.fat, shape: 'line' }, { label: `Added sugar limit (${limit} g)`, color: SERIES.fat, shape: 'dash' }]} />
      <Why>Total sugar includes fruit and milk. Added sugar is what’s put in; keep it under 10% of calories. Only packaged foods that list added sugar count toward it.</Why>
    </>
  );
}

function SodiumGraph({ range }: { range: Range }) {
  const { days, today } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_MONTH);
  const vals = avgBars(days, span.buckets, (d) => microOf(d, 'sodium')).map((v) => (v == null ? null : Math.round(v)));
  const cover = coverage(days.filter((d) => d.s >= span.from), 'sodium');
  return (
    <>
      <ChartCaption>{cap(span, `mg of sodium ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="mg" goal={2300} label={`Sodium, ${span.caption.toLowerCase()}`} />
      <ChartKey items={['logged', 'goal']} />
      {avgOf(vals) != null ? <Total>{`Average ${fmtInt(Math.round(avgOf(vals)!))} mg a day · limit 2,300 mg`}</Total> : <NoData />}
      <Coverage pct={cover} />
    </>
  );
}

function MealGraph({ range }: { range: Range }) {
  const { days, today } = useFood();
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_MONTH);
  const series = MEALS.map((m, i) => ({ label: m.label, color: SERIES.palette[[1, 0, 2, 3][i]], values: avgBars(days, span.buckets, (d) => mealKcal(d)[m.id]).map((v) => (v == null ? null : Math.round(v))) }));
  const inRange = days.filter((d) => d.s >= span.from);
  const avgMeal = MEALS.map((m) => ({ label: m.label, v: inRange.length ? inRange.reduce((t, d) => t + mealKcal(d)[m.id], 0) / inRange.length : 0 }));
  return (
    <>
      <ChartCaption>{cap(span, `kcal by meal ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <StackedBarChart series={series} labels={labels(span)} unit="kcal" label={`Calories by meal, ${span.caption.toLowerCase()}`} />
      <Legend items={series.map((x) => ({ label: x.label, color: x.color }))} />
      {inRange.length ? <Total>{avgMeal.map((m) => `${m.label} ${fmtInt(Math.round(m.v))}`).join(' · ')}</Total> : <NoData />}
      <Why>Average calories at each meal on days you logged.</Why>
    </>
  );
}

/** 2,400 or 1.4: whole numbers with commas for big amounts, one decimal for small ones. */
const amt = (v: number) => (v >= 100 ? fmtInt(Math.round(v)) : fmt(Math.round(v * 10) / 10));

const MICRO_CHOICES = MICROS.filter((m) => m.key !== 'sodium' && m.key !== 'addedSugar');

function MicroGraph({ range }: { range: Range }) {
  const { days, today, sex, age, kcal } = useFood();
  const [key, setKey] = useState<MicroKey>('potassium');
  const def = MICROS.find((m) => m.key === key)!;
  const target = microTarget(key, sex, age, kcal);
  const span = spanAt(range, today, days[0]?.s, DAY_WEEK_MONTH);
  const vals = avgBars(days, span.buckets, (d) => microOf(d, key)).map((v) => (v == null ? null : def.unit === 'µg' ? Math.round(v * 10) / 10 : Math.round(v)));
  const avg = avgOf(vals);
  return (
    <>
      <Choices options={MICRO_CHOICES.map((m) => ({ id: m.key, label: m.label }))} value={key} onChange={setKey} />
      <ChartCaption>{cap(span, `${def.unit} of ${def.label.toLowerCase()} ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit={def.unit} goal={target} label={`${def.label}, ${span.caption.toLowerCase()}`} />
      <ChartKey items={['logged', 'goal']} />
      {avg != null ? <Total>{`Average ${amt(avg)} ${def.unit} a day · aim for ${amt(target)} ${def.unit}`}</Total> : <NoData />}
      <Coverage pct={coverage(days.filter((d) => d.s >= span.from), key)} />
    </>
  );
}

/** Share of logged calories (in range) from foods that list a nutrient. */
function coverage(days: FoodDay[], key: MicroKey): number | null {
  let known = 0;
  let total = 0;
  for (const d of days) {
    const m = microDay(d.entries, key);
    total += d.t.kcal;
    if (m) known += m.covered * d.t.kcal;
  }
  return total ? known / total : null;
}

function Coverage({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  return (
    <Why>
      {pct >= 0.95
        ? 'Built-in foods and most packaged foods list this.'
        : `Counts foods that list it: ${Math.round(pct * 100)}% of your logged calories here. Quick adds and foods without it are left out, so the real amount is likely higher.`}
    </Why>
  );
}

// ---------- Personal records ----------

type RecordPick = { kind: 'lift'; id: string } | { kind: 'cardio'; sport: SportGroup; what: 'longest' | 'fastest' };

function RecordsGraph({ range }: { range: Range }) {
  const c = useColors();
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const lifts = useExercises(false);
  const sports = SPORT_GROUPS.filter((g) => g.id !== 'other' && state.cardio.sessions.some((x) => groupOf(x.type) === g.id));
  const options = [
    ...(on.lifting ? lifts.map((l) => ({ id: `lift:${l.id}`, label: l.label })) : []),
    ...(on.cardio
      ? sports.flatMap((g) => [
          { id: `cardio:${g.id}:longest`, label: `${g.label}: longest` },
          { id: `cardio:${g.id}:fastest`, label: `${g.label}: fastest` },
        ])
      : []),
  ];
  const [pickId, setPick] = useState<string | null>(null);
  const id = pickId ?? options[0]?.id ?? null;
  if (!id) return <NoData what="records" />;
  const parts = id.split(':');
  const pick: RecordPick = parts[0] === 'lift' ? { kind: 'lift', id: parts.slice(1).join(':') } : { kind: 'cardio', sport: parts[1] as SportGroup, what: parts[2] as 'longest' | 'fastest' };
  let span: RangeSpan;
  let lines: { pts: RecordPoint[]; color: string; label: string }[] = [];
  let unit = 'lb';
  let tick: ((v: number) => string) | undefined;
  let fmtV = (v: number) => `${fmtInt(v)} lb`;
  if (pick.kind === 'lift') {
    const h = liftRecordHistory(state.lifting, pick.id);
    span = rangeSpan(range, today, h.estimated[0]?.s ?? h.actual[0]?.s);
    lines = [
      { pts: h.estimated, color: c.ink, label: 'Estimated one-rep max' },
      { pts: h.actual, color: SERIES.fat, label: 'Actual single (1 rep)' },
    ];
  } else {
    const xs = state.cardio.sessions.filter((x) => groupOf(x.type) === pick.sport);
    const swim = pick.sport === 'swim';
    const bike = pick.sport === 'bike';
    const h = cardioRecordHistory(xs, swim ? 100 / METERS_PER_MILE : bike ? 5 : 1);
    const pts = pick.what === 'longest' ? h.longest : h.fastest;
    span = rangeSpan(range, today, pts[0]?.s);
    if (pick.what === 'longest') {
      unit = swim ? 'm' : 'mi';
      lines = [{ pts: pts.map((p) => ({ ...p, v: swim ? Math.round(p.v * METERS_PER_MILE) : p.v })), color: c.ink, label: 'Longest' }];
      fmtV = (v) => (swim ? `${fmtInt(v)} m` : `${fmt(v)} mi`);
    } else if (bike) {
      unit = 'mph';
      lines = [{ pts: pts.map((p) => ({ ...p, v: Math.round((3600 / p.v) * 10) / 10 })), color: c.ink, label: 'Fastest average speed' }];
      fmtV = (v) => `${fmt(v)} mph`;
    } else {
      unit = swim ? '/100m' : '/mi';
      const conv = (p: number) => Math.round(swim ? p / (METERS_PER_MILE / 100) : p);
      lines = [{ pts: pts.map((p) => ({ ...p, v: conv(p.v) })), color: c.ink, label: swim ? 'Fastest pace per 100 m' : 'Fastest pace (1 mi or more)' }];
      tick = (v) => fmtTime(Math.round(v));
      fmtV = (v) => `${fmtTime(v)} ${unit}`;
    }
  }
  const inRange = lines.map((l) => ({ ...l, pts: recordsIn(l.pts, span.from, span.to) }));
  const any = inRange.some((l) => l.pts.length);
  const best = lines.map((l) => ({ label: l.label, p: l.pts[l.pts.length - 1] })).filter((x) => x.p);
  return (
    <>
      <Choices options={options} value={id} onChange={setPick} />
      <ChartCaption>{cap(span, range === 'all' ? 'every new record, by date' : 'records set in this range')}</ChartCaption>
      {any ? (
        <LineChart
          label="Personal records"
          unit={unit}
          from={span.from}
          to={span.to}
          tick={tick}
          series={inRange.flatMap((l) => [
            { pts: l.pts, style: 'line' as const, color: l.color },
            { pts: l.pts, style: 'dots' as const, color: l.color },
          ])}
        />
      ) : (
        <Mute style={{ marginVertical: space.lg }}>No new records in this range. Try a longer one.</Mute>
      )}
      {lines.length > 1 ? <Legend items={lines.map((l) => ({ label: l.label, color: l.color, shape: 'line' as const }))} /> : null}
      {best.map((b) => (
        <Total key={b.label}>{`${b.label}: ${fmtV(b.p!.v)}${b.p!.text ? ` (${b.p!.text})` : ''}, ${shortDayLabel(b.p!.s)}`}</Total>
      ))}
      <Why>{pick.kind === 'lift' ? 'Each point is a new best. Estimated maxes come from sets of 2–12 reps; real singles (1 rep) are kept separate.' : 'Each point is a new best on that date.'}</Why>
    </>
  );
}

function Why({ children }: { children: ReactNode }) {
  return <Mute style={{ fontSize: 12.5, lineHeight: 17, marginTop: space.xs }}>{children}</Mute>;
}

// ---------- Calories ----------

function useKDays() {
  const { state } = useTracker();
  return useMemo(() => kDays(state), [state]);
}

function DeficitGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const ds = useKDays();
  const target = calTarget(state, today);
  const span = spanAt(range, today, ds[0]?.s, DAYS_WEEKS);
  const vals = avgByBucket(ds, (d) => d.s, (d) => d.net, span.buckets).map((v) => (v == null ? null : Math.round(v)));
  const inRange = ds.filter((d) => d.s >= span.from);
  const avg = inRange.length ? Math.round(inRange.reduce((t, d) => t + d.net, 0) / inRange.length) : null;
  return (
    <>
      <ChartCaption>{`${span.caption} · kcal ${avgPer(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="kcal" signed goal={target} label={`Calorie deficit, ${span.caption.toLowerCase()}`} />
      <ChartKey items={target ? ['deficit', 'surplus', 'goal'] : ['deficit', 'surplus']} />
      {avg != null ? <Total>{`Average ${avg >= 0 ? 'deficit' : 'surplus'}: ${fmtInt(Math.abs(avg))} kcal a day (${inRange.length} days logged)`}</Total> : <NoData />}
    </>
  );
}

function TotalDeficitGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const ds = useKDays();
  const span = rangeSpan(range, today, ds[0]?.s);
  const cum = ds.filter((d) => d.s >= span.from).reduce<{ s: string; v: number }[]>((acc, d) => [...acc, { s: d.s, v: (acc[acc.length - 1]?.v ?? 0) + d.net }], []);
  const total = cum[cum.length - 1]?.v ?? 0;
  return (
    <>
      <ChartCaption>{`${span.caption} · running total, kcal`}</ChartCaption>
      {cum.length >= 2 ? <LineChart label={`Total deficit, ${span.caption.toLowerCase()}`} zero unit="kcal" from={span.from} to={span.to} series={[{ pts: cum, style: 'line' }]} /> : <NoData two />}
      {cum.length ? <Total>{`${fmtInt(Math.abs(Math.round(total)))} kcal ${total >= 0 ? 'deficit' : 'surplus'} · about ${fmt(Math.round((Math.abs(total) / 3500) * 10) / 10)} lb ${total >= 0 ? 'lost' : 'gained'}`}</Total> : null}
    </>
  );
}

function WeightGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const all = useMemo(() => weightSeries(state.days, today, 100000), [state.days, today]);
  const trend = useMemo(() => weightTrend(all), [all]);
  const span = rangeSpan(range, today, all[0]?.s);
  const shown = all.filter((p) => p.s >= span.from);
  const ch = shown.length >= 2 ? Math.round((shown[shown.length - 1].v - shown[0].v) * 10) / 10 : null;
  return (
    <>
      <ChartCaption>{`${span.caption} · pounds`}</ChartCaption>
      {shown.length >= 2 ? (
        <>
          <LineChart label={`Weight, ${span.caption.toLowerCase()}`} unit="lb" from={span.from} to={span.to} series={[{ pts: shown, style: 'dots' }, { pts: trend.filter((p) => p.s >= span.from), style: 'line' }]} />
          <ChartKey items={['weight', 'trend']} />
        </>
      ) : (
        <NoData two what="weights" />
      )}
      {ch != null ? <Total>{`${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmt(Math.abs(ch))} lb in this range`}</Total> : null}
    </>
  );
}

function NoData({ two, what = 'days logged' }: { two?: boolean; what?: string }) {
  return <Mute style={{ marginVertical: space.lg }}>{two ? `Fewer than two ${what} in this range. Try a longer one.` : 'Nothing logged in this range.'}</Mute>;
}


// ---------- Decks ----------

const FOOD_GRAPHS: Graph[] = [
  { id: 'kcal', title: 'Calories eaten', Chart: CaloriesGraph },
  { id: 'macros', title: 'Macros', Chart: MacroGramsGraph },
  { id: 'macrogoal', title: 'Macro targets', Chart: MacroGoalGraph },
  { id: 'protein', title: 'Protein', Chart: ProteinGraph },
  { id: 'sources', title: 'Calorie sources', Chart: SourcesGraph },
  { id: 'fiber', title: 'Fiber', Chart: FiberGraph },
  { id: 'sugar', title: 'Sugar', Chart: SugarGraph },
  { id: 'sodium', title: 'Sodium', Chart: SodiumGraph },
  { id: 'meals', title: 'Meals', Chart: MealGraph },
  { id: 'micros', title: 'Vitamins and minerals', Chart: MicroGraph },
  { id: 'deficit', title: 'Calorie deficit', Chart: DeficitGraph },
  { id: 'total', title: 'Total deficit', Chart: TotalDeficitGraph },
  { id: 'weight', title: 'Weight', Chart: WeightGraph },
];

const CARDIO_GRAPHS: Graph[] = [
  { id: 'distance', title: 'Distance', Chart: DistanceGraph },
  { id: 'pace', title: 'Average pace', Chart: PaceGraph },
  { id: 'freq', title: 'How often', Chart: FrequencyGraph },
  { id: 'avgdist', title: 'Average distance', Chart: AvgDistanceGraph },
  { id: 'hr', title: 'Heart rate', Chart: HeartRateGraph },
  { id: 'time', title: 'Time', Chart: TimeGraph },
];

const LIFT_GRAPHS: Graph[] = [
  { id: 'workouts', title: 'Workouts', Chart: WorkoutsGraph },
  { id: 'e1rm', title: 'One-rep max', Chart: OneRepMaxGraph },
  { id: 'muscles', title: 'Sets per muscle', Chart: MuscleGraph },
  { id: 'reps', title: 'Reps per set', Chart: RepsGraph },
  { id: 'duration', title: 'Workout length', Chart: DurationGraph },
];

export function CalorieGraphs() {
  return <GraphDeck title="Food graphs" graphs={FOOD_GRAPHS} />;
}

export function CardioGraphs() {
  const { state } = useTracker();
  const have = SPORT_GROUPS.filter((g) => state.cardio.sessions.some((x) => groupOf(x.type) === g.id));
  const [sport, setSport] = useState<SportGroup | null>(null);
  const s = sport ?? (have.find((g) => g.id === 'run') ?? have[0])?.id ?? 'run';
  return (
    <SportCtx.Provider value={s}>
      <GraphDeck
        title="Cardio graphs"
        graphs={CARDIO_GRAPHS}
        header={have.length > 1 ? <Choices options={have.map((g) => ({ id: g.id, label: g.label }))} value={s} onChange={setSport} /> : null}
      />
    </SportCtx.Provider>
  );
}

export function LiftingGraphs() {
  return <GraphDeck title="Lifting graphs" graphs={LIFT_GRAPHS} />;
}

const RECORD_GRAPHS: Graph[] = [{ id: 'records', title: 'Personal records', Chart: RecordsGraph }];

/** Personal records for lifts and cardio. */
export function RecordGraphs() {
  return <GraphDeck title="Personal records" graphs={RECORD_GRAPHS} />;
}

const st = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gtitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semi, fontSize: 20, lineHeight: 24 },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm, marginBottom: space.md },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
});
