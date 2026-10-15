import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  CARDIO_LABEL,
  PLAN_BY_ID,
  addDays,
  mondayOf,
  KIND_LABEL,
  KIND_TIPS,
  SPORT_LABEL,
  distText,
  fmt,
  fmtTime,
  isSkipped,
  paceText,
  planTitle,
  planWeek,
  planWeeks,
  plannedOn,
  raceDay,
  recordsSetBy,
  sessionsToward,
  shortDayLabel,
  skipKey,
  weeklyTotals,
  workoutStatus,
  type CardioSession,
  type PlannedWorkout,
  type RunStatus,
} from '@/logic';
import { WeekStrip } from '@/ui/cardio/WeekStrip';
import { kindColor } from '@/ui/cardio/kinds';
import { LogSheet } from '@/ui/cardio/LogSheet';
import { useRecording } from '@/ui/cardio/Recorder';
import { useRecorder } from '@/ui/cardio/RecordingProvider';
import { RouteMap } from '@/ui/cardio/RouteMap';
import { Card, Header, Mute, Section, WeekBar } from '@/ui/components';
import { Button, LinkButton } from '@/ui/food/kit';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors, type Palette } from '@/ui/theme';

export default function CardioScreen() {
  const c = useColors();
  const { state, today, update } = useTracker();
  const cardio = state.cardio;
  const [selected, setSelected] = useState(today);
  const [sheet, setSheet] = useState<{ n: number; open: boolean; editing: CardioSession | null }>({ n: 0, open: false, editing: null });
  const recorder = useRecorder();
  const recording = useRecording();
  const scroll = useRef<ScrollView>(null);
  const detailY = useRef(0);

  const open = (editing: CardioSession | null) => setSheet((s) => ({ n: s.n + 1, open: true, editing }));

  const plan = cardio.plan;
  const weeks = planWeeks(plan);
  const w = planWeek(plan, today);
  const race = raceDay(plan);
  const thisWeek = weeklyTotals(cardio, today, 1)[0];
  const planned = plannedOn(plan, selected);
  const [shown, setShown] = useState(15);
  const history = cardio.sessions.filter((x) => x.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const weekPlan = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i)).flatMap((d) =>
    plannedOn(plan, d).map((p) => `${shortDayLabel(d).slice(0, 3)} ${p.race ? 'race' : `${KIND_LABEL[p.kind].toLowerCase()} ${SPORT_LABEL[p.sport].toLowerCase()}`} ${distText(p.sport, p.miles)}`),
  );
  const sessions = cardio.sessions.filter((x) => x.date === selected);
  const toggleSkip = (wk: PlannedWorkout) =>
    update((s) => {
      const key = skipKey(wk);
      const on = isSkipped(s.cardio, wk);
      // Un-skipping also clears a whole-day skip saved by earlier versions.
      const skips = on ? s.cardio.skips.filter((d) => d !== key && d !== wk.date) : [...s.cardio.skips, key];
      return { ...s, cardio: { ...s.cardio, skips } };
    });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Cardio" />

        <Button label={recording ? 'Open recording' : 'Record an activity'} primary onPress={recorder.open} style={{ marginBottom: space.lg }} />

        <WeekStrip
          cardio={cardio}
          today={today}
          selected={selected}
          onSelect={(s) => {
            setSelected(s);
            scroll.current?.scrollTo({ y: Math.max(detailY.current - 220, 0), animated: true });
          }}
        />

        <View onLayout={(e) => (detailY.current = e.nativeEvent.layout.y)}>
          <Card>
            <View style={st.dtitle}>
              <Text style={[st.title, { color: c.ink }]}>{selected === today ? 'Today' : shortDayLabel(selected)}</Text>
              {planned[0]?.race ? <Text style={[st.chip, { backgroundColor: kindColor(c, 'race'), color: c.onType }]}>Race day</Text> : null}
            </View>

            {planned.map((wk) => (
              <PlannedBlock key={wk.sport} wk={wk} status={workoutStatus(cardio, wk, today)} movedTo={sessionsToward(cardio, wk).find((x) => x.date !== wk.date)?.date ?? null} onSkip={() => toggleSkip(wk)} c={c} />
            ))}

            {sessions.length ? (
              <View style={{ marginTop: space.md }}>
                {sessions.map((x, i) => (
                  <SessionRow key={x.id} x={x} prs={recordsSetBy(cardio, x, today)} first={i === 0} onPress={() => open(x)} c={c} />
                ))}
              </View>
            ) : !planned.length ? (
              <>
                <Text style={[st.planTitle, { color: c.ink, marginTop: space.sm }]}>None</Text>
                <Mute>Rest day</Mute>
              </>
            ) : null}

            <Button label="Log cardio" onPress={() => open(null)} style={{ marginTop: space.lg }} />
          </Card>
        </View>
        <Section title="Your plan">
          {plan ? (
            <>
              <View style={st.weekline}>
                <Text style={[st.planName, { color: c.ink }]}>{planTitle(plan.id)}</Text>
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>
                  {today < plan.start
                    ? `Starts ${shortDayLabel(plan.start)}`
                    : w == null
                      ? 'Complete'
                      : weeks != null
                        ? `Week ${w + 1} of ${weeks}`
                        : `Week ${w + 1}`}
                </Text>
              </View>
              {weeks != null ? (
                <View style={{ marginTop: space.md }}>
                  <WeekBar weeks={weeks} current={w ?? (today < plan.start ? -1 : weeks)} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={st.weekline}>
              <Text style={[st.planName, { color: c.ink }]}>No plan</Text>
              <LinkButton label="Choose a plan" onPress={() => router.navigate('/you')} />
            </View>
          )}
          <View style={[st.stats, { borderTopColor: c.line }]}>
            <Stat label="This week" value={`${fmt(+thisWeek.miles.toFixed(1))} mi`} c={c} />
            {thisWeek.secs ? <Stat label="Time" value={fmtTime(thisWeek.secs)} c={c} /> : null}
            {race && today <= race ? <Stat label="Race day" value={shortDayLabel(race).replace(/^\w+, /, '')} c={c} /> : null}
          </View>
          {plan ? (
            <>
              <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21, marginTop: space.md }}>{PLAN_BY_ID[plan.id].blurb}</Text>
              {weekPlan.length ? (
                <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21, marginTop: space.sm }}>
                  <Text style={{ fontWeight: '700' }}>This week: </Text>
                  {weekPlan.join(' · ')}
                </Text>
              ) : null}
              <Mute style={{ fontSize: 13.5, lineHeight: 19, marginTop: space.sm }}>
                How it works: distances build a little each week, with an easier week every few weeks so you recover. Easy days should feel conversational; tempo is comfortably hard; the long one is slow and steady. Swipe ahead in the week row to see what’s coming.
              </Mute>
              <View style={[st.foot, { borderTopColor: c.line }]}>
                <LinkButton label="Change plan" onPress={() => router.navigate('/you')} />
              </View>
            </>
          ) : (
            <Mute style={{ marginTop: space.sm }}>Follow a plan for a 5K, half marathon, century ride, triathlon and more, or just log what you do.</Mute>
          )}
        </Section>

        <Section title="History">
          {history.length ? null : <Mute>No activities yet.</Mute>}
          {history.slice(0, shown).map((x, i) => (
            <SessionRow key={x.id} x={x} prs={recordsSetBy(cardio, x, today)} first={i === 0} date onPress={() => open(x)} c={c} />
          ))}
          {history.length > shown ? (
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <LinkButton label={`Show more (${history.length - shown})`} onPress={() => setShown((n) => n + 20)} />
            </View>
          ) : null}
        </Section>
      </ScrollView>
      <LogSheet key={sheet.n} visible={sheet.open} day={selected} editing={sheet.editing} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </SafeAreaView>
  );
}

/** One planned workout on the selected day: what, how far, how, its status, and skip. */
function PlannedBlock({ wk, status, movedTo, onSkip, c }: { wk: PlannedWorkout; status: RunStatus; movedTo: string | null; onSkip: () => void; c: Palette }) {
  const title = wk.race ? `Race: ${SPORT_LABEL[wk.sport].toLowerCase()}` : `${KIND_LABEL[wk.kind]} ${SPORT_LABEL[wk.sport].toLowerCase()}`;
  const [num, unit] = distText(wk.sport, wk.miles).split(' ');
  return (
    <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
      <View style={[st.rail, { backgroundColor: kindColor(c, wk.kind) }]} />
      <View style={st.planBody}>
        <View style={st.planRow}>
          <Text style={[st.planTitle, { color: c.ink, flex: 1 }]}>{title}</Text>
          <Text style={[st.planMiles, { color: c.ink }]}>
            {num}
            <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}> {unit}</Text>
          </Text>
        </View>
        <Text style={{ color: c.ink, fontSize: 14 }}>{KIND_TIPS[wk.kind]}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs, gap: space.sm }}>
          <StatusBadge st={status} movedTo={movedTo} c={c} />
          {status !== 'done' && status !== 'moved' ? <LinkButton label={status === 'skipped' ? 'Undo skip' : 'Skip'} onPress={onSkip} color={c.mute} /> : null}
        </View>
      </View>
    </View>
  );
}

function SessionRow({ x, prs, first, date, onPress, c }: { x: CardioSession; prs: string[]; first: boolean; date?: boolean; onPress: () => void; c: Palette }) {
  const pace = x.type === 'run' || x.type === 'walk' || x.type === 'hike' ? paceText(x.miles, x.secs) : '';
  const bits = [x.miles ? distText(x.type, x.miles) : null, x.secs ? fmtTime(x.secs) : null, pace || null].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${CARDIO_LABEL[x.type]}, ${bits}. Edit`}
      style={({ pressed }) => [st.session, !first && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{CARDIO_LABEL[x.type]}</Text>
        <Text style={{ color: c.mute, fontSize: 14, ...tabular }}>{date ? `${shortDayLabel(x.date)} · ${bits}` : bits}</Text>
        {x.planDay && x.planDay !== x.date ? <Text style={{ color: c.mute, fontSize: 13 }}>Counts toward {shortDayLabel(x.planDay)}’s plan</Text> : null}
        {prs.length ? <Text style={{ color: '#b8860b', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{`Personal record: ${prs.join(', ')}`}</Text> : null}
        {x.note ? <Text style={{ color: c.ink, fontSize: 14, marginTop: 2 }}>{x.note}</Text> : null}
        {x.route && !date ? <RouteMap route={x.route} height={150} style={{ marginTop: space.sm }} /> : null}
      </View>
      <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: Palette }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 24, lineHeight: 28, ...tabular }}>{value}</Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function StatusBadge({ st: status, movedTo, c }: { st: RunStatus; movedTo: string | null; c: Palette }) {
  const m =
    status === 'done' ? { t: 'Completed', fg: c.ok, bg: c.okbg, mark: 'done' as const }
    : status === 'missed' ? { t: 'Missed', fg: c.bad, bg: c.badbg, mark: 'missed' as const }
    : status === 'partial' ? { t: 'Partial', fg: c.warn, bg: c.warnbg, mark: 'partial' as const }
    : status === 'skipped' ? { t: 'Skipped', fg: c.mute, bg: c.soft, mark: null }
    : status === 'moved' ? { t: `Done on ${movedTo ? shortDayLabel(movedTo) : 'another day'}`, fg: c.ok, bg: c.okbg, mark: 'done' as const }
    : null;
  if (!m) return <View />;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={[st.badge, { backgroundColor: m.bg }]}>
        {m.mark ? <StatusMark kind={m.mark} color={m.fg} size={14} /> : null}
        <Text style={{ color: m.fg, fontSize: 13, fontWeight: '700' }}>{m.t}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  weekline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md },
  planName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  stats: { flexDirection: 'row', gap: space.md, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1 },
  dtitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  chip: { fontSize: 13, fontWeight: '700', borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space.md, paddingVertical: 5, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  plan: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.md },
  rail: { width: 5 },
  planBody: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, gap: 3 },
  planTitle: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  planRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  planMiles: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  session: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  foot: { flexDirection: 'row', borderTopWidth: 1, paddingTop: space.md, marginTop: space.md },
});
