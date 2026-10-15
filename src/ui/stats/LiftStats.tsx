import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bestSets, fmt, fmtInt, liftRecords, liftSummary, rangeSpan, recentPRs, shortDayLabel, sumByBucket, type LiftRecord, type LiftingData, type Range } from '@/logic';

import { BarChart, ChartCaption, LineChart, RangeTabs, Sparkline } from '../charts';
import { Card, Mute, Section, StatGrid, StatTile } from '../components';
import { Sheet } from '../food/kit';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';

/** Lifting in depth: how often, how much, and how each lift is moving. */
export function LiftStatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const L = state.lifting;
  const s = liftSummary(L, today);
  const records = liftRecords(L);
  const prs = recentPRs(L, today);

  return (
    <Sheet visible={visible} title="Lifting stats" onClose={onClose}>
      <Card>
        <StatGrid columns={3}>
          <StatTile value={String(s.total)} label="Workouts" />
          <StatTile value={String(s.last4)} label="Last 4 weeks" />
          <StatTile value={String(s.thisWeek)} label="This week" />
          <StatTile value={fmt(Math.round(s.perWeek * 10) / 10)} label="Per week (12 wk)" />
          <StatTile value={String(s.streak)} sub={s.streak === 1 ? ' wk' : ' wks'} label="Streak" />
          <StatTile value={s.avgMins ? String(s.avgMins) : '–'} sub={s.avgMins ? ' min' : undefined} label="Avg workout" />
          <StatTile value={fmtInt(s.sets)} label="Sets" />
          <StatTile value={fmtInt(s.reps)} label="Reps" />
        </StatGrid>
      </Card>

      <WorkoutsChart L={L} today={today} />

      {prs.length ? (
        <Section title="Recent records">
          {prs.slice(0, 8).map((p, i) => (
            <View key={`${p.name}${p.date}`} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{p.name}</Text>
                <Mute style={{ fontSize: 13 }}>{shortDayLabel(p.date)}</Mute>
              </View>
              <Text style={{ color: c.ok, fontSize: 15, fontWeight: '700', ...tabular }}>{`${fmt(p.set.w)} × ${p.set.reps}`}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Your lifts">
        {records.length ? (
          <>
            <View style={[st.row, { paddingTop: 0 }]}>
              <Text style={[st.colHead, { color: c.mute, flex: 1 }]}>Exercise</Text>
              <Text style={[st.colHead, { color: c.mute, width: 86, textAlign: 'right' }]}>Best set</Text>
              <Text style={[st.colHead, { color: c.mute, width: 92, textAlign: 'right' }]}>Est. max</Text>
            </View>
            {records.map((r) => (
              <LiftRow key={r.exId} r={r} L={L} today={today} />
            ))}
            <Mute style={{ fontSize: 12.5, marginTop: space.sm }}>Est. max: the most you could lift once, worked out from your best set. Tap a lift for its chart.</Mute>
          </>
        ) : (
          <Mute>Finish a workout with weights to see your lifts here.</Mute>
        )}
      </Section>
    </Sheet>
  );
}

/** Workouts in each day, week or month of the chosen range. */
function WorkoutsChart({ L, today }: { L: LiftingData; today: string }) {
  const c = useColors();
  const [range, setRange] = useState<Range>('month');
  const done = L.workouts.filter((w) => w.done && w.date <= today);
  const first = done.map((w) => w.date).sort()[0];
  const span = rangeSpan(range, today, first);
  const vals = sumByBucket(done, (w) => w.date, () => 1, span.buckets);
  const total = vals.reduce((a, b) => a + b, 0);
  return (
    <Section title="Workouts" action={<Text style={{ color: c.mute, fontSize: 14, fontWeight: '700' }}>{`${total} in range`}</Text>}>
      <RangeTabs value={range} onChange={setRange} />
      <ChartCaption>{`${span.caption} · workouts per ${span.per}`}</ChartCaption>
      <BarChart values={vals} labels={span.buckets.map((b) => b.label)} label={`Workouts per ${span.per}, ${span.caption.toLowerCase()}`} />
    </Section>
  );
}

function LiftRow({ r, L, today }: { r: LiftRecord; L: LiftingData; today: string }) {
  const c = useColors();
  const u = r.unit === 'plates' ? 'pl' : 'lb';
  const ch = Math.round(r.change);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>('all');
  const hist = open ? bestSets(L, r.exId) : [];
  const span = rangeSpan(range, today, hist[0]?.date);
  const pts = hist.filter((h) => h.date >= span.from).map((h) => ({ s: h.date, v: Math.round(h.e1rm) }));
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${r.name}. ${open ? 'Hide' : 'Show'} chart`}
        style={st.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{r.name}</Text>
          {r.trend.length >= 2 ? (
            <View style={{ width: 80 }}>
              <Sparkline pts={r.trend} />
            </View>
          ) : (
            <Mute style={{ fontSize: 12.5 }}>1 workout</Mute>
          )}
        </View>
        <Text style={{ width: 86, textAlign: 'right', color: c.ink, fontSize: 15, ...tabular }}>{`${fmt(r.best.w)} × ${r.best.reps}`}</Text>
        <View style={{ width: 92, alignItems: 'flex-end' }}>
          <Text style={[st.max, { color: c.ink }]}>{`${fmtInt(r.last.e1rm)} ${u}`}</Text>
          {r.sessions >= 2 ? (
            <Text style={{ color: ch > 0 ? c.ok : ch < 0 ? c.bad : c.mute, fontSize: 12.5, ...tabular }}>{ch === 0 ? 'no change' : `${ch > 0 ? '+' : '−'}${Math.abs(ch)} ${u}`}</Text>
          ) : null}
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: space.md }}>
          <RangeTabs value={range} onChange={setRange} />
          <ChartCaption>{`${span.caption} · estimated max, ${u}`}</ChartCaption>
          {pts.length >= 2 ? (
            <LineChart label={`${r.name} estimated max, ${span.caption.toLowerCase()}`} unit={u} from={span.from} to={span.to} series={[{ pts, style: 'line' }, { pts, style: 'dots' }]} />
          ) : (
            <Mute>{pts.length ? 'Only one workout with this lift in this range.' : 'No workouts with this lift in this range.'}</Mute>
          )}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  colHead: { fontSize: 12.5, fontWeight: '600' },
  max: { fontFamily: fonts.semi, fontSize: 18, lineHeight: 22, ...tabular },
});
