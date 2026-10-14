import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MONTHS, byWeek, calorieSummary, cardioReport, cumulative, dailyWindow, fmt, fmtInt, liftSummary, sgn, toD } from '@/logic';
import { ChartKey, CumulativeLine, DeficitBars } from '@/ui/charts';
import { Header, Mute, Section, StatGrid, StatTile } from '@/ui/components';
import { CardioStatsSheet, paceFor } from '@/ui/stats/CardioStats';
import { LiftStatsSheet } from '@/ui/stats/LiftStats';
import { useTracker } from '@/ui/store';
import { fonts, space, tabular, useColors } from '@/ui/theme';

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
  const { state, today } = useTracker();
  const [open, setOpen] = useState(false);
  const s = liftSummary(state.lifting, today);
  return (
    <>
      <TapCard title="Lifting" onPress={() => setOpen(true)} a11y="Lifting stats. Show more">
        <View style={{ flexDirection: 'row' }}>
          <Big value={String(s.last4)} label="Last 4 weeks" />
          <Big value={String(s.total)} label="Total workouts" />
        </View>
      </TapCard>
      <LiftStatsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CardioSection() {
  const { state, today } = useTracker();
  const [open, setOpen] = useState(false);
  // Runs if there are any, otherwise everything.
  const runs = cardioReport(state.cardio, state.profile, today, 'run');
  const g = runs.sessions.length ? 'run' : 'all';
  const r = g === 'run' ? runs : cardioReport(state.cardio, state.profile, today, 'all');
  return (
    <>
      <TapCard title={g === 'run' ? 'Running' : 'Cardio'} onPress={() => setOpen(true)} a11y="Cardio stats. Show more">
        <View style={{ flexDirection: 'row' }}>
          <Big value={paceFor(g, r.avgPace).replace(' /mi', '')} unit={r.avgPace ? '/mi' : undefined} label="Avg pace" />
          <Big value={r.avgMiles != null ? fmt(Math.round(r.avgMiles * 10) / 10) : '–'} unit={r.avgMiles != null ? 'mi' : undefined} label="Avg distance" />
        </View>
      </TapCard>
      {open ? <CardioStatsSheet visible initial={g} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** A section card that opens more detail. */
function TapCard({ title, onPress, a11y, children }: { title: string; onPress: () => void; a11y: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Section title={title} action={<Text style={{ color: c.mute, fontSize: 14, fontWeight: '600' }}>All stats ›</Text>}>
        {children}
      </Section>
    </Pressable>
  );
}

function Big({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 36, lineHeight: 40, ...tabular }}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 18, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
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
