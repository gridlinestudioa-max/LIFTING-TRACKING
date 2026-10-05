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
import { CumulativeLine, DeficitBars, PlanBars, Sparkline } from '@/ui/charts';
import { Card, CommitNumberField, H2, Header, Label, Mute, StatGrid, StatTile } from '@/ui/components';
import { ProgressionTable } from '@/ui/ProgressionTable';
import { StartPicker } from '@/ui/StartPicker';
import { useTracker } from '@/ui/store';
import { useColors } from '@/ui/theme';

export default function ProgressScreen() {
  const c = useColors();
  const { state, today, setBase, setGoal, setStart } = useTracker();

  const st = progressStats(state, today);
  const { long, week } = weeklyRunRows(state);
  const cur = planFor(state.start, today);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <Header />

        <StatGrid>
          <StatTile value={String(st.done)} sub={` / ${st.planned}`} label="Sessions completed" />
          <StatTile
            value={String(st.missedOrPartial)}
            sub={st.skipped ? ` · ${st.skipped} skipped` : undefined}
            label="Missed or partial"
          />
          <StatTile value={fmt(+st.miles.toFixed(1))} label="Total miles logged" />
          <StatTile value={st.longest ? fmt(st.longest) : '–'} label="Longest run (mi)" />
          <StatTile
            value={st.paceMiles > 0 ? paceText(st.paceMiles, st.paceSecs).replace(' /mi', '') : '–'}
            label="Average pace (min/mi)"
          />
          <StatTile value={String(st.liftDone)} label="Lifting sessions completed" />
        </StatGrid>

        <Card>
          <H2>Long run (miles)</H2>
          <PlanBars rows={long} label="Long run miles by week" />
          <Key>Dashed = planned · solid = logged</Key>
        </Card>
        <Card>
          <H2>Weekly running miles</H2>
          <PlanBars rows={week} label="Weekly running miles" />
          <Key>Dashed = planned · solid = logged</Key>
        </Card>

        <CaloriesCard goal={state.goal} onGoal={setGoal} />

        <Card>
          <H2>Lifting progression</H2>
          <Mute>
            Week 1 (this week) is the first bump. Weights go up every 3 weeks (W4, W7, W10), one session per lift per
            week. Edit the W1 box to rebase a lift.
          </Mute>
          <ProgressionTable state={state} currentWeek={cur ? cur.w : -1} onBase={setBase} />
        </Card>

        <Card>
          <H2>Logged weights</H2>
          {ALL_EXERCISES.map((e, i) => {
            const pts = loggedWeights(state, e.id);
            return (
              <View key={e.id} style={[s.srow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Text style={{ flex: 1, fontWeight: '700', color: c.ink }}>{e.name}</Text>
                <View style={{ width: 70, alignItems: 'center' }}>
                  {pts.length >= 2 ? <Sparkline pts={pts} /> : <Text style={{ color: c.mute }}>–</Text>}
                </View>
                <Text style={{ width: 64, textAlign: 'right', color: c.mute }}>
                  {pts.length ? `${fmt(pts[pts.length - 1])} ${e.unit}` : '–'}
                </Text>
              </View>
            );
          })}
        </Card>

        <Card>
          <H2>Plan start</H2>
          <StartPicker start={state.start} onChange={setStart} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function CaloriesCard({ goal, onGoal }: { goal: number | null; onGoal: (v: number | null) => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const sum = calorieSummary(state);
  const n = sum.days;
  const col = (v: number) => (v >= 0 ? c.ok : c.bad);
  const cum = cumulative(state);
  const weeks = byWeek(state);

  return (
    <Card>
      <H2>Calories: in vs out</H2>
      <View style={{ marginTop: 8 }}>
        <StatGrid>
          <StatTile value={n ? sgn(sum.avg) : '–'} color={n ? col(sum.avg) : undefined} label="Avg daily deficit (kcal, − = surplus)" />
          <StatTile value={n ? sgn(sum.total) : '–'} color={n ? col(sum.total) : undefined} label="Total deficit so far (kcal)" />
          <StatTile value={String(n)} label="Days logged" />
          <StatTile value={String(sum.hit)} sub={` / ${n}`} label={goal ? 'Days at or above goal' : 'Days in a deficit'} />
        </StatGrid>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <Mute>Daily deficit goal (optional)</Mute>
        <CommitNumberField value={goal} onCommit={onGoal} accessibilityLabel="Daily deficit goal" style={{ width: 90, textAlign: 'right' }} />
        <Mute>kcal</Mute>
      </View>

      <Label>Daily deficit</Label>
      {n ? (
        <>
          <DeficitBars vals={dailyWindow(state, today)} goal={goal} />
          <Key>Green above the line = deficit · red below = surplus · dashed = your goal</Key>
        </>
      ) : (
        <Mute>Log calories in and out on any day to see this.</Mute>
      )}

      <Label>Cumulative deficit</Label>
      {cum.length >= 2 ? <CumulativeLine pts={cum} /> : <Mute>Needs at least 2 logged days.</Mute>}

      <Label>By week</Label>
      {weeks.length ? (
        <View>
          <View style={[s.krow, { borderBottomColor: c.line }]}>
            {['Week', 'Days', 'Avg in', 'Avg out', 'Avg deficit'].map((h, i) => (
              <Text key={h} style={[s.kcell, i === 0 && s.kfirst, { color: c.mute, fontSize: 11, fontWeight: '700' }]}>
                {h}
              </Text>
            ))}
          </View>
          {weeks.map((w) => (
            <View key={w.week} style={[s.krow, { borderBottomColor: c.line }]}>
              <Text style={[s.kcell, s.kfirst, { color: c.ink }]}>W{w.week}</Text>
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
    </Card>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <Mute style={{ fontSize: 11, marginTop: 4 }}>{children}</Mute>;
}

const s = StyleSheet.create({
  srow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  krow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6 },
  kcell: { flex: 1, textAlign: 'right', fontSize: 13, paddingHorizontal: 2 },
  kfirst: { textAlign: 'left', flex: 0.8 },
});
