import { createContext, useContext, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  METERS_PER_MILE,
  MEALS,
  MICROS,
  MUSCLE_GROUPS,
  SPORT_GROUPS,
  CYCLE_KIND_LABEL,
  CYCLE_PRESETS,
  activeCycle,
  addDays,
  avgBars,
  avgByBucket,
  HR_ZONES,
  climbBars,
  maxHeartRate,
  trainingDayEating,
  zoneBars,
  type DayTypeAverages,
  bucketTitle,
  dayDiff,
  calTarget,
  cycleEnd,
  cycleLine,
  cycleStatus,
  cardioBars,
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
  liftedExercises,
  macroCalories,
  macroTargets,
  mealKcal,
  microDay,
  microOf,
  microTarget,
  mondayOf,
  muscleBars,
  muscleGroupOf,
  plannedOn,
  rangeSpan,
  shortDayLabel,
  spanAt,
  statsOf,
  suggestTargets,
  targetText,
  weightSeries,
  weightTrend,
  type Bucket,
  type FoodDay,
  type GrainPlan,
  type MicroKey,
  type Range,
  type RangeSpan,
  type SportGroup,
} from '@/logic';

import { BarChart, ChartCaption, LineChart, RangeTabs, SERIES, StackedBarChart } from '../charts';
import { Mute, Section } from '../components';
import { LinkButton } from '../food/kit';
import { useLibrary } from '../lifting/library';
import { ChecklistDialog, Select } from '../Select';
import { useTracker } from '../store';
import { fonts, radius, space, useColors } from '../theme';

// Bar sizes for each range: what one bar (or point) covers.
const DAYS_WEEKS: GrainPlan = { week: 'day', month: 'day', year: 'week', all: 'month' };
const DAY_WEEK_WEEK: GrainPlan = { week: 'day', month: 'week', year: 'week', all: 'month' };
const DAY_WEEK_MONTH: GrainPlan = { week: 'day', month: 'week', year: 'month', all: 'month' };
const DAY_DAY_MONTH: GrainPlan = { week: 'day', month: 'day', year: 'month', all: 'month' };

/** What the info button shows: your target for this graph (if it has one) and what the graph means. */
export interface GraphInfo {
  /** Your target, in a sentence or a few lines. Null when the graph has none. */
  target?: string | null;
  about: string;
}

/** One chart in a deck: a title, the chart for a range, and its info. */
export interface Graph {
  id: string;
  title: string;
  Chart: ComponentType<{ range: Range }>;
  /** A hook: may read your data and settings. */
  useInfo: () => GraphInfo;
}

/**
 * A card that holds several charts for one area (food, cardio, lifting). Arrows (or the dots) move between
 * them; the Week / Month / Year / All choice stays the same as you go. "Choose" turns graphs on and off,
 * and the (i) next to a title explains it and shows your target.
 */
export function GraphDeck({ deck, title, graphs: all, header }: { deck: string; title: string; graphs: Graph[]; header?: ReactNode }) {
  const c = useColors();
  const { state, update } = useTracker();
  const hidden = state.settings.hiddenGraphs;
  const graphs = all.filter((g) => !hidden.includes(`${deck}:${g.id}`));
  const [i, setI] = useState(0);
  const [range, setRange] = useState<Range>('week');
  const [choosing, setChoosing] = useState(false);
  const [info, setInfo] = useState(false);
  const toggle = (id: string) =>
    update((s) => {
      const key = `${deck}:${id}`;
      const h = s.settings.hiddenGraphs;
      return { ...s, settings: { ...s.settings, hiddenGraphs: h.includes(key) ? h.filter((x) => x !== key) : [...h, key] } };
    });
  const chooser = (
    <ChecklistDialog
      visible={choosing}
      title={`Graphs to show`}
      options={all.map((g) => ({ value: g.id, label: g.title }))}
      isSelected={(id) => !hidden.includes(`${deck}:${id}`)}
      onPick={toggle}
      onClose={() => setChoosing(false)}
    />
  );
  const action = <LinkButton label="Choose" onPress={() => setChoosing(true)} />;
  if (!graphs.length) {
    return (
      <Section title={title} action={action}>
        <Mute>All of these graphs are turned off. Tap Choose to pick the ones you want.</Mute>
        {chooser}
      </Section>
    );
  }
  const n = graphs.length;
  const at = Math.min(i, n - 1);
  const g = graphs[at];
  const go = (d: number) => setI((at + d + n) % n);
  return (
    <Section title={title} action={action}>
      <View style={st.nav}>
        {n > 1 ? <Arrow label="‹" a11y={`Previous chart: ${graphs[(at - 1 + n) % n].title}`} onPress={() => go(-1)} /> : <View style={st.arrowGap} />}
        <View style={st.titleWrap}>
          <Text style={[st.gtitle, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
            {g.title}
          </Text>
          <InfoButton title={g.title} onPress={() => setInfo(true)} />
        </View>
        {n > 1 ? <Arrow label="›" a11y={`Next chart: ${graphs[(at + 1) % n].title}`} onPress={() => go(1)} /> : <View style={st.arrowGap} />}
      </View>
      {n > 1 ? (
        <View style={st.dots}>
          {graphs.map((x, j) => (
            <Pressable key={x.id} onPress={() => setI(j)} accessibilityRole="button" accessibilityLabel={`Show ${x.title}`} hitSlop={6}>
              <View style={[st.dot, { backgroundColor: j === at ? c.ink : c.line }]} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ height: space.md }} />
      )}
      {header}
      <RangeTabs value={range} onChange={setRange} />
      <g.Chart key={g.id} range={range} />
      {info ? <InfoCard key={`info-${g.id}`} g={g} onClose={() => setInfo(false)} /> : null}
      {chooser}
    </Section>
  );
}

/** The (i) next to a graph's title. */
function InfoButton({ title, onPress }: { title: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`About ${title} and your target`}
      hitSlop={10}
      style={({ pressed }) => [st.info, { borderColor: c.mute, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: c.mute, fontSize: 13, fontWeight: '800', fontStyle: 'italic', lineHeight: 15 }}>i</Text>
    </Pressable>
  );
}

/** A card over the page: your target for the graph, then what it shows and how it's worked out. */
function InfoCard({ g, onClose }: { g: Graph; onClose: () => void }) {
  const c = useColors();
  const info = g.useInfo();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[st.card, { backgroundColor: c.card }]} accessibilityViewIsModal>
        <Text style={[st.cardTitle, { color: c.ink }]}>{g.title}</Text>
        <Text style={[st.cardHead, { color: c.mute }]}>YOUR TARGET</Text>
        <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>{info.target ?? 'This graph has no target. It shows how things change over time.'}</Text>
        <Text style={[st.cardHead, { color: c.mute }]}>ABOUT THIS GRAPH</Text>
        <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>{info.about}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [st.cardDone, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={{ color: c.card, fontWeight: '700', fontSize: 15 }}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
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
/** Each bar's full name for the tap readout: "Tue, Oct 13", "Oct 5 – 11", "October 2026". */
const titles = (span: RangeSpan) => span.buckets.map(bucketTitle);
/** The readout title for a point drawn at a bucket's start. */
const titleOf = (span: RangeSpan) => (s: string) => bucketTitle(span.buckets.find((b) => b.start === s) ?? { start: s, end: s });
const avgPer = (span: RangeSpan) => (span.grain === 'day' ? 'per day' : `average per day, by ${span.per}`);
/** A dated point for each bucket that has a value, at the bucket's start: for lines over long ranges. */
const bucketPts = (buckets: Bucket[], vals: (number | null)[]) =>
  buckets.map((b, i) => (vals[i] == null ? null : { s: b.start, v: vals[i] as number })).filter((p): p is { s: string; v: number } => p != null);



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

/** A dropdown of choices (sports, exercises, nutrients). */
function Choices<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return <Select label={label} value={value} options={options.map((o) => ({ value: o.id, label: o.label }))} onChange={onChange} style={{ marginBottom: space.sm }} />;
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit={distUnit(swim)} label={`Distance, ${span.caption.toLowerCase()}`} summary={{ title: `${swim ? fmtInt(sumOf(vals)) : fmt(Math.round(sumOf(vals) * 10) / 10)} ${distUnit(swim)} in ${fmtInt(sumOf(b.count))} ${w.many}` }} />
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
        <LineChart label={`Pace, ${span.caption.toLowerCase()}`} unit={unit} from={span.from} to={span.to} tick={bike ? undefined : (v) => fmtTime(Math.round(v))} format={show} titleFor={titleOf(span)} summary={overall != null ? { title: `Average ${bike ? 'speed' : 'pace'}: ${show(overall)}` } : undefined} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} />
      ) : (
        <NoData what={`timed ${w.many}`} />
      )}
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
      <BarChart values={b.count} labels={labels(span)} titles={titles(span)} unit={w.many} format={(v) => `${fmtInt(v)} ${v === 1 ? w.one : w.many}`} label={`Number of ${w.many}, ${span.caption.toLowerCase()}`} summary={{ title: `${fmtInt(sumOf(b.count))} ${w.many} · ${fmt(Math.round((sumOf(b.count) / weeks) * 10) / 10)} a week` }} />
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
      {pts.length ? <LineChart label={`Average distance per ${w.one}`} zero unit={distUnit(swim)} from={span.from} to={span.to} titleFor={titleOf(span)} summary={n ? { title: swim ? `${fmtInt(Math.round((total * METERS_PER_MILE) / n))} m per ${w.one} on average` : `${fmt(Math.round((total / n) * 10) / 10)} mi per ${w.one} on average` } : undefined} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData />}
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
      {pts.length ? <LineChart label={`Average heart rate, ${span.caption.toLowerCase()}`} unit="bpm" from={span.from} to={span.to} titleFor={titleOf(span)} summary={avg != null ? { title: `Average ${avg} bpm over ${inRange.length} ${inRange.length === 1 ? w.one : w.many}` } : undefined} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData what={`${w.many} with heart rate`} />}
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit={hours ? 'h' : 'min'} label={`Time, ${span.caption.toLowerCase()}`} summary={{ title: `${Math.floor(mins / 60)} h ${mins % 60} min of ${w.many}` }} />
    </>
  );
}

const ZONE_COLORS = ['#9aa4ad', '#4a9fd8', '#2e9e72', '#e0a31b', '#d64545'];

function ZonesGraph({ range }: { range: Range }) {
  const { state } = useTracker();
  const { sessions, today, w } = useSport();
  const withHr = sessions.filter((x) => x.hr && x.secs);
  const age = statsOf(state.profile, today)?.age ?? null;
  const max = maxHeartRate(state.cardio.sessions, age);
  const span = spanAt(range, today, withHr[0]?.date, DAY_WEEK_MONTH);
  if (!max) return <Mute style={{ marginVertical: space.lg }}>Add your birthday (Settings → Your details) or a max heart rate to a workout to see heart-rate zones.</Mute>;
  const z = zoneBars(withHr, span.buckets, max);
  const series = HR_ZONES.map((x, i) => ({ label: `${x.label} ${x.name.toLowerCase()}`, color: ZONE_COLORS[i], values: z[i] }));
  const tot = z.map((v) => sumOf(v));
  const all = sumOf(tot);
  return (
    <>
      <ChartCaption>{cap(span, `minutes in each zone, ${byWhat(span)}`)}</ChartCaption>
      {withHr.length ? (
        <StackedBarChart
          series={series}
          labels={labels(span)}
          titles={titles(span)}
          unit="min"
          format={(v) => `${fmtInt(v)} min`}
          label={`Heart-rate zones, ${span.caption.toLowerCase()}`}
          summary={all ? { title: `${fmtInt(all)} min with heart rate · max ${max} bpm`, items: series.map((x, i) => ({ label: HR_ZONES[i].label, value: `${Math.round((tot[i] / all) * 100)}%`, color: x.color })).filter((_, i) => tot[i] > 0) } : { title: 'Nothing logged in this range' }}
        />
      ) : (
        <NoData what={`${w.many} with heart rate`} />
      )}
    </>
  );
}

function ClimbGraph({ range }: { range: Range }) {
  const { sessions, today, w } = useSport();
  const span = spanAt(range, today, sessions[0]?.date, DAYS_WEEKS);
  const vals = climbBars(sessions, span.buckets);
  const total = sumOf(vals);
  return (
    <>
      <ChartCaption>{cap(span, `feet climbed ${byWhat(span)}`)}</ChartCaption>
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit="ft" format={(v) => `${fmtInt(v)} ft`} label={`Climbing, ${span.caption.toLowerCase()}`} summary={total ? { title: `${fmtInt(total)} ft climbed in ${fmtInt(sessions.filter((x) => x.date >= span.from && x.elevFt).length)} ${w.many}` } : { title: 'No climbing logged in this range' }} />
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
  const opts = list.map((e) => ({ id: e.exId, label: e.name }));
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
      <BarChart values={b.workouts} labels={labels(span)} titles={titles(span)} unit="workouts" format={(v) => `${fmtInt(v)} ${v === 1 ? 'workout' : 'workouts'}`} label={`Workouts, ${span.caption.toLowerCase()}`} summary={{ title: `${sumOf(b.workouts)} workouts · ${fmt(Math.round((sumOf(b.workouts) / weeks) * 10) / 10)} a week` }} />
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
      <Choices label="Exercise" options={opts} value={id} onChange={setEx} />
      <ChartCaption>{cap(span, `best estimated one-rep max (lb), by ${span.grain === 'day' ? 'workout' : span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label="Estimated one-rep max" unit="lb" from={span.from} to={span.to} titleFor={titleOf(span)} format={(v) => `${fmtInt(v)} lb`} summary={{ title: `Best ${fmtInt(Math.max(...known))} lb${ch != null ? ` · ${ch >= 0 ? '+' : '−'}${fmtInt(Math.abs(ch))} lb in this range` : ''}` }} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData what="sets of 12 reps or fewer" />}
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
      <StackedBarChart
        series={series}
        labels={labels(span)}
        titles={titles(span)}
        unit="sets"
        format={(v) => `${fmtInt(v)}`}
        label={`Sets per muscle group, ${span.caption.toLowerCase()}`}
        summary={totals.length ? { title: `${fmtInt(totals.reduce((t, x) => t + x.n, 0))} sets in this range`, items: totals.map((t) => ({ label: t.label, value: fmtInt(t.n), color: series.find((x) => x.label === t.label)!.color })) } : { title: 'Nothing logged in this range' }}
      />
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
      <Choices label="Exercise" options={opts} value={ex} onChange={setEx} />
      <ChartCaption>{cap(span, `average reps per set, by ${span.grain === 'day' ? 'workout' : span.grain}`)}</ChartCaption>
      {pts.length ? <LineChart label="Average reps per set" zero unit="reps" from={span.from} to={span.to} titleFor={titleOf(span)} summary={avg != null ? { title: `About ${fmt(Math.round(avg * 10) / 10)} reps a set` } : undefined} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} /> : <NoData />}
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
      <BarChart values={b.minutes} labels={labels(span)} titles={titles(span)} unit="min" label={`Workout length, ${span.caption.toLowerCase()}`} summary={avg != null ? { title: `About ${fmtInt(Math.round(avg))} min a workout` } : { title: 'No timed workouts in this range' }} />
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit="kcal" format={(v) => `${fmtInt(v)} kcal`} goal={kcal} label={`Calories eaten, ${span.caption.toLowerCase()}`} summary={avg != null ? { title: `Average ${fmtInt(Math.round(avg))} kcal a day${kcal ? ` · target ${fmtInt(kcal)}` : ''} (${n} days logged)` } : { title: 'Nothing logged in this range' }} />
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
      <StackedBarChart
        series={series}
        labels={labels(span)}
        titles={titles(span)}
        unit="g"
        format={(v) => `${fmtInt(Math.round(v))} g`}
        label={`Macros in grams, ${span.caption.toLowerCase()}`}
        summary={avgOf(p) != null ? { title: 'Average a day', items: [{ label: 'Protein', value: `${a(p)} g`, color: SERIES.protein }, { label: 'Carbs', value: `${a(cb)} g`, color: SERIES.carbs }, { label: 'Fat', value: `${a(f)} g`, color: SERIES.fat }] } : { title: 'Nothing logged in this range' }}
      />
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
    return [{ pts, style: 'line' as const, color: x.color, name: x.label }, { pts, style: 'dots' as const, color: x.color }];
  });
  return (
    <>
      <ChartCaption>{cap(span, `% of each daily target, ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      {series.some((s) => s.pts.length) ? (
        <LineChart
          label="Macro targets reached"
          zero
          unit="%"
          format={(v) => `${fmtInt(v)}%`}
          from={span.from}
          to={span.to}
          titleFor={titleOf(span)}
          refs={[{ v: 100 }]}
          series={series}
          summary={{ title: 'Average of target (dashed line = 100%)', items: lines.map((x) => ({ label: x.label, value: `${fmtInt(Math.round(avgOf(x.v!) ?? 0))}%`, color: x.color })) }}
        />
      ) : (
        <NoData />
      )}
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit="g" goal={target} label={`Protein, ${span.caption.toLowerCase()}`} summary={inRange.length ? { title: `Average ${fmtInt(Math.round(avgOf(vals) ?? 0))} g a day${hit != null ? ` · target met ${hit} of ${inRange.length} days` : ''}` } : { title: 'Nothing logged in this range' }} />
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
      <StackedBarChart
        series={series}
        labels={labels(span)}
        titles={titles(span)}
        percent
        label={`Calorie sources, ${span.caption.toLowerCase()}`}
        summary={all ? { title: 'Share of calories in this range', items: [{ label: 'Protein', value: pc(tot.p), color: SERIES.protein }, { label: 'Carbs', value: pc(tot.c), color: SERIES.carbs }, { label: 'Fat', value: pc(tot.f), color: SERIES.fat }] } : { title: 'Nothing logged in this range' }}
      />
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit="g" goal={target} label={`Fiber, ${span.caption.toLowerCase()}`} summary={avg != null ? { title: `Average ${fmtInt(Math.round(avg))} g a day · aim for ${target} g` } : { title: 'Nothing logged in this range' }} />
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
          titleFor={titleOf(span)}
          summary={{
            title: `Average a day · added sugar limit ${limit} g (dashed)`,
            items: [
              { label: 'Total sugar', value: `${fmt(Math.round(avgOf(total) ?? 0))} g`, color: SERIES.carbs },
              { label: 'Added sugar', value: avgOf(added) != null ? `${fmt(Math.round(avgOf(added)!))} g` : '–', color: SERIES.fat },
            ],
          }}
          series={[
            { pts: tp, style: 'line', color: SERIES.carbs, name: 'Total sugar' },
            { pts: tp, style: 'dots', color: SERIES.carbs },
            { pts: ap, style: 'line', color: SERIES.fat, name: 'Added sugar' },
            { pts: ap, style: 'dots', color: SERIES.fat },
          ]}
        />
      ) : (
        <NoData />
      )}
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
      <BarChart values={vals} labels={labels(span)} titles={titles(span)} unit="mg" format={(v) => `${fmtInt(v)} mg`} goal={2300} label={`Sodium, ${span.caption.toLowerCase()}`} summary={avgOf(vals) != null ? { title: `Average ${fmtInt(Math.round(avgOf(vals)!))} mg a day · limit 2,300 mg${coverNote(cover)}` } : { title: 'Nothing logged in this range' }} />
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
      <StackedBarChart
        series={series}
        labels={labels(span)}
        titles={titles(span)}
        unit="kcal"
        format={(v) => `${fmtInt(Math.round(v))} kcal`}
        label={`Calories by meal, ${span.caption.toLowerCase()}`}
        summary={inRange.length ? { title: 'Average a day, kcal', items: avgMeal.map((m, i) => ({ label: m.label, value: fmtInt(Math.round(m.v)), color: series[i].color })) } : { title: 'Nothing logged in this range' }}
      />
    </>
  );
}

function TrainingDaysGraph({ range }: { range: Range }) {
  const { days, today } = useFood();
  const { state } = useTracker();
  const span = rangeSpan(range, today, days[0]?.s);
  const trainedOn = useMemo(() => {
    const set = new Set<string>();
    for (const x of state.cardio.sessions) set.add(x.date);
    for (const x of state.lifting.workouts) if (x.done) set.add(x.date);
    return set;
  }, [state.cardio.sessions, state.lifting.workouts]);
  const r = trainingDayEating(days.filter((d) => d.s >= span.from && d.s <= span.to), (s) => trainedOn.has(s));
  const line = (x: DayTypeAverages) => `${fmtInt(Math.round(x.kcal))} kcal · ${fmtInt(Math.round(x.protein))} g protein · ${fmtInt(Math.round(x.carbs))} g carbs`;
  return (
    <>
      <ChartCaption>{`${span.caption} · average kcal eaten a day`}</ChartCaption>
      {r.training || r.rest ? (
        <BarChart
          values={[r.training ? Math.round(r.training.kcal) : null, r.rest ? Math.round(r.rest.kcal) : null]}
          labels={['Training days', 'Rest days']}
          titles={[`Training days (${r.training?.days ?? 0})`, `Rest days (${r.rest?.days ?? 0})`]}
          unit="kcal"
          format={(v) => `${fmtInt(v)} kcal`}
          label="Eating on training days and rest days"
          summary={{
            title: r.training && r.rest ? `${fmtInt(Math.abs(Math.round(r.training.kcal - r.rest.kcal)))} kcal ${r.training.kcal >= r.rest.kcal ? 'more' : 'less'} on training days` : 'Average a day',
            items: [r.training ? { label: 'Training', value: line(r.training) } : null, r.rest ? { label: 'Rest', value: line(r.rest) } : null].filter((x): x is { label: string; value: string } => !!x),
          }}
        />
      ) : (
        <NoData />
      )}
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
      <Choices label="Nutrient" options={MICRO_CHOICES.map((m) => ({ id: m.key, label: m.label }))} value={key} onChange={setKey} />
      <ChartCaption>{cap(span, `${def.unit} of ${def.label.toLowerCase()} ${byWhat(span, span.grain !== 'day')}`)}</ChartCaption>
      <BarChart
        values={vals}
        labels={labels(span)}
        titles={titles(span)}
        unit={def.unit}
        format={(v) => `${amt(v)} ${def.unit}`}
        goal={target}
        label={`${def.label}, ${span.caption.toLowerCase()}`}
        summary={avg != null ? { title: `Average ${amt(avg)} ${def.unit} a day · aim for ${amt(target)} ${def.unit}${coverNote(coverage(days.filter((d) => d.s >= span.from), key))}` } : { title: 'Nothing logged in this range' }}
      />
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

/** A short note when some logged food doesn't list a nutrient, so the real amount is likely higher. */
const coverNote = (pct: number | null) => (pct != null && pct < 0.95 ? ` (listed for ${Math.round(pct * 100)}% of logged calories)` : '');

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
      <BarChart
        values={vals}
        labels={labels(span)}
        titles={titles(span)}
        unit="kcal"
        format={(v) => `${fmtInt(Math.abs(v))} kcal ${v >= 0 ? 'deficit' : 'surplus'}`}
        signed
        goal={target}
        label={`Calorie deficit, ${span.caption.toLowerCase()}`}
        summary={avg != null ? { title: `Average ${avg >= 0 ? 'deficit' : 'surplus'}: ${fmtInt(Math.abs(avg))} kcal a day (${inRange.length} days logged)` } : { title: 'Nothing logged in this range' }}
      />
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
      {cum.length >= 2 ? (
        <LineChart
          label={`Total deficit, ${span.caption.toLowerCase()}`}
          zero
          unit="kcal"
          format={(v) => `${fmtInt(Math.abs(Math.round(v)))} kcal ${v >= 0 ? 'deficit' : 'surplus'} so far`}
          from={span.from}
          to={span.to}
          series={[{ pts: cum, style: 'line' }]}
          summary={{ title: `${fmtInt(Math.abs(Math.round(total)))} kcal ${total >= 0 ? 'deficit' : 'surplus'} · about ${fmt(Math.round((Math.abs(total) / 3500) * 10) / 10)} lb ${total >= 0 ? 'lost' : 'gained'}` }}
        />
      ) : (
        <NoData two />
      )}
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
          <LineChart
            label={`Weight, ${span.caption.toLowerCase()}`}
            unit="lb"
            format={(v) => `${fmt(Math.round(v * 10) / 10)} lb`}
            from={span.from}
            to={span.to}
            series={[{ pts: shown, style: 'dots', name: 'Weighed' }, { pts: trend.filter((p) => p.s >= span.from), style: 'line', name: 'Trend' }]}
            summary={ch != null ? { title: `${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmt(Math.abs(ch))} lb in this range` } : undefined}
          />
        </>
      ) : (
        <NoData two what="weights" />
      )}
    </>
  );
}

function NoData({ two, what = 'days logged' }: { two?: boolean; what?: string }) {
  return <Mute style={{ marginVertical: space.lg }}>{two ? `Fewer than two ${what} in this range. Try a longer one.` : 'Nothing logged in this range.'}</Mute>;
}


// ---------- Targets (for the info card) ----------

const NO_KCAL = 'No calorie target yet. Add your details in Settings → Your details, or start a cut, bulk or maintenance plan (Progress → Cut, bulk or maintain).';

/** Your calorie, protein, carb and fat targets, as the food graphs use them. */
function useFoodTargets() {
  const f = useFood();
  const { state, today } = useTracker();
  const cy = activeCycle(state.cycle, today);
  const carbCap = f.style === 'keto' || f.style === 'lowcarb' ? (f.limits.netCarbsMax ?? null) : null;
  const t = macroTargets(f.kcal, f.limits.proteinMin ?? null, f.limits.fatPctMax ?? null, carbCap);
  const plan = cy ? ` (${CYCLE_PRESETS.find((p) => p.id === cy.preset)?.name ?? CYCLE_KIND_LABEL[cy.kind]})` : '';
  const kcalLine = f.kcal ? `Eat about ${fmtInt(f.kcal)} kcal a day${plan}.` : null;
  const macroLine = t.protein || t.carbs || t.fat
    ? [t.protein ? `Protein ${fmtInt(t.protein)} g` : null, t.carbs ? `Carbs ${fmtInt(t.carbs)} g` : null, t.fat ? `Fat ${fmtInt(t.fat)} g` : null].filter(Boolean).join(' · ') + ' a day.'
    : null;
  return { ...f, t, kcalLine, macroLine };
}

const foodInfo = (about: string, pick: (x: ReturnType<typeof useFoodTargets>) => string | null) =>
  function useInfo(): GraphInfo {
    const x = useFoodTargets();
    return { target: pick(x), about };
  };

/** This week's plan for the sport the cardio graphs show. */
function useCardioTarget(what: 'count' | 'miles' | 'both'): string {
  const { state, today } = useTracker();
  const sport = useContext(SportCtx);
  const w = SPORT_WORD[sport];
  const monday = mondayOf(today);
  const planned = Array.from({ length: 7 }, (_, i) => plannedOn(state.cardio.plan, addDays(monday, i))).flat().filter((p) => p.sport === sport);
  if (!planned.length) return `No ${w.one} plan this week. Pick a plan on the Cardio tab to get weekly targets.`;
  const miles = planned.reduce((t, p) => t + p.miles, 0);
  const dist = sport === 'swim' ? `${fmtInt(Math.round(miles * METERS_PER_MILE))} m` : `${fmt(Math.round(miles * 10) / 10)} mi`;
  const n = `${planned.length} ${planned.length === 1 ? w.one : w.many}`;
  return `Your plan this week: ${what === 'count' ? n : what === 'miles' ? dist : `${n}, ${dist} in all`}.`;
}

const cardioInfo = (about: (sport: SportGroup) => string, what: 'count' | 'miles' | 'both' | null) =>
  function useInfo(): GraphInfo {
    const sport = useContext(SportCtx);
    // Always called, so the hooks run in the same order.
    const plan = useCardioTarget(what ?? 'both');
    return { target: what ? plan : null, about: about(sport) };
  };

function useLiftSchedule(): string {
  const { state } = useTracker();
  const n = state.lifting.schedule.filter(Boolean).length;
  return n ? `Your schedule: ${n} ${n === 1 ? 'workout' : 'workouts'} a week.` : 'No weekly schedule yet. Pick a plan or set routines on days on the Lifting tab.';
}

// ---------- Decks ----------

const FOOD_GRAPHS: Graph[] = [
  {
    id: 'kcal', title: 'Calories eaten', Chart: CaloriesGraph,
    useInfo: foodInfo('Calories you ate, from your food log: each bar is a day, or the average day in a week or month. Only days with food logged count, so a day you forgot to log doesn’t pull the average down. The dashed line is your target.', (x) => x.kcalLine ?? NO_KCAL),
  },
  {
    id: 'macros', title: 'Macros', Chart: MacroGramsGraph,
    useInfo: foodInfo('Grams of protein, carbs and fat you ate, stacked, on days you logged food.', (x) => x.macroLine),
  },
  {
    id: 'macrogoal', title: 'Macro targets', Chart: MacroGoalGraph,
    useInfo: foodInfo('How close you got to each macro target, as a percent, so protein, carbs and fat compare fairly. 100% is right on target. Carbs and fat come from your calorie target (fat 30% of calories, carbs the rest) unless your diet sets them.', (x) => x.macroLine ?? NO_KCAL),
  },
  {
    id: 'protein', title: 'Protein', Chart: ProteinGraph,
    useInfo: foodInfo('Grams of protein a day, against your target. Eating enough protein, steadily, matters most for building and keeping muscle, especially while cutting.', (x) => (x.limits.proteinMin ? `At least ${fmtInt(x.limits.proteinMin)} g of protein a day.` : 'No protein target yet. Add your weight in Settings → Your details.')),
  },
  {
    id: 'sources', title: 'Calorie sources', Chart: SourcesGraph,
    useInfo: foodInfo('The share of your calories from protein, carbs and fat. Protein and carbs have 4 kcal a gram and fat 9, so it may not match logged calories exactly (fiber, alcohol and label rounding).', (x) => {
      const { protein: p, carbs: cb, fat: f } = x.t;
      if (!x.kcal || !p || !cb || !f) return null;
      const pc = (g: number, k: number) => `${Math.round(((g * k) / x.kcal!) * 100)}%`;
      return `About ${pc(p, 4)} protein, ${pc(cb, 4)} carbs and ${pc(f, 9)} fat.`;
    }),
  },
  {
    id: 'fiber', title: 'Fiber', Chart: FiberGraph,
    useInfo: foodInfo('Grams of fiber a day. Fiber helps you feel full and is a good sign of overall diet quality. The target is about 14 g per 1,000 kcal.', (x) => `At least ${fiberTarget(x.sex, x.kcal)} g of fiber a day.`),
  },
  {
    id: 'sugar', title: 'Sugar', Chart: SugarGraph,
    useInfo: foodInfo('Total sugar includes the natural sugar in fruit and milk. Added sugar is what’s put in during cooking or processing; keep it under 10% of calories. Only packaged foods that list added sugar count toward it.', (x) => `Under ${microTarget('addedSugar', null, null, x.kcal)} g of added sugar a day.`),
  },
  {
    id: 'sodium', title: 'Sodium', Chart: SodiumGraph,
    useInfo: foodInfo('Milligrams of sodium a day. Most of it comes from packaged and restaurant food rather than the salt shaker.', () => 'Under 2,300 mg of sodium a day.'),
  },
  {
    id: 'meals', title: 'Meals', Chart: MealGraph,
    useInfo: foodInfo('Average calories at breakfast, lunch, dinner and snacks on days you logged food. There’s no best split: use it to see where your calories go.', (x) => (x.kcalLine ? `${x.kcalLine} Split it across meals however suits you.` : null)),
  },
  {
    id: 'micros', title: 'Vitamins and minerals', Chart: MicroGraph,
    useInfo: foodInfo('Pick a nutrient from the list. Targets are daily reference amounts for adults (US Dietary Reference Intakes) for your sex and age. Only foods that list the nutrient count, so the real amount is often higher.', (x) =>
      MICRO_CHOICES.map((m) => `${m.label}: ${amt(microTarget(m.key, x.sex, x.age, x.kcal))} ${m.unit}`).join('\n'),
    ),
  },
  {
    id: 'trainingdays', title: 'Training vs rest days', Chart: TrainingDaysGraph,
    useInfo: foodInfo('Average calories, protein and carbs on days you trained (any run, ride, swim or lifting workout) against days you didn’t. Tap a bar to see each side. Training days usually call for more carbs; protein matters every day.', (x) => x.macroLine),
  },
  {
    id: 'deficit', title: 'Calorie deficit', Chart: DeficitGraph,
    useInfo: function useInfo() {
      const { state, today } = useTracker();
      const t = calTarget(state, today);
      return {
        target: t != null ? `${targetText(t)}.` : NO_KCAL,
        about: 'Calories burned minus calories eaten each day. Green bars are a deficit (you ate less than you burned), red bars a surplus. The dashed line is your target.',
      };
    },
  },
  {
    id: 'total', title: 'Total deficit', Chart: TotalDeficitGraph,
    useInfo: function useInfo() {
      const { state, today } = useTracker();
      const cy = activeCycle(state.cycle, today);
      const t = calTarget(state, today);
      return {
        target: cy ? `${cycleLine(cy)}, until ${shortDayLabel(cycleEnd(cy))}.` : t != null ? `${targetText(t)}.` : null,
        about: 'Each day’s deficit or surplus added up over the range. About 3,500 kcal is roughly a pound of body weight, so it estimates what you’ve lost or gained.',
      };
    },
  },
  {
    id: 'weight', title: 'Weight', Chart: WeightGraph,
    useInfo: function useInfo() {
      const { state, today } = useTracker();
      const cy = activeCycle(state.cycle, today);
      const trend = weightTrend(weightSeries(state.days, today, 60));
      const now = trend[trend.length - 1]?.v ?? null;
      const s = cy ? cycleStatus(cy, today, now) : null;
      return {
        target: cy && s ? `Expected about ${fmt(s.expectedLb)} lb by now on your ${CYCLE_KIND_LABEL[cy.kind].toLowerCase()}${s.verdict ? ` (${s.verdict.toLowerCase()})` : ''}.` : null,
        about: 'Dots are your weigh-ins; the line is a smoothed trend, so day-to-day water and food swings don’t hide the real direction. Weigh in at the same time of day for the clearest trend.',
      };
    },
  },
];

const CARDIO_GRAPHS: Graph[] = [
  { id: 'distance', title: 'Distance', Chart: DistanceGraph, useInfo: cardioInfo(() => 'Total distance for each day, week or month: whether your training volume is building or slipping.', 'miles') },
  {
    id: 'pace', title: 'Average pace', Chart: PaceGraph,
    useInfo: cardioInfo((sport) => `Total time divided by total distance (moving time when recorded), so longer ${SPORT_WORD[sport].many} count more. ${sport === 'bike' ? 'Shown as speed: higher is faster.' : 'Lower is faster.'}`, null),
  },
  { id: 'freq', title: 'How often', Chart: FrequencyGraph, useInfo: cardioInfo((sport) => `How many ${SPORT_WORD[sport].many} you did. Showing up consistently usually comes before getting faster.`, 'count') },
  { id: 'avgdist', title: 'Average distance', Chart: AvgDistanceGraph, useInfo: cardioInfo((sport) => `The distance of a typical ${SPORT_WORD[sport].one}: whether they’re getting longer, apart from how often you go.`, null) },
  { id: 'hr', title: 'Heart rate', Chart: HeartRateGraph, useInfo: cardioInfo(() => 'Average heart rate, weighted by how long each session lasted. A lower heart rate at the same pace usually means better aerobic fitness. Add heart rate when you log, or import it from a watch.', null) },
  {
    id: 'zones', title: 'Heart-rate zones', Chart: ZonesGraph,
    useInfo: cardioInfo(() => 'Minutes in each heart-rate zone, as a share of your max heart rate: zone 1 under 60%, zone 2 60–70% (easy, where most training should be), zone 3 70–80%, zone 4 80–90%, zone 5 90% or more. Max heart rate is your highest recorded, or 220 minus your age. Sessions only store an average heart rate, so each one counts toward the zone of its average.', null),
  },
  { id: 'climb', title: 'Climbing', Chart: ClimbGraph, useInfo: cardioInfo(() => 'Feet climbed (elevation gain), from recorded routes or what you typed in. Hills build strength and make the same pace harder.', null) },
  {
    id: 'zones', title: 'Heart-rate zones', Chart: ZonesGraph,
    useInfo: cardioInfo(() => 'Minutes in each heart-rate zone, as a share of your max heart rate: zone 1 under 60%, zone 2 60–70% (easy, where most training should be), zone 3 70–80%, zone 4 80–90%, zone 5 90% or more. Max heart rate is your highest recorded, or 220 minus your age. Sessions store an average heart rate, so each one counts toward the zone of its average.', null),
  },
  { id: 'climb', title: 'Climbing', Chart: ClimbGraph, useInfo: cardioInfo(() => 'Feet climbed (elevation gain), from recorded routes or what you typed in. Hills build strength and make the same pace harder.', null) },
  { id: 'time', title: 'Time', Chart: TimeGraph, useInfo: cardioInfo(() => 'Total time moving. Time counts effort that distance misses, like hills, wind and easy days.', null) },
];

const LIFT_GRAPHS: Graph[] = [
  { id: 'workouts', title: 'Workouts', Chart: WorkoutsGraph, useInfo: function useInfo() { return { target: useLiftSchedule(), about: 'Finished lifting workouts: whether you’re keeping your routine, even when strength numbers bounce around.' }; } },
  { id: 'e1rm', title: 'One-rep max', Chart: OneRepMaxGraph, useInfo: () => ({ about: 'Your estimated one-rep max for the lift you pick: weight × (1 + reps ÷ 30), from your best set of 12 reps or fewer. Going from 135 × 8 to 155 × 8 shows up here without ever testing a max. Aim for it to rise slowly over weeks.' }) },
  { id: 'muscles', title: 'Sets per muscle', Chart: MuscleGraph, useInfo: () => ({ target: 'About 10–20 hard sets per muscle group a week builds muscle for most people.', about: 'Finished sets for each muscle group. Each set counts once, toward the exercise’s main muscle (a bench press counts for chest, not triceps too), so nothing is counted twice.' }) },
  { id: 'reps', title: 'Reps per set', Chart: RepsGraph, useInfo: () => ({ target: '1–5 reps for strength, 6–12 for size, 13 or more for endurance.', about: 'Average reps per finished set, for all exercises or one you pick. Read it with the weight you lifted.' }) },
  { id: 'duration', title: 'Workout length', Chart: DurationGraph, useInfo: () => ({ about: 'Minutes from start to finish, for workouts recorded with the timer. Longer isn’t always more productive: most good workouts take 45–75 minutes.' }) },
];

export function CalorieGraphs() {
  return <GraphDeck deck="food" title="Food graphs" graphs={FOOD_GRAPHS} />;
}

export function CardioGraphs() {
  const { state } = useTracker();
  const have = SPORT_GROUPS.filter((g) => state.cardio.sessions.some((x) => groupOf(x.type) === g.id));
  const [sport, setSport] = useState<SportGroup | null>(null);
  const s = sport ?? (have.find((g) => g.id === 'run') ?? have[0])?.id ?? 'run';
  return (
    <SportCtx.Provider value={s}>
      <GraphDeck
        deck="cardio"
        title="Cardio graphs"
        graphs={CARDIO_GRAPHS}
        header={have.length > 1 ? <Choices label="Sport" options={have.map((g) => ({ id: g.id, label: g.label }))} value={s} onChange={setSport} /> : null}
      />
    </SportCtx.Provider>
  );
}

export function LiftingGraphs() {
  return <GraphDeck deck="lifting" title="Lifting graphs" graphs={LIFT_GRAPHS} />;
}

const st = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  gtitle: { flexShrink: 1, textAlign: 'center', fontFamily: fonts.semi, fontSize: 20, lineHeight: 24 },
  info: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  arrowGap: { width: 36 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm, marginBottom: space.md },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { position: 'absolute', left: space.lg, right: space.lg, top: '14%', maxWidth: 440, alignSelf: 'center', borderRadius: radius.lg, padding: space.lg },
  cardTitle: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26, marginBottom: space.xs },
  cardHead: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.md, marginBottom: 4 },
  cardDone: { borderRadius: radius.pill, alignItems: 'center', paddingVertical: space.sm + 2, marginTop: space.lg },
});
