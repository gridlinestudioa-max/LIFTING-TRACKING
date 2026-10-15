import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CYCLE_KIND_LABEL,
  CYCLE_PRESETS,
  activeCycle,
  addDays,
  cycleEnd,
  cycleLine,
  cycleStatus,
  fmt,
  fmtInt,
  missingForSuggestions,
  planFor,
  shortDayLabel,
  startCycle,
  statsOf,
  weeklyText,
  weightSeries,
  weightTrend,
  type CycleKind,
  type CyclePlan,
  type Stats,
} from '@/logic';

import { Mute, Section, WeekBar } from '../components';
import { Button, LinkButton, Pill, Sheet } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';

/** Your stats, using your recent weight trend when you've logged weights. */
function useStats(): { stats: Stats | null; trendLb: number | null } {
  const { state, today } = useTracker();
  return useMemo(() => {
    const series = weightSeries(state.days, today, 60);
    const trend = weightTrend(series);
    const last = series[series.length - 1]?.v ?? null;
    const smooth = trend[trend.length - 1]?.v ?? null;
    const s = statsOf(state.profile, today);
    // The smoothed weight, so one heavy or light day doesn't skew the plan.
    const now = smooth != null ? Math.round(smooth * 10) / 10 : last;
    return { stats: s ? { ...s, weightLb: now ?? s.weightLb } : null, trendLb: smooth != null ? Math.round(smooth * 10) / 10 : null };
  }, [state.days, state.profile, today]);
}

/** The cut, bulk or maintenance phase on Progress: how it's going, or a way to start one. */
export function CycleCard() {
  const c = useColors();
  const { state, today, update } = useTracker();
  const { trendLb } = useStats();
  const [open, setOpen] = useState(false);
  const cy = activeCycle(state.cycle, today);
  const ended = state.cycle && !cy && today > cycleEnd(state.cycle) ? state.cycle : null;

  return (
    <>
      <Section title="Cut, bulk or maintain" action={<LinkButton label={cy ? 'Change' : 'Plans'} onPress={() => setOpen(true)} />}>
        {cy ? (
          (() => {
            const s = cycleStatus(cy, today, trendLb);
            const name = CYCLE_PRESETS.find((p) => p.id === cy.preset)?.name ?? CYCLE_KIND_LABEL[cy.kind];
            return (
              <>
                <View style={st.titleRow}>
                  <Text style={[st.name, { color: c.ink }]}>{name}</Text>
                  <Text style={{ color: c.mute, fontSize: 13.5, fontWeight: '600' }}>{s.daysLeft ? `${s.daysLeft} days left` : 'Last day'}</Text>
                </View>
                <View style={{ marginTop: space.sm }}>
                  <WeekBar weeks={cy.weeks} current={s.week - 1} />
                </View>
                <View style={[st.nums, { borderTopColor: c.line }]}>
                  <Num value={fmtInt(cy.intake)} unit="kcal" label="Eat a day" />
                  <Num value={fmtInt(cy.proteinG)} unit="g" label="Protein a day" />
                  <Num value={trendLb != null ? fmt(trendLb) : '–'} unit={trendLb != null ? 'lb' : undefined} label="Weight trend" />
                </View>
                <Text style={{ color: c.ink, fontSize: 14, marginTop: space.sm }}>{`${cycleLine(cy)}. Expected weight by now: ${fmt(s.expectedLb)} lb.`}</Text>
                {s.verdict ? (
                  <Text style={{ color: s.verdict === 'On track' ? c.ok : c.warn, fontSize: 14, fontWeight: '700', marginTop: 4 }}>{s.verdict}</Text>
                ) : (
                  <Mute style={{ fontSize: 13, marginTop: 4 }}>Weigh in a few times a week (Home → Weight) to see if you’re on track.</Mute>
                )}
              </>
            );
          })()
        ) : ended ? (
          <>
            <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>
              {`Your ${CYCLE_KIND_LABEL[ended.kind].toLowerCase()} ended ${shortDayLabel(cycleEnd(ended))}. ${ended.kind === 'cut' ? 'Next, two weeks at maintenance (a diet break) helps your body and your hunger settle.' : 'Pick what’s next.'}`}
            </Text>
            <Button label="Choose what’s next" primary onPress={() => setOpen(true)} style={{ marginTop: space.md }} />
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <LinkButton label="Clear" color={c.mute} onPress={() => update((x) => ({ ...x, cycle: null }))} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>Lose fat, build muscle or hold steady with a plan that sets your daily calories and protein from what you burn.</Text>
            <Button label="See plans" primary onPress={() => setOpen(true)} style={{ marginTop: space.md }} />
          </>
        )}
      </Section>
      {open ? <CycleSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Num({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[st.num, { color: c.ink }]}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

/** Pick a cut, maintenance or bulk plan, worked out for you. */
export function CycleSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const { stats } = useStats();
  const cy = activeCycle(state.cycle, today);
  const [kind, setKind] = useState<CycleKind>(cy?.kind ?? 'cut');
  const missing = missingForSuggestions(state.profile, today);
  const plans = stats ? CYCLE_PRESETS.filter((p) => p.kind === kind).map((p) => planFor(p, stats)) : [];

  const start = (p: CyclePlan) => {
    if (!stats) return;
    update((s) => ({ ...s, cycle: startCycle(p, stats, today) }));
    onClose();
  };

  return (
    <Sheet visible title="Cut, bulk or maintain" onClose={onClose}>
      {cy ? (
        <View style={[st.current, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{`Now: ${CYCLE_PRESETS.find((p) => p.id === cy.preset)?.name}, until ${shortDayLabel(cycleEnd(cy))}`}</Text>
          <View style={{ flexDirection: 'row', marginTop: space.xs }}>
            <LinkButton
              label="End it now"
              color={c.bad}
              onPress={() => {
                update((s) => ({ ...s, cycle: null }));
                onClose();
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={st.pills}>
        {(['cut', 'maintain', 'bulk'] as const).map((k) => (
          <Pill key={k} label={CYCLE_KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Mute style={{ marginBottom: space.md }}>
        {kind === 'cut'
          ? 'Eat a little under what you burn to lose fat while keeping muscle. Slower cuts are easier to stick to and keep more muscle.'
          : kind === 'bulk'
            ? 'Eat a little over what you burn, and lift, to build muscle. A small surplus keeps fat gain low.'
            : 'Eat about what you burn. Good between a cut and a bulk, or to build muscle slowly at the same weight.'}
      </Mute>

      {!stats ? (
        <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>
          {`To work out your plan, add ${missing ?? 'your details'} in Settings → Your details. Your calories and protein come from your size and how active you are.`}
        </Text>
      ) : (
        plans.map((p) => (
          <View key={p.preset.id} style={[st.plan, { backgroundColor: c.card, borderColor: c.line }]}>
            <View style={st.titleRow}>
              <Text style={[st.name, { color: c.ink }]}>{p.preset.name}</Text>
              <Text style={{ color: c.mute, fontSize: 13.5, fontWeight: '600' }}>{`${p.preset.weeks} weeks`}</Text>
            </View>
            <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{p.preset.blurb}</Text>
            {p.blocked ? (
              <Text style={{ color: c.warn, fontSize: 14, fontWeight: '600', marginTop: space.sm }}>{p.blocked}</Text>
            ) : (
              <>
                <View style={[st.nums, { borderTopColor: c.line }]}>
                  <Num value={fmtInt(p.intake)} unit="kcal" label="Eat a day" />
                  <Num value={fmtInt(p.proteinG)} unit="g" label="Protein" />
                  <Num value={p.delta === 0 ? '±0' : `${p.delta > 0 ? '+' : '−'}${fmtInt(Math.abs(p.delta))}`} label="vs. what you burn" />
                </View>
                <Text style={{ color: c.ink, fontSize: 14, marginTop: space.sm }}>
                  {`You burn about ${fmtInt(p.burn)} kcal a day. Expect ${p.preset.kind === 'maintain' ? 'to stay about the same weight' : `${p.weeklyLb < 0 ? 'to lose' : 'to gain'} ${weeklyText(p.weeklyLb)}`}${p.preset.kind === 'maintain' ? '' : `, about ${fmt(p.endWeightLb)} lb by ${shortDayLabel(addDays(today, p.preset.weeks * 7 - 1))}`}.`}
                </Text>
                {p.notes.map((n) => (
                  <Text key={n} style={{ color: c.mute, fontSize: 13, marginTop: 2 }}>
                    {n}
                  </Text>
                ))}
                <Button label={`Start ${p.preset.name.toLowerCase()}`} primary onPress={() => start(p)} style={{ marginTop: space.md }} />
              </>
            )}
          </View>
        ))
      )}

      <Text style={{ color: c.mute, fontSize: 12.5, lineHeight: 18, marginTop: space.md }}>
        Plans stay inside common safe ranges: losing 0.5–1% of body weight a week, never more than 1,000 kcal a day under or below
        your resting burn (and at least 1,200 kcal for women or 1,500 for men), gaining 0.25–0.5% a week, and 1.6–2.2 g of protein
        per kg. They’re general guidance for healthy adults, not medical advice. If you’re pregnant, under 18, have a medical
        condition or a history of disordered eating, talk to a doctor or dietitian first.
      </Text>
    </Sheet>
  );
}

const st = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  name: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  nums: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space.sm, marginTop: space.md },
  num: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, ...tabular },
  pills: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  plan: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  current: { borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
});
