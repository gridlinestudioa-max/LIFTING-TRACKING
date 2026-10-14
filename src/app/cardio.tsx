import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CARDIO_LABEL,
  LONG,
  PLAN_WEEKS,
  RUN_LABEL,
  RUN_TIPS,
  fmt,
  fmtTime,
  paceText,
  planRun,
  planWeek,
  runStatus,
  shortDayLabel,
  toD,
  weeklyTotals,
  type CardioSession,
  type RunStatus,
} from '@/logic';
import { CardioCalendar } from '@/ui/cardio/CardioCalendar';
import { LogSheet } from '@/ui/cardio/LogSheet';
import { Card, Header, Mute, WeekBar } from '@/ui/components';
import { Button, Pill } from '@/ui/food/kit';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors, type Palette } from '@/ui/theme';

export default function CardioScreen() {
  const c = useColors();
  const { state, today, update } = useTracker();
  const cardio = state.cardio;
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState(() => {
    const d = toD(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [sheet, setSheet] = useState<{ n: number; open: boolean; editing: CardioSession | null }>({ n: 0, open: false, editing: null });
  const scroll = useRef<ScrollView>(null);
  const detailY = useRef(0);

  const shift = (n: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const open = (editing: CardioSession | null) => setSheet((s) => ({ n: s.n + 1, open: true, editing }));

  const w = planWeek(cardio.plan, today);
  const thisWeek = weeklyTotals(cardio, today, 1)[0];
  const run = planRun(cardio.plan, selected);
  const status = runStatus(cardio, selected, today);
  const sessions = cardio.sessions.filter((x) => x.date === selected);
  const doneElsewhere = run ? cardio.sessions.filter((x) => x.planDay === selected && x.date !== selected) : [];
  const skipped = cardio.skips.includes(selected);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Cardio">
          {cardio.plan ? (
            <>
              <WeekBar current={w ?? (today < cardio.plan.start ? -1 : PLAN_WEEKS)} />
              <View style={st.weekline}>
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>
                  {w != null ? `Week ${w + 1} of ${PLAN_WEEKS}` : today < cardio.plan.start ? 'Plan starts soon' : 'Plan complete'}
                </Text>
                {w != null ? <Text style={{ color: c.mute, fontSize: 14 }}>Long run this week: {fmt(LONG[w])} mi</Text> : null}
              </View>
            </>
          ) : null}
          <Text style={{ color: c.mute, fontSize: 14, marginTop: space.sm, ...tabular }}>
            This week: {fmt(+thisWeek.miles.toFixed(1))} mi{thisWeek.secs ? ` · ${fmtTime(thisWeek.secs)}` : ''}
          </Text>
        </Header>

        <CardioCalendar
          cardio={cardio}
          today={today}
          selected={selected}
          year={view.y}
          month={view.m}
          onSelect={(s) => {
            setSelected(s);
            scroll.current?.scrollTo({ y: Math.max(detailY.current - 220, 0), animated: true });
          }}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
        />

        <View style={{ marginTop: 20 }} onLayout={(e) => (detailY.current = e.nativeEvent.layout.y)}>
          <Card>
            <View style={st.dtitle}>
              <Text style={[st.title, { color: c.ink }]}>{selected === today ? 'Today' : shortDayLabel(selected)}</Text>
              {run ? (
                <Text style={[st.chip, { backgroundColor: c.types[run.type], color: c.onType }]}>{run.race ? 'Race day' : RUN_LABEL[run.type]}</Text>
              ) : null}
            </View>
            {selected === today ? <Mute>{shortDayLabel(selected)}</Mute> : null}
            <StatusBadge st={status} movedTo={doneElsewhere[0]?.date ?? null} c={c} />

            {run ? (
              <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
                <View style={[st.rail, { backgroundColor: c.types[run.type] }]} />
                <View style={st.planBody}>
                  <Text style={{ color: c.mute, fontSize: 13 }}>Planned · week {run.w + 1}</Text>
                  <View style={st.planRow}>
                    <Text style={[st.planTitle, { color: c.ink, flex: 1 }]}>{run.race ? 'Race day' : `${RUN_LABEL[run.type]} run`}</Text>
                    <Text style={[st.planMiles, { color: c.ink }]}>
                      {fmt(run.miles)}
                      <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}> mi</Text>
                    </Text>
                  </View>
                  <Text style={{ color: c.ink, fontSize: 14 }}>{run.race ? RUN_TIPS.race : RUN_TIPS[run.type]}</Text>
                </View>
              </View>
            ) : null}

            {sessions.length ? (
              <View style={{ marginTop: space.md }}>
                {sessions.map((x, i) => (
                  <SessionRow key={x.id} x={x} first={i === 0} onPress={() => open(x)} c={c} />
                ))}
              </View>
            ) : (
              <Mute style={{ marginTop: space.md }}>{run ? 'Nothing logged yet.' : 'No cardio logged this day.'}</Mute>
            )}

            <Button label="Log cardio" primary onPress={() => open(null)} style={{ marginTop: space.lg }} />
            {run && status !== 'done' && status !== 'moved' ? (
              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <Pill
                  label={skipped ? 'Undo skip' : 'Skip this run'}
                  selected={skipped}
                  onPress={() =>
                    update((s) => ({
                      ...s,
                      cardio: { ...s.cardio, skips: skipped ? s.cardio.skips.filter((d) => d !== selected) : [...s.cardio.skips, selected] },
                    }))
                  }
                />
              </View>
            ) : null}
            {skipped ? <Mute style={{ marginTop: space.sm }}>Skipped. You can make it up within a week: log a run and pick this one.</Mute> : null}
          </Card>
        </View>
      </ScrollView>
      <LogSheet key={sheet.n} visible={sheet.open} day={selected} editing={sheet.editing} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </SafeAreaView>
  );
}

function SessionRow({ x, first, onPress, c }: { x: CardioSession; first: boolean; onPress: () => void; c: Palette }) {
  const pace = x.type === 'run' || x.type === 'walk' || x.type === 'hike' ? paceText(x.miles, x.secs) : '';
  const bits = [x.miles ? `${fmt(x.miles)} mi` : null, x.secs ? fmtTime(x.secs) : null, pace || null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${CARDIO_LABEL[x.type]}, ${bits}. Edit`}
      style={({ pressed }) => [st.session, !first && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{CARDIO_LABEL[x.type]}</Text>
        <Text style={{ color: c.mute, fontSize: 14, ...tabular }}>{bits}</Text>
        {x.planDay && x.planDay !== x.date ? <Text style={{ color: c.mute, fontSize: 13 }}>Counts toward {shortDayLabel(x.planDay)}’s run</Text> : null}
        {x.note ? <Text style={{ color: c.ink, fontSize: 14, marginTop: 2 }}>{x.note}</Text> : null}
      </View>
      <Text style={{ color: c.mute, fontSize: 13 }}>Edit</Text>
    </Pressable>
  );
}

function StatusBadge({ st: status, movedTo, c }: { st: RunStatus | null; movedTo: string | null; c: Palette }) {
  const m =
    status === 'done' ? { t: 'Completed', fg: c.ok, bg: c.okbg, mark: 'done' as const }
    : status === 'missed' ? { t: 'Missed', fg: c.bad, bg: c.badbg, mark: 'missed' as const }
    : status === 'partial' ? { t: 'Partial', fg: c.warn, bg: c.warnbg, mark: 'partial' as const }
    : status === 'skipped' ? { t: 'Skipped', fg: c.mute, bg: c.soft, mark: null }
    : status === 'moved' ? { t: `Done on ${movedTo ? shortDayLabel(movedTo) : 'another day'}`, fg: c.ok, bg: c.okbg, mark: 'done' as const }
    : null;
  if (!m) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: space.sm }}>
      <View style={[st.badge, { backgroundColor: m.bg }]}>
        {m.mark ? <StatusMark kind={m.mark} color={m.fg} size={14} /> : null}
        <Text style={{ color: m.fg, fontSize: 13, fontWeight: '700' }}>{m.t}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  weekline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md, marginTop: space.sm },
  dtitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  chip: { fontSize: 13, fontWeight: '700', borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space.md, paddingVertical: 5, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  plan: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.md },
  rail: { width: 5 },
  planBody: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, gap: 3 },
  planTitle: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  planRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  planMiles: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  session: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});
