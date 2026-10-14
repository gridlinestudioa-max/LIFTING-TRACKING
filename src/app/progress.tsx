import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ALL_EXERCISES,
  byWeek,
  calorieSummary,
  cumulative,
  dailyWindow,
  fmt,
  fmtInt,
  loggedWeights,
  paceText,
  planFor,
  progressStats,
  sgn,
  weeklyRunRows,
} from '@/logic';
import { ChartKey, CumulativeLine, DeficitBars, PlanBars, Sparkline } from '@/ui/charts';
import { CommitNumberField, H2, Header, Mute, Section, StatGrid, StatTile } from '@/ui/components';
import { ProgressionTable } from '@/ui/ProgressionTable';
import { StartPicker } from '@/ui/StartPicker';
import { useTracker } from '@/ui/store';
import { space, tabular, useColors } from '@/ui/theme';

export default function ProgressScreen() {
  const c = useColors();
  const { state, today, setBase, setGoal, setStart } = useTracker();

  const st = progressStats(state, today);
  const { long, week } = weeklyRunRows(state);
  const cur = planFor(state.start, today);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <Header title="Progress" />

        <StatGrid columns={3}>
          <StatTile value={String(st.done)} sub={`/${st.planned}`} label="Sessions completed" />
          <StatTile value={String(st.missedOrPartial)} label={st.skipped ? `Missed or partial, ${st.skipped} skipped` : 'Missed or partial'} />
          <StatTile value={fmt(+st.miles.toFixed(1))} label="Miles logged" />
          <StatTile value={st.longest ? fmt(st.longest) : '–'} label="Longest run (mi)" />
          <StatTile
            value={st.paceMiles > 0 ? paceText(st.paceMiles, st.paceSecs).replace(' /mi', '') : '–'}
            label="Average pace (min/mi)"
          />
          <StatTile value={String(st.liftDone)} label="Lifting sessions completed" />
        </StatGrid>

        <Section title="Running">
          <ChartKey items={['planned', 'logged']} />
          <H2 style={{ marginTop: space.lg }}>Long run</H2>
          <PlanBars rows={long} label="Long run miles by week" />
          <H2 style={{ marginTop: space.xl }}>Weekly running miles</H2>
          <PlanBars rows={week} label="Weekly running miles" />
        </Section>

        <CaloriesSection goal={state.goal} onGoal={setGoal} />

        <Section
          title="Lifting"
          note="Week 1 is the first bump. Weights go up every 3 weeks (W4, W7, W10), one session per lift per week. Edit the W1 box to rebase a lift.">
          <H2>Progression</H2>
          <ProgressionTable state={state} currentWeek={cur ? cur.w : -1} onBase={setBase} />

          <H2 style={{ marginTop: space.xl }}>Logged weights</H2>
          {ALL_EXERCISES.map((e, i) => {
            const pts = loggedWeights(state, e.id);
            return (
              <View key={e.id} style={[s.srow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Text style={{ flex: 1, fontWeight: '600', fontSize: 15, color: c.ink }}>{e.name}</Text>
                <View style={{ width: 70, alignItems: 'center' }}>
                  {pts.length >= 2 ? <Sparkline pts={pts} /> : <Text style={{ color: c.mute }}>–</Text>}
                </View>
                <Text style={{ width: 66, textAlign: 'right', color: pts.length ? c.ink : c.mute, fontSize: 15, ...tabular }}>
                  {pts.length ? `${fmt(pts[pts.length - 1])} ${e.unit}` : '–'}
                </Text>
              </View>
            );
          })}
        </Section>

        <Section title="Plan start">
          <StartPicker start={state.start} onChange={setStart} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function CaloriesSection({ goal, onGoal }: { goal: number | null; onGoal: (v: number | null) => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const sum = calorieSummary(state);
  const n = sum.days;
  const col = (v: number) => (v >= 0 ? c.ok : c.bad);
  const cum = cumulative(state);
  const weeks = byWeek(state);

  return (
    <Section title="Calories">
      <StatGrid>
        <StatTile value={n ? sgn(sum.avg) : '–'} color={n ? col(sum.avg) : undefined} label="Avg daily deficit (kcal, − = surplus)" />
        <StatTile value={n ? sgn(sum.total) : '–'} color={n ? col(sum.total) : undefined} label="Total deficit so far (kcal)" />
        <StatTile value={String(n)} label="Days logged" />
        <StatTile value={String(sum.hit)} sub={`/${n}`} label={goal ? 'Days at or above goal' : 'Days in a deficit'} />
      </StatGrid>

      <View style={s.goal}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>Daily deficit goal</Text>
          <Mute style={{ fontSize: 13 }}>Optional</Mute>
        </View>
        <CommitNumberField value={goal} onCommit={onGoal} accessibilityLabel="Daily deficit goal" style={{ width: 104, textAlign: 'right' }} />
        <Text style={{ color: c.mute, fontSize: 14 }}>kcal</Text>
      </View>

      <H2 style={{ marginTop: space.xl }}>Daily deficit</H2>
      {n ? (
        <>
          <DeficitBars vals={dailyWindow(state, today)} goal={goal} />
          <ChartKey items={goal ? ['deficit', 'surplus', 'goal'] : ['deficit', 'surplus']} />
        </>
      ) : (
        <Mute>Log calories in and out on any day to see this.</Mute>
      )}

      <H2 style={{ marginTop: space.xl }}>Cumulative deficit</H2>
      {cum.length >= 2 ? <CumulativeLine pts={cum} /> : <Mute>Needs at least 2 logged days.</Mute>}

      <H2 style={{ marginTop: space.xl }}>By week</H2>
      {weeks.length ? (
        <View>
          <View style={[s.krow, { borderBottomColor: c.line }]}>
            {['Week', 'Days', 'Avg in', 'Avg out', 'Avg deficit'].map((h, i) => (
              <Text key={h} style={[s.kcell, i === 0 && s.kfirst, { color: c.mute, fontSize: 12.5, fontWeight: '600' }]}>
                {h}
              </Text>
            ))}
          </View>
          {weeks.map((w) => (
            <View key={w.week} style={[s.krow, { borderBottomColor: c.line }]}>
              <Text style={[s.kcell, s.kfirst, { color: c.ink, fontWeight: '700' }]}>W{w.week}</Text>
              <Text style={[s.kcell, { color: c.ink }]}>{w.days}/7</Text>
              <Text style={[s.kcell, { color: c.ink }]}>{fmtInt(w.avgIn)}</Text>
              <Text style={[s.kcell, { color: c.ink }]}>{fmtInt(w.avgOut)}</Text>
              <Text style={[s.kcell, { color: col(w.avgNet), fontWeight: '700' }]}>{sgn(w.avgNet)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Mute>No weeks logged yet.</Mute>
      )}
    </Section>
  );
}

const s = StyleSheet.create({
  srow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md - 2 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  krow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: space.sm + 1 },
  kcell: { flex: 1, textAlign: 'right', fontSize: 15, paddingHorizontal: 2, ...tabular },
  kfirst: { textAlign: 'left', flex: 0.8 },
});
