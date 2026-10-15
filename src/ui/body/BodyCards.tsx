import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BODY_LIMITS,
  cleanSteps,
  cleanWater,
  cleanWeight,
  fmt,
  fmtInt,
  fmtSleep,
  fmtWater,
  parseSleep,
  recentAverage,
  shortDayLabel,
  weightChange,
  weightSeries,
  weightTrend,
} from '@/logic';

import { ChartKey, LineChart } from '../charts';
import { CommitNumberField, Field, Mute, Section } from '../components';
import { Pill } from '../food/kit';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';

// The body log: weight, water, sleep and steps for today, entered by hand. They're cards on the Home tab.

function Big({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[st.big, { color: c.ink }]}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Label({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[st.lbl, { color: c.mute }]}>{children}</Text>;
}

function ErrorText({ children }: { children: string | null }) {
  const c = useColors();
  return children ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.sm }}>{children}</Text> : null;
}

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

export function WeightCard() {
  const { state, today, setDay } = useTracker();
  const [err, setErr] = useState<string | null>(null);
  const series = useMemo(() => weightSeries(state.days, today, 90), [state.days, today]);
  const trend = useMemo(() => weightTrend(series), [series]);
  const change = weightChange(series, 28);
  const latest = series[series.length - 1];
  const smooth = trend[trend.length - 1];
  const { min, max } = BODY_LIMITS.weightLb;
  return (
    <Section title="Weight">
      <View style={{ flexDirection: 'row' }}>
        <Big value={latest ? fmt(latest.v) : '–'} unit={latest ? 'lb' : undefined} label={latest ? (latest.s === today ? 'Today' : `Last: ${shortDayLabel(latest.s)}`) : 'Not logged'} />
        <Big value={smooth ? fmt(Math.round(smooth.v * 10) / 10) : '–'} unit={smooth ? 'lb' : undefined} label="Weekly trend" />
        <Big value={change != null ? signed(change) : '–'} unit={change != null ? 'lb' : undefined} label="Last 4 weeks" />
      </View>
      <Label>Today’s weight (lb)</Label>
      <CommitNumberField
        value={state.days[today]?.weightLb ?? null}
        placeholder="e.g. 180.4"
        accessibilityLabel="Today’s weight in pounds"
        onCommit={(v) => {
          if (v == null) {
            setErr(null);
            return setDay(today, { weightLb: undefined });
          }
          const w = cleanWeight(v);
          if (w == null) return setErr(`Enter a weight between ${min} and ${max} lb.`);
          setErr(null);
          setDay(today, { weightLb: w });
        }}
      />
      <ErrorText>{err}</ErrorText>
      {trend.length >= 2 ? (
        <View style={{ marginTop: space.lg }}>
          <LineChart
            label="Weight over the last 90 days"
            unit=" lb"
            series={[
              { pts: series, style: 'dots' },
              { pts: trend, style: 'line' },
            ]}
          />
          <ChartKey items={['weight', 'trend']} />
        </View>
      ) : (
        <Mute style={{ marginTop: space.md }}>Log your weight on a few days to see the trend. It smooths out day-to-day swings.</Mute>
      )}
    </Section>
  );
}

const WATER_STEPS = [8, 16, 24];

export function WaterCard() {
  const { state, today, setDay } = useTracker();
  const oz = state.days[today]?.waterOz ?? 0;
  const avg = recentAverage(state.days, 'waterOz', today, 7);
  const change = (by: number) => {
    const next = Math.min(BODY_LIMITS.waterOz.max, Math.max(0, Math.round(oz + by)));
    setDay(today, { waterOz: cleanWater(next) });
  };
  return (
    <Section title="Water">
      <View style={{ flexDirection: 'row' }}>
        <Big value={oz ? fmt(oz) : '0'} unit="oz" label="Today" />
        <Big value={avg.avg != null ? fmt(Math.round(avg.avg)) : '–'} unit={avg.avg != null ? 'oz' : undefined} label={avg.logged ? `${avg.logged}-day average` : '7-day average'} />
      </View>
      <View style={st.pills}>
        {WATER_STEPS.map((n) => (
          <Pill key={n} label={`+${n} oz`} selected={false} onPress={() => change(n)} />
        ))}
        <Pill label="−8 oz" selected={false} onPress={() => change(-8)} />
      </View>
      {oz ? <Mute style={{ marginTop: space.sm }}>{`${fmtWater(oz)} today. A glass is about 8 oz.`}</Mute> : null}
    </Section>
  );
}

export function SleepCard() {
  const { state, today, setDay } = useTracker();
  const saved = state.days[today]?.sleepMins ?? null;
  const avg = recentAverage(state.days, 'sleepMins', today, 7);
  const [text, setText] = useState(saved != null ? fmtSleep(saved) : '');
  const [prev, setPrev] = useState(saved);
  const [err, setErr] = useState<string | null>(null);
  // Show what's saved when it changes elsewhere (a new day, a sync).
  if (prev !== saved) {
    setPrev(saved);
    setText(saved != null ? fmtSleep(saved) : '');
  }
  const commit = () => {
    if (!text.trim()) {
      setErr(null);
      return setDay(today, { sleepMins: undefined });
    }
    const m = parseSleep(text);
    if (m == null) return setErr('Try 7:30, 7h 30m or 7.5.');
    setErr(null);
    setDay(today, { sleepMins: m });
    setText(fmtSleep(m));
  };
  return (
    <Section title="Sleep">
      <View style={{ flexDirection: 'row' }}>
        <Big value={saved != null ? fmtSleep(saved) : '–'} label="Last night" />
        <Big value={avg.avg != null ? fmtSleep(avg.avg) : '–'} label={avg.logged ? `${avg.logged}-night average` : '7-night average'} />
      </View>
      <Label>Time asleep last night</Label>
      <Field
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        placeholder="e.g. 7:30"
        accessibilityLabel="Time asleep last night"
      />
      <ErrorText>{err}</ErrorText>
    </Section>
  );
}

export function StepsCard() {
  const { state, today, setDay } = useTracker();
  const [err, setErr] = useState<string | null>(null);
  const steps = state.days[today]?.steps ?? null;
  const avg = recentAverage(state.days, 'steps', today, 7);
  return (
    <Section title="Steps">
      <View style={{ flexDirection: 'row' }}>
        <Big value={steps != null ? fmtInt(steps) : '–'} label="Today" />
        <Big value={avg.avg != null ? fmtInt(avg.avg) : '–'} label={avg.logged ? `${avg.logged}-day average` : '7-day average'} />
      </View>
      <Label>Steps today</Label>
      <CommitNumberField
        value={steps}
        placeholder="e.g. 8500"
        accessibilityLabel="Steps today"
        onCommit={(v) => {
          if (v == null) {
            setErr(null);
            return setDay(today, { steps: undefined });
          }
          const n = cleanSteps(v);
          if (n == null) return setErr(`Enter a number of steps up to ${fmtInt(BODY_LIMITS.steps.max)}.`);
          setErr(null);
          setDay(today, { steps: n });
        }}
      />
      <ErrorText>{err}</ErrorText>
      <Mute style={{ marginTop: space.sm }}>Copy the number from your phone’s health app or watch. Syncing from a device isn’t in the app yet.</Mute>
    </Section>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  lbl: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
});
