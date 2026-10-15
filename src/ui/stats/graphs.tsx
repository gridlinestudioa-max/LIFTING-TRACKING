import { useMemo, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  activeDiet,
  avgByBucket,
  bestSets,
  dailyEffort,
  dayDiff,
  fmt,
  fmtInt,
  fmtTime,
  kDays,
  liftRecords,
  rangeSpan,
  sumByBucket,
  sumTotals,
  trainingLoad,
  weightSeries,
  weightTrend,
  type Bucket,
  type Range,
  type RangeSpan,
} from '@/logic';

import { BarChart, ChartCaption, ChartKey, LineChart, RangeTabs } from '../charts';
import { Mute, Section } from '../components';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';

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
export function GraphDeck({ title, graphs }: { title: string; graphs: Graph[] }) {
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
const per = (span: RangeSpan) => (span.grain === 'day' ? 'per day' : `per ${span.per}`);
const avgPer = (span: RangeSpan) => (span.grain === 'day' ? 'per day' : `average per day, by ${span.per}`);
/** A dated point for each bucket that has a value, at the bucket's start: for lines over long ranges. */
const bucketPts = (buckets: Bucket[], vals: (number | null)[]) =>
  buckets.map((b, i) => (vals[i] == null ? null : { s: b.start, v: vals[i] as number })).filter((p): p is { s: string; v: number } => p != null);

function Total({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', marginTop: space.sm, ...tabular }}>{children}</Text>;
}

// ---------- Calories ----------

function useKDays() {
  const { state } = useTracker();
  return useMemo(() => kDays(state), [state]);
}

function DeficitGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const ds = useKDays();
  const span = rangeSpan(range, today, ds[0]?.s);
  const vals = avgByBucket(ds, (d) => d.s, (d) => d.net, span.buckets).map((v) => (v == null ? null : Math.round(v)));
  const inRange = ds.filter((d) => d.s >= span.from);
  const avg = inRange.length ? Math.round(inRange.reduce((t, d) => t + d.net, 0) / inRange.length) : null;
  return (
    <>
      <ChartCaption>{`${span.caption} · kcal ${avgPer(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="kcal" signed goal={state.goal} label={`Calorie deficit, ${span.caption.toLowerCase()}`} />
      <ChartKey items={state.goal ? ['deficit', 'surplus', 'goal'] : ['deficit', 'surplus']} />
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

function InOutGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const ds = useKDays();
  const span = rangeSpan(range, today, ds[0]?.s);
  const day = span.grain === 'day';
  const eaten = day ? ds.filter((d) => d.s >= span.from).map((d) => ({ s: d.s, v: d.cin })) : bucketPts(span.buckets, avgByBucket(ds, (d) => d.s, (d) => d.cin, span.buckets));
  const burned = day ? ds.filter((d) => d.s >= span.from).map((d) => ({ s: d.s, v: d.cout })) : bucketPts(span.buckets, avgByBucket(ds, (d) => d.s, (d) => d.cout, span.buckets));
  return (
    <>
      <ChartCaption>{`${span.caption} · kcal ${avgPer(span)}`}</ChartCaption>
      {eaten.length >= 2 ? (
        <>
          <LineChart label={`Calories eaten and burned, ${span.caption.toLowerCase()}`} zero unit="kcal" from={span.from} to={span.to} series={[{ pts: eaten, style: 'line' }, { pts: burned, style: 'dashed' }]} />
          <ChartKey items={['eaten', 'burned']} />
        </>
      ) : (
        <NoData two />
      )}
    </>
  );
}

function MacrosGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const days = useMemo(
    () =>
      Object.keys(state.meals)
        .filter((s) => state.meals[s]?.length && s <= today)
        .sort()
        .map((s) => ({ s, t: sumTotals(state.meals[s]) })),
    [state.meals, today],
  );
  const span = rangeSpan(range, today, days[0]?.s);
  const vals = avgByBucket(days, (d) => d.s, (d) => d.t.protein, span.buckets).map((v) => (v == null ? null : Math.round(v)));
  const inRange = days.filter((d) => d.s >= span.from);
  const avg = (k: 'protein' | 'carbs' | 'fat') => Math.round(inRange.reduce((t, d) => t + d.t[k], 0) / Math.max(inRange.length, 1));
  return (
    <>
      <ChartCaption>{`${span.caption} · protein, grams ${avgPer(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="g" goal={activeDiet(state.diet, state.profile).limits.proteinMin ?? null} label={`Protein, ${span.caption.toLowerCase()}`} />
      {inRange.length ? <Total>{`Average a day: ${avg('protein')} g protein · ${avg('carbs')} g carbs · ${avg('fat')} g fat`}</Total> : <NoData />}
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

// ---------- Cardio ----------

function useLand() {
  const { state, today } = useTracker();
  return useMemo(() => state.cardio.sessions.filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date)), [state.cardio.sessions, today]);
}

function DistanceGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const xs = useLand().filter((x) => x.type !== 'swim');
  const span = rangeSpan(range, today, xs[0]?.date);
  const vals = sumByBucket(xs, (x) => x.date, (x) => x.miles ?? 0, span.buckets).map((v) => Math.round(v * 10) / 10);
  const total = vals.reduce((a, b) => a + b, 0);
  return (
    <>
      <ChartCaption>{`${span.caption} · miles ${per(span)} (runs, rides, walks; not swims)`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="mi" label={`Distance, ${span.caption.toLowerCase()}`} />
      <Total>{`${fmt(Math.round(total * 10) / 10)} mi in this range`}</Total>
    </>
  );
}

function TimeGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const xs = useLand();
  const span = rangeSpan(range, today, xs[0]?.date);
  const mins = sumByBucket(xs, (x) => x.date, (x) => (x.secs ?? 0) / 60, span.buckets);
  const hours = span.grain !== 'day';
  const vals = mins.map((m) => (hours ? Math.round((m / 60) * 10) / 10 : Math.round(m)));
  const total = mins.reduce((a, b) => a + b, 0);
  return (
    <>
      <ChartCaption>{`${span.caption} · ${hours ? 'hours' : 'minutes'} ${per(span)}, all cardio`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit={hours ? 'h' : 'min'} label={`Time, ${span.caption.toLowerCase()}`} />
      <Total>{`${Math.floor(total / 60)} h ${Math.round(total % 60)} min in this range`}</Total>
    </>
  );
}

function PaceGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const runs = useLand().filter((x) => x.type === 'run' && x.miles && x.secs && x.miles >= 0.5);
  const span = rangeSpan(range, today, runs[0]?.date);
  const day = span.grain === 'day';
  const inRange = runs.filter((x) => x.date >= span.from);
  // Average pace per bucket is total time over total distance, so long runs count more.
  const miles = sumByBucket(runs, (x) => x.date, (x) => x.miles ?? 0, span.buckets);
  const secs = sumByBucket(runs, (x) => x.date, (x) => x.secs ?? 0, span.buckets);
  const pts = day
    ? inRange.map((x) => ({ s: x.date, v: Math.round((x.secs as number) / (x.miles as number)) }))
    : bucketPts(span.buckets, miles.map((m, i) => (m ? Math.round(secs[i] / m) : null)));
  const totM = inRange.reduce((t, x) => t + (x.miles ?? 0), 0);
  const totS = inRange.reduce((t, x) => t + (x.secs ?? 0), 0);
  return (
    <>
      <ChartCaption>{`${span.caption} · run pace, minutes per mile${day ? '' : `, by ${span.per}`} (lower is faster)`}</ChartCaption>
      {pts.length >= 2 ? (
        <LineChart label={`Run pace, ${span.caption.toLowerCase()}`} unit="/mi" from={span.from} to={span.to} tick={(v) => fmtTime(Math.round(v))} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} />
      ) : (
        <NoData two what="timed runs" />
      )}
      {totM ? <Total>{`Average pace ${fmtTime(Math.round(totS / totM))} /mi over ${fmt(Math.round(totM * 10) / 10)} mi`}</Total> : null}
    </>
  );
}

function EffortGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const perDay = useMemo(() => dailyEffort(state.cardio, state.profile, today), [state.cardio, state.profile, today]);
  const days = [...perDay.entries()].map(([s, v]) => ({ s, v })).sort((a, b) => a.s.localeCompare(b.s));
  const span = rangeSpan(range, today, days[0]?.s);
  const vals = sumByBucket(days, (d) => d.s, (d) => d.v, span.buckets).map(Math.round);
  return (
    <>
      <ChartCaption>{`${span.caption} · effort points ${per(span)} (time weighted by heart rate or how hard it felt)`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="pts" label={`Effort, ${span.caption.toLowerCase()}`} />
    </>
  );
}

function FitnessGraph({ range }: { range: Range }) {
  const { state, today } = useTracker();
  const firstDay = state.cardio.sessions.reduce<string | null>((m, x) => (!m || x.date < m ? x.date : m), null);
  const span = rangeSpan(range, today, firstDay);
  const load = useMemo(() => trainingLoad(state.cardio, state.profile, today, dayDiff(today, span.from) + 1), [state.cardio, state.profile, today, span.from]);
  const last = load[load.length - 1];
  return (
    <>
      <ChartCaption>{`${span.caption} · fitness (6-week average) and fatigue (1-week average), effort points a day`}</ChartCaption>
      {load.length >= 2 ? (
        <>
          <LineChart
            label={`Fitness and fatigue, ${span.caption.toLowerCase()}`}
            zero
            unit="pts"
            from={span.from}
            to={span.to}
            series={[
              { pts: load.map((d) => ({ s: d.s, v: Math.round(d.fitness * 10) / 10 })), style: 'line' },
              { pts: load.map((d) => ({ s: d.s, v: Math.round(d.fatigue * 10) / 10 })), style: 'dashed' },
            ]}
          />
          <ChartKey items={['fitness', 'fatigue']} />
        </>
      ) : (
        <NoData two what="activities" />
      )}
      {last ? <Total>{`Today: fitness ${fmt(Math.round(last.fitness))}, fatigue ${fmt(Math.round(last.fatigue))}${last.fatigue > last.fitness * 1.3 ? ' · take it easier' : ''}`}</Total> : null}
    </>
  );
}

// ---------- Lifting ----------

function useDone() {
  const { state, today } = useTracker();
  return useMemo(() => state.lifting.workouts.filter((w) => w.done && w.date <= today).sort((a, b) => a.date.localeCompare(b.date)), [state.lifting.workouts, today]);
}

function WorkoutsGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const span = rangeSpan(range, today, done[0]?.date);
  const vals = sumByBucket(done, (w) => w.date, () => 1, span.buckets);
  const total = vals.reduce((a, b) => a + b, 0);
  const weeks = Math.max(1, (dayDiff(span.to, span.from) + 1) / 7);
  return (
    <>
      <ChartCaption>{`${span.caption} · workouts ${per(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} label={`Workouts, ${span.caption.toLowerCase()}`} />
      <Total>{`${total} workouts · ${fmt(Math.round((total / weeks) * 10) / 10)} a week`}</Total>
    </>
  );
}

const volumeOf = (w: { exercises: { unit: string; sets: { w: number | null; reps: number | null; done: boolean }[] }[] }) =>
  w.exercises.reduce((t, e) => t + (e.unit === 'lb' ? e.sets.reduce((u, s) => u + (s.done && s.w && s.reps ? s.w * s.reps : 0), 0) : 0), 0);

function VolumeGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const span = rangeSpan(range, today, done[0]?.date);
  const k = span.grain !== 'day';
  const vals = sumByBucket(done, (w) => w.date, volumeOf, span.buckets).map((v) => (k ? Math.round(v / 100) / 10 : Math.round(v)));
  const total = done.filter((w) => w.date >= span.from).reduce((t, w) => t + volumeOf(w), 0);
  return (
    <>
      <ChartCaption>{`${span.caption} · volume (weight × reps), ${k ? 'thousands of lb' : 'lb'} ${per(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit={k ? 'k lb' : 'lb'} label={`Volume, ${span.caption.toLowerCase()}`} />
      <Total>{`${fmtInt(Math.round(total))} lb lifted in this range`}</Total>
    </>
  );
}

function SetsGraph({ range }: { range: Range }) {
  const { today } = useTracker();
  const done = useDone();
  const span = rangeSpan(range, today, done[0]?.date);
  const sets = (w: (typeof done)[number]) => w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  const vals = sumByBucket(done, (w) => w.date, sets, span.buckets);
  const inRange = done.filter((w) => w.date >= span.from);
  return (
    <>
      <ChartCaption>{`${span.caption} · sets done ${per(span)}`}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} unit="sets" label={`Sets, ${span.caption.toLowerCase()}`} />
      {inRange.length ? <Total>{`${fmtInt(inRange.reduce((t, w) => t + sets(w), 0))} sets · ${fmt(Math.round(inRange.reduce((t, w) => t + sets(w), 0) / inRange.length))} a workout`}</Total> : null}
    </>
  );
}

/** Estimated max for one lift over time. */
function liftGraph(exId: string, name: string, unit: string): Graph {
  function LiftGraph({ range }: { range: Range }) {
    const { state, today } = useTracker();
    const hist = useMemo(() => bestSets(state.lifting, exId), [state.lifting]);
    const span = rangeSpan(range, today, hist[0]?.date);
    const pts = hist.filter((h) => h.date >= span.from).map((h) => ({ s: h.date, v: Math.round(h.e1rm) }));
    const ch = pts.length >= 2 ? pts[pts.length - 1].v - pts[0].v : null;
    return (
      <>
        <ChartCaption>{`${span.caption} · estimated max (the most for one rep, from your best set), ${unit}`}</ChartCaption>
        {pts.length >= 2 ? <LineChart label={`${name} estimated max, ${span.caption.toLowerCase()}`} unit={unit} from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData two what="workouts with this lift" />}
        {ch != null ? <Total>{`${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmtInt(Math.abs(ch))} ${unit} in this range`}</Total> : null}
      </>
    );
  }
  return { id: `lift-${exId}`, title: name, Chart: LiftGraph };
}

function NoData({ two, what = 'days logged' }: { two?: boolean; what?: string }) {
  return <Mute style={{ marginVertical: space.lg }}>{two ? `Fewer than two ${what} in this range. Try a longer one.` : 'Nothing logged in this range.'}</Mute>;
}

// ---------- Decks ----------

const CALORIE_GRAPHS: Graph[] = [
  { id: 'deficit', title: 'Daily deficit', Chart: DeficitGraph },
  { id: 'total', title: 'Total deficit', Chart: TotalDeficitGraph },
  { id: 'inout', title: 'Eaten vs burned', Chart: InOutGraph },
  { id: 'macros', title: 'Protein and macros', Chart: MacrosGraph },
  { id: 'weight', title: 'Weight', Chart: WeightGraph },
];

const CARDIO_GRAPHS: Graph[] = [
  { id: 'distance', title: 'Distance', Chart: DistanceGraph },
  { id: 'time', title: 'Time', Chart: TimeGraph },
  { id: 'pace', title: 'Run pace', Chart: PaceGraph },
  { id: 'effort', title: 'Effort', Chart: EffortGraph },
  { id: 'fitness', title: 'Fitness and fatigue', Chart: FitnessGraph },
];

export function CalorieGraphs() {
  return <GraphDeck title="Calories graphs" graphs={CALORIE_GRAPHS} />;
}

export function CardioGraphs() {
  return <GraphDeck title="Cardio graphs" graphs={CARDIO_GRAPHS} />;
}

export function LiftingGraphs() {
  const { state } = useTracker();
  // Your three most-done lifts get a strength chart each.
  const top = useMemo(
    () =>
      liftRecords(state.lifting)
        .filter((r) => r.sessions >= 2)
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 3)
        .map((r) => liftGraph(r.exId, r.name, r.unit === 'plates' ? 'pl' : 'lb')),
    [state.lifting],
  );
  const graphs = useMemo<Graph[]>(
    () => [{ id: 'workouts', title: 'Workouts', Chart: WorkoutsGraph }, { id: 'volume', title: 'Volume', Chart: VolumeGraph }, { id: 'sets', title: 'Sets', Chart: SetsGraph }, ...top],
    [top],
  );
  return <GraphDeck title="Lifting graphs" graphs={graphs} />;
}

const st = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gtitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semi, fontSize: 20, lineHeight: 24 },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm, marginBottom: space.md },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
});
