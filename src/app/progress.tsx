import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  METERS_PER_MILE,
  MONTHS,
  SPORT_LABEL,
  addDays,
  byWeek,
  calorieSummary,
  cardioStats,
  cumulative,
  dailyWindow,
  defaultIncrement,
  fmt,
  fmtInt,
  fmtTime,
  fmtW,
  nextTarget,
  paceText,
  planTitle,
  planWeekRows,
  sgn,
  toD,
  volume,
  weeklyTotals,
  weightHistory,
  type Sport,
  type WeekBar as BarRow,
} from '@/logic';
import { ChartKey, CumulativeLine, DeficitBars, PlanBars, Sparkline } from '@/ui/charts';
import { Header, Mute, Section, StatGrid, StatTile } from '@/ui/components';
import { useLibrary } from '@/ui/lifting/library';
import { useTracker } from '@/ui/store';
import { space, tabular, useColors } from '@/ui/theme';

const weekLabel = (s: string) => {
  const d = toD(s);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

export default function ProgressScreen() {
  const c = useColors();
  const { state } = useTracker();
  const on = state.settings.sections;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Progress" />
        {on.lifting ? <LiftingSection /> : null}
        {on.cardio ? <CardioSection /> : null}
        {on.food ? <CaloriesSection /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LiftingSection() {
  const c = useColors();
  const { state, today } = useTracker();
  const { byId } = useLibrary();
  const L = state.lifting;
  const done = L.workouts.filter((w) => w.done);
  const last28 = done.filter((w) => w.date > addDays(today, -28)).length;
  const total = done.reduce((t, w) => t + volume(w), 0);
  // Exercises you've done, in routine order first, then the rest.
  const logged = new Set(done.flatMap((w) => w.exercises.filter((x) => x.sets.some((s) => s.done)).map((x) => x.exId)));
  const ids = [...new Set([...L.routines.flatMap((r) => r.items.map((i) => i.exId)), ...logged])].filter((id) => logged.has(id));

  return (
    <>
    <Section title="Lifting">
      <StatGrid columns={3}>
        <StatTile value={String(done.length)} label="Workouts" />
        <StatTile value={String(last28)} label="Last 4 weeks" />
        <StatTile value={total >= 1e5 ? `${fmt(+(total / 1000).toFixed(0))}k` : fmtInt(total)} label="Lb lifted" />
      </StatGrid>
    </Section>
    {ids.length ? (
    <Section title="Your lifts" action={<Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Next</Text>}>
      {ids.map((id, i) => {
        const ex = byId(id);
        const pts = weightHistory(L, id).map((p) => p.w);
        const it = L.routines.flatMap((r) => r.items).find((x) => x.exId === id);
        const plan = it ? { ...it, inc: it.inc ?? (ex ? defaultIncrement(ex) : 5) } : { sets: 3, repMin: 8, repMax: 12, inc: ex ? defaultIncrement(ex) : 5 };
        const t = nextTarget(id, L.workouts, plan);
        const name = ex?.name ?? done.flatMap((w) => w.exercises).find((x) => x.exId === id)?.name ?? 'Exercise';
        const u = ex?.unit === 'plates' ? 'pl' : 'lb';
        return (
          <View key={id} style={[st.srow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
            <Text style={{ flex: 1, fontWeight: '600', fontSize: 15, color: c.ink }}>{name}</Text>
            <View style={{ width: 70, alignItems: 'center' }}>{pts.length >= 2 ? <Sparkline pts={pts} /> : <Text style={{ color: c.mute }}>–</Text>}</View>
            <Text style={{ width: 84, textAlign: 'right', color: t.weight != null ? (t.reason === 'up' ? c.ok : c.ink) : c.mute, fontSize: 15, ...tabular }}>
              {t.weight != null ? `${fmtW(t.weight)} ${u}${t.reason === 'up' ? ' ↑' : ''}` : '–'}
            </Text>
          </View>
        );
      })}
    </Section>
    ) : null}
    </>
  );
}

function CardioSection() {
  const c = useColors();
  const { state, today } = useTracker();
  const cardio = state.cardio;
  const s = cardioStats(cardio, today);
  const { long, sports } = planWeekRows(cardio);
  // Bars are in miles; swims read better in meters.
  const unitRows = (sport: Sport, rows: BarRow[]) =>
    sport === 'swim' ? rows.map((r) => ({ ...r, planned: Math.round(r.planned * METERS_PER_MILE), actual: Math.round(r.actual * METERS_PER_MILE) })) : rows;
  const unit = (sport: Sport) => (sport === 'swim' ? 'meters' : 'miles');
  const weeks = weeklyTotals(cardio, today, 8);
  return (
    <>
      <Section title="Cardio">
        <StatGrid columns={3}>
          <StatTile value={String(s.sessions)} label="Sessions" />
          <StatTile value={fmt(+s.miles.toFixed(1))} label="Miles" />
          <StatTile value={s.secs ? fmtTime(s.secs) : '–'} label="Time" />
          <StatTile value={s.longestRun ? fmt(s.longestRun) : '–'} label="Longest run" />
          <StatTile value={s.paceMiles > 0 ? paceText(s.paceMiles, s.paceSecs).replace(' /mi', '') : '–'} label="Pace /mi" />
          {cardio.plan ? <StatTile value={String(s.planDone)} sub={`/${s.planDue}`} label="Plan done" /> : <StatTile value="–" label="No plan" />}
        </StatGrid>
      </Section>

      {s.sessions ? (
        <Section title="Miles per week">
          <PlanBars rows={weeks.map((w) => ({ label: weekLabel(w.start), planned: 0, actual: w.miles }))} label="Miles per week, last 8 weeks" />
        </Section>
      ) : null}

      {cardio.plan && sports.length ? (
        <>
          {long.length ? (
            <Section title={`Long ${SPORT_LABEL[sports[0].sport].toLowerCase()}`} action={<Text style={{ color: c.mute, fontSize: 13 }}>{planTitle(cardio.plan.id)}</Text>}>
              <PlanBars rows={unitRows(sports[0].sport, long)} label={`Long session ${unit(sports[0].sport)} by plan week`} />
              <ChartKey items={['planned', 'logged']} />
            </Section>
          ) : null}
          {sports.map((x) => (
            <Section key={x.sport} title={`Weekly ${SPORT_LABEL[x.sport].toLowerCase()} ${unit(x.sport)}`}>
              <PlanBars rows={unitRows(x.sport, x.rows)} label={`${SPORT_LABEL[x.sport]} ${unit(x.sport)} by plan week`} />
              <ChartKey items={['planned', 'logged']} />
            </Section>
          ))}
        </>
      ) : null}
    </>
  );
}

function CaloriesSection() {
  const c = useColors();
  const { state, today } = useTracker();
  const goal = state.goal;
  const sum = calorieSummary(state);
  const n = sum.days;
  const col = (v: number) => (v >= 0 ? c.ok : c.bad);
  const cum = cumulative(state);
  const weeks = byWeek(state);

  return (
    <>
      <Section title="Calories" action={goal ? <Text style={{ color: c.mute, fontSize: 13 }}>{`Goal ${fmtInt(goal)}/day`}</Text> : undefined}>
        <StatGrid>
          <StatTile value={n ? sgn(sum.avg) : '–'} color={n ? col(sum.avg) : undefined} label="Avg daily deficit" />
          <StatTile value={n ? sgn(sum.total) : '–'} color={n ? col(sum.total) : undefined} label="Total deficit" />
          <StatTile value={String(n)} label="Days logged" />
          <StatTile value={String(sum.hit)} sub={`/${n}`} label={goal ? 'Days at goal' : 'Days in a deficit'} />
        </StatGrid>
        {!n ? <Mute>Add calories in and burned on the Food tab.</Mute> : null}
      </Section>

      {n ? (
        <Section title="Daily deficit">
          <DeficitBars vals={dailyWindow(state, today)} goal={goal} />
          <ChartKey items={goal ? ['deficit', 'surplus', 'goal'] : ['deficit', 'surplus']} />
        </Section>
      ) : null}

      {cum.length >= 2 ? (
        <Section title="Total over time">
          <CumulativeLine pts={cum} />
        </Section>
      ) : null}

      {weeks.length ? (
        <Section title="By week">
          <View style={[st.krow, { borderBottomColor: c.line }]}>
            {['Week of', 'Days', 'Avg in', 'Avg out', 'Deficit'].map((h, i) => (
              <Text key={h} style={[st.kcell, i === 0 && st.kfirst, { color: c.mute, fontSize: 12.5, fontWeight: '600' }]}>
                {h}
              </Text>
            ))}
          </View>
          {weeks.map((w, i) => (
            <View key={w.start} style={[st.krow, { borderBottomColor: c.line }, i === weeks.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={[st.kcell, st.kfirst, { color: c.ink, fontWeight: '700' }]}>{weekLabel(w.start)}</Text>
              <Text style={[st.kcell, { color: c.ink }]}>{w.days}/7</Text>
              <Text style={[st.kcell, { color: c.ink }]}>{fmtInt(w.avgIn)}</Text>
              <Text style={[st.kcell, { color: c.ink }]}>{fmtInt(w.avgOut)}</Text>
              <Text style={[st.kcell, { color: col(w.avgNet), fontWeight: '700' }]}>{sgn(w.avgNet)}</Text>
            </View>
          ))}
        </Section>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  srow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md - 2 },
  krow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: space.sm + 1 },
  kcell: { flex: 1, textAlign: 'right', fontSize: 15, paddingHorizontal: 2, ...tabular },
  kfirst: { textAlign: 'left', flex: 1.1 },
});
