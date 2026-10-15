import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  METERS_PER_MILE,
  SPORT_GROUPS,
  SPORT_LABEL,
  cardioReport,
  rangeSpan,
  sumByBucket,
  fmt,
  fmtInt,
  fmtTime,
  groupOf,
  planTitle,
  planWeekRows,
  shortDayLabel,
  type CardioSession,
  type CardioTotals,
  type Range,
  type SportGroup,
} from '@/logic';

import { BarChart, ChartCaption, ChartKey, PlanBars, RangeTabs } from '../charts';
import { Card, Mute, Section } from '../components';
import { Sheet } from '../food/kit';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';

type G = SportGroup | 'all';

/** Distance in the sport's unit: meters for swims, miles otherwise. */
export function distFor(g: G, miles: number): string {
  return g === 'swim' ? `${fmtInt(miles * METERS_PER_MILE)} m` : `${fmt(Math.round(miles * 100) / 100)} mi`;
}

/** Pace the way each sport reads it: min/mi on foot, mph on a bike, per 100 m in the pool. */
export function paceFor(g: G, secsPerMile: number | null): string {
  if (secsPerMile == null || !Number.isFinite(secsPerMile) || secsPerMile <= 0) return '–';
  if (g === 'bike') return `${fmt(Math.round((3600 / secsPerMile) * 10) / 10)} mph`;
  if (g === 'swim') return `${fmtTime(Math.round((secsPerMile / METERS_PER_MILE) * 100))} /100m`;
  return `${fmtTime(Math.round(secsPerMile))} /mi`;
}

const paceLabel = (g: G) => (g === 'bike' ? 'Avg speed' : 'Avg pace');

/** Strava-style stats for cardio: totals by period, averages, records, best efforts, and every activity. */
export function CardioStatsSheet({ visible, onClose, initial }: { visible: boolean; onClose: () => void; initial: G }) {
  const c = useColors();
  const { state, today } = useTracker();
  const [g, setG] = useState<G>(initial);
  const r = cardioReport(state.cardio, state.profile, today, g);
  const { long, sports } = planWeekRows(state.cardio);
  const plan = state.cardio.plan;
  const unitRows = (sport: string, rows: { label: string; planned: number; actual: number }[]) =>
    sport === 'swim' ? rows.map((x) => ({ ...x, planned: Math.round(x.planned * METERS_PER_MILE), actual: Math.round(x.actual * METERS_PER_MILE) })) : rows;

  return (
    <Sheet visible={visible} title="Cardio stats" onClose={onClose}>
      <Select
        label="Sport"
        value={g}
        options={[{ value: 'all' as G, label: 'All sports' }, ...SPORT_GROUPS.map((x) => ({ value: x.id as G, label: x.label }))]}
        onChange={setG}
      />

      {!r.sessions.length ? (
        <Card style={{ marginTop: space.lg }}>
          <Mute>Nothing logged yet.</Mute>
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: space.lg }}>
            <View style={st.tr}>
              <Text style={[st.th, { color: c.mute, flex: 1.3 }]} />
              {['Week', 'Month', 'Year', 'All'].map((h) => (
                <Text key={h} style={[st.th, { color: c.mute }]}>
                  {h}
                </Text>
              ))}
            </View>
            <PeriodRow label="Activities" t={[r.week, r.month, r.year, r.all]} f={(t) => String(t.count)} />
            <PeriodRow label={g === 'swim' ? 'Meters' : 'Miles'} t={[r.week, r.month, r.year, r.all]} f={(t) => (g === 'swim' ? fmtInt(t.miles * METERS_PER_MILE) : fmt(Math.round(t.miles * 10) / 10))} />
            <PeriodRow label="Time" t={[r.week, r.month, r.year, r.all]} f={(t) => (t.secs ? hm(t.secs) : '–')} />
            {g !== 'swim' ? <PeriodRow label="Elev. ft" t={[r.week, r.month, r.year, r.all]} f={(t) => (t.elevFt ? fmtInt(t.elevFt) : '–')} /> : null}
            <PeriodRow label="Calories" t={[r.week, r.month, r.year, r.all]} f={(t) => (t.kcal ? fmtInt(t.kcal) : '–')} />
          </Card>

          <Section title="Averages">
            <View style={st.grid}>
              <Big label={paceLabel(g)} value={paceFor(g, r.avgPace)} />
              <Big label="Avg distance" value={r.avgMiles != null ? distFor(g, r.avgMiles) : '–'} />
              <Big label="Avg time" value={r.avgSecs != null ? fmtTime(Math.round(r.avgSecs)) : '–'} />
              <Big label="Avg heart rate" value={r.avgHr != null ? `${r.avgHr} bpm` : '–'} />
            </View>
          </Section>

          <Section title="Records">
            <Record label="Longest" x={r.longest} value={(x) => distFor(g === 'all' ? groupOf(x.type) : g, x.miles!)} />
            <Record label={g === 'bike' ? 'Fastest' : 'Fastest pace'} x={r.fastest} value={(x) => paceFor(g === 'all' ? groupOf(x.type) : g, x.secs! / x.miles!)} />
            {g !== 'swim' ? <Record label="Biggest climb" x={r.biggestClimb} value={(x) => `${fmtInt(x.elevFt!)} ft`} /> : null}
          </Section>

          {r.efforts.length ? (
            <Section title="Best efforts">
              {r.efforts.map((e, i) => (
                <View key={e.label} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                  <Text style={{ flex: 1, color: c.ink, fontSize: 15, fontWeight: '600' }}>{e.label}</Text>
                  <Mute style={{ fontSize: 13 }}>{shortDayLabel(e.date)}</Mute>
                  <Text style={[st.val, { color: c.ink }]}>{fmtTime(Math.round(e.secs))}</Text>
                </View>
              ))}
              <Mute style={{ fontSize: 12.5, marginTop: space.xs }}>From your fastest run of at least that distance, at its average pace.</Mute>
            </Section>
          ) : null}

          <DistanceChart g={g} sessions={r.sessions} today={today} />

          {plan && sports.length && (g === 'all' || sports.some((x) => x.sport === g)) ? (
            <Section title={planTitle(plan.id)}>
              {long.length ? (
                <>
                  <Text style={[st.sub, { color: c.ink }]}>{`Long ${SPORT_LABEL[sports[0].sport].toLowerCase()} by week`}</Text>
                  <PlanBars rows={unitRows(sports[0].sport, long)} unit={sports[0].sport === 'swim' ? 'm' : 'mi'} label="Long session by plan week" />
                </>
              ) : null}
              {sports
                .filter((x) => g === 'all' || x.sport === g)
                .map((x) => (
                  <View key={x.sport} style={{ marginTop: space.md }}>
                    <Text style={[st.sub, { color: c.ink }]}>{`${SPORT_LABEL[x.sport]} distance by week`}</Text>
                    <PlanBars rows={unitRows(x.sport, x.rows)} unit={x.sport === 'swim' ? 'm' : 'mi'} label={`${SPORT_LABEL[x.sport]} by plan week`} />
                  </View>
                ))}
              <ChartKey items={['planned', 'logged']} />
            </Section>
          ) : null}

          <Section title="Activities">
            {r.sessions.slice(0, 30).map((x, i) => (
              <Activity key={x.id} x={x} first={i === 0} />
            ))}
          </Section>
        </>
      )}
    </Sheet>
  );
}

/** Distance in each day, week or month of the chosen range. */
function DistanceChart({ g, sessions, today }: { g: G; sessions: CardioSession[]; today: string }) {
  const c = useColors();
  const [range, setRange] = useState<Range>('month');
  const first = sessions.length ? sessions[sessions.length - 1].date : null;
  const span = rangeSpan(range, today, first);
  const swim = g === 'swim';
  const vals = sumByBucket(sessions, (x) => x.date, (x) => (x.miles ?? 0) * (swim ? METERS_PER_MILE : 1), span.buckets).map((v) => (swim ? Math.round(v) : Math.round(v * 10) / 10));
  const total = vals.reduce((a, b) => a + b, 0);
  const unit = swim ? 'm' : 'mi';
  return (
    <Section title="Distance" action={<Text style={{ color: c.mute, fontSize: 14, fontWeight: '700', ...tabular }}>{`${swim ? fmtInt(total) : fmt(Math.round(total * 10) / 10)} ${unit} in range`}</Text>}>
      <RangeTabs value={range} onChange={setRange} />
      <ChartCaption>{`${span.caption} · ${swim ? 'meters' : 'miles'} per ${span.per}`}</ChartCaption>
      <BarChart values={vals} labels={span.buckets.map((b) => b.label)} unit={unit} label={`Distance per ${span.per}, ${span.caption.toLowerCase()}`} />
    </Section>
  );
}

/** "3h 25m", "45m". */
function hm(secs: number): string {
  const m = Math.round(secs / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function PeriodRow({ label, t, f }: { label: string; t: CardioTotals[]; f: (t: CardioTotals) => string }) {
  const c = useColors();
  return (
    <View style={[st.tr, { borderTopWidth: 1, borderTopColor: c.line }]}>
      <Text style={{ flex: 1.3, color: c.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      {t.map((x, i) => (
        <Text key={i} style={[st.td, { color: c.ink }]}>
          {f(x)}
        </Text>
      ))}
    </View>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ width: '50%', paddingVertical: space.sm }}>
      <Text style={[st.big, { color: c.ink }]}>{value}</Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Record({ label, x, value }: { label: string; x: CardioSession | null; value: (x: CardioSession) => string }) {
  const c = useColors();
  return (
    <View style={[st.row, label !== 'Longest' && { borderTopWidth: 1, borderTopColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {x ? <Mute style={{ fontSize: 13 }}>{`${CARDIO_LABEL[x.type]} · ${shortDayLabel(x.date)}`}</Mute> : null}
      </View>
      <Text style={[st.val, { color: c.ink }]}>{x ? value(x) : '–'}</Text>
    </View>
  );
}

function Activity({ x, first }: { x: CardioSession; first: boolean }) {
  const c = useColors();
  const g = groupOf(x.type);
  const bits = [
    x.miles ? distFor(g, x.miles) : null,
    x.secs ? fmtTime(x.secs) : null,
    x.miles && x.secs ? paceFor(g, x.secs / x.miles) : null,
    x.elevFt ? `${fmtInt(x.elevFt)} ft` : null,
    x.hr ? `${x.hr} bpm` : null,
    x.kcal ? `${fmtInt(x.kcal)} kcal` : null,
  ].filter(Boolean);
  return (
    <View style={[st.row, !first && { borderTopWidth: 1, borderTopColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{`${CARDIO_LABEL[x.type]} · ${shortDayLabel(x.date)}`}</Text>
        <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>{bits.join(' · ')}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  th: { flex: 1, textAlign: 'right', fontSize: 12.5, fontWeight: '600' },
  td: { flex: 1, textAlign: 'right', fontSize: 14, ...tabular },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  big: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, ...tabular },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  val: { fontFamily: fonts.semi, fontSize: 18, lineHeight: 22, ...tabular },
  sub: { fontSize: 14, fontWeight: '600', marginBottom: space.xs },
});
