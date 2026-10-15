import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CARDIO_LABEL,
  KIND_LABEL,
  SPORT_LABEL,
  WIDGETS,
  activeDiet,
  activeWorkout,
  cinFor,
  coutFor,
  dayDiff,
  distText,
  fastHeadline,
  fmt,
  fmtInt,
  fmtTime,
  kcalInfo,
  liftSummary,
  liftWeek,
  loadStatus,
  mondayOf,
  moveWidget,
  paceText,
  planTitle,
  planWeek,
  planWeeks,
  plannedOn,
  raceDay,
  scheduledRoutine,
  shortDayLabel,
  sumTotals,
  trainingLoad,
  visibleWidgets,
  weeklyEffort,
  weeklyTotals,
  workoutLine,
  workoutStatus,
  type WidgetId,
} from '@/logic';
import { SleepCard, StepsCard, WaterCard, WeightCard } from '@/ui/body/BodyCards';
import { Header, Mute, Section, WeekBar } from '@/ui/components';
import { Button, LinkButton, Sheet, useClock } from '@/ui/food/kit';
import { TallyList } from '@/ui/food/Meals';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, toneColor, useColors } from '@/ui/theme';

/** A snapshot of today, made of cards the user picks and orders. */
export default function HomeScreen() {
  const c = useColors();
  const { state, today } = useTracker();
  const [editing, setEditing] = useState(false);
  const shown = visibleWidgets(state.settings.home, state.settings.sections);
  const name = state.settings.name.trim();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title={name ? `Hi, ${name}` : 'Today'} right={<LinkButton label="Edit" onPress={() => setEditing(true)} />}>
          <Text style={{ color: c.mute, fontSize: 15, marginTop: -space.xs }}>{shortDayLabel(today)}</Text>
        </Header>
        {shown.map((id) => (
          <Widget key={id} id={id} />
        ))}
        {!shown.length ? (
          <Section>
            <Mute>Nothing on your Home screen.</Mute>
            <Button label="Add cards" primary onPress={() => setEditing(true)} style={{ marginTop: space.md }} />
          </Section>
        ) : null}
      </ScrollView>
      {editing ? <CustomizeSheet onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}

function Widget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'workout':
      return <WorkoutCard />;
    case 'calories':
      return <CaloriesCard />;
    case 'remaining':
      return <RemainingCard />;
    case 'protein':
      return <ProteinCard />;
    case 'macros':
      return <MacrosCard />;
    case 'fasting':
      return <FastingCard />;
    case 'tally':
      return <TallyCard />;
    case 'week':
      return <WeekCard />;
    case 'plan':
      return <PlanCard />;
    case 'last':
      return <LastCard />;
    case 'streak':
      return <StreakCard />;
    case 'load':
      return <LoadCard />;
    case 'weight':
      return <WeightCard />;
    case 'water':
      return <WaterCard />;
    case 'sleep':
      return <SleepCard />;
    case 'steps':
      return <StepsCard />;
  }
}

/** A card that opens a tab when tapped. */
function Tap({ title, to, children }: { title: string; to: '/food' | '/cardio' | '/lifting' | '/progress'; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable onPress={() => router.navigate(to)} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Section title={title} action={<Text style={{ color: c.mute, fontSize: 22 }}>›</Text>}>
        {children}
      </Section>
    </Pressable>
  );
}

function Big({ value, unit, label, color }: { value: string; unit?: string; label: string; color?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[st.big, { color: color ?? c.ink }]}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function Meter({ value, max, good }: { value: number; max: number; good?: boolean }) {
  const c = useColors();
  const over = !good && value > max;
  return (
    <View style={[st.bar, { backgroundColor: c.soft }]}>
      <View style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: over ? c.bad : good && value >= max ? c.ok : c.ink }} />
    </View>
  );
}

function WorkoutCard() {
  const c = useColors();
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const L = state.lifting;
  const active = activeWorkout(L);
  const routine = scheduledRoutine(L, today);
  const lifted = L.workouts.find((w) => w.done && w.date === today);
  const planned = on.cardio ? plannedOn(state.cardio.plan, today) : [];
  const logged = on.cardio ? state.cardio.sessions.filter((x) => x.date === today) : [];
  const rows: { key: string; title: string; detail: string; done: boolean; to: '/lifting' | '/cardio' }[] = [];
  if (on.lifting) {
    if (lifted) rows.push({ key: 'lift', title: lifted.name, detail: workoutLine(lifted), done: true, to: '/lifting' });
    else if (active) rows.push({ key: 'lift', title: active.name, detail: 'In progress', done: false, to: '/lifting' });
    else if (routine) rows.push({ key: 'lift', title: routine.name, detail: `${routine.items.length} exercises`, done: false, to: '/lifting' });
  }
  for (const wk of planned) {
    const status = workoutStatus(state.cardio, wk, today);
    rows.push({
      key: wk.sport,
      title: wk.race ? `Race: ${SPORT_LABEL[wk.sport].toLowerCase()}` : `${KIND_LABEL[wk.kind]} ${SPORT_LABEL[wk.sport].toLowerCase()}`,
      detail: distText(wk.sport, wk.miles),
      done: status === 'done' || status === 'moved',
      to: '/cardio',
    });
  }
  for (const x of logged.filter((x) => !x.planDay)) {
    rows.push({ key: x.id, title: CARDIO_LABEL[x.type], detail: [x.miles ? distText(x.type, x.miles) : null, x.secs ? fmtTime(x.secs) : null].filter(Boolean).join(' · '), done: true, to: '/cardio' });
  }
  return (
    <Section title="Today’s workout">
      {rows.length ? (
        rows.map((r, i) => (
          <Pressable
            key={r.key}
            onPress={() => router.navigate(r.to)}
            accessibilityRole="button"
            style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={[st.check, { borderColor: r.done ? c.ok : c.line, backgroundColor: r.done ? c.ok : 'transparent' }]}>
              {r.done ? <StatusMark kind="done" color={c.onAccent} size={13} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{r.title}</Text>
              <Text style={{ color: c.mute, fontSize: 13 }}>{r.detail}</Text>
            </View>
            <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
          </Pressable>
        ))
      ) : (
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>Rest day</Text>
      )}
    </Section>
  );
}

function CaloriesCard() {
  const c = useColors();
  const { state, today } = useTracker();
  const cin = cinFor(state, today);
  const cout = coutFor(state, today, today);
  const k = kcalInfo(cin, cout, state.goal);
  const net = cin != null && cout != null ? cout - cin : null;
  return (
    <Tap title="Calories" to="/food">
      <View style={{ flexDirection: 'row' }}>
        <Big value={cin != null ? fmtInt(cin) : '–'} label="In" />
        <Big value={cout != null ? fmtInt(cout) : '–'} label="Out" />
        <Big
          value={net != null ? fmtInt(Math.abs(net)) : '–'}
          label={net == null ? 'Net' : net >= 0 ? 'Deficit' : 'Surplus'}
          color={net == null ? undefined : toneColor(c, k.tone)}
        />
      </View>
      {state.goal && net != null ? <Meter value={Math.max(0, net)} max={state.goal} good /> : null}
      {state.goal ? <Text style={{ color: c.mute, fontSize: 13, marginTop: space.xs }}>{`Goal: ${fmtInt(state.goal)} deficit`}</Text> : null}
    </Tap>
  );
}

function useTodayTotals() {
  const { state, today } = useTracker();
  return { t: sumTotals(state.meals[today] ?? []), limits: activeDiet(state.diet, state.profile).limits, typed: state.days[today]?.cin ?? 0 };
}

function RemainingCard() {
  const c = useColors();
  const { t, limits, typed } = useTodayTotals();
  const eaten = t.kcal + typed;
  const max = limits.kcalMax;
  return (
    <Tap title="Calories left" to="/food">
      {max ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            <Big value={fmtInt(Math.abs(max - eaten))} label={eaten <= max ? 'Left' : 'Over'} color={eaten > max ? c.bad : undefined} />
            <Big value={fmtInt(eaten)} label={`Eaten of ${fmtInt(max)}`} />
          </View>
          <Meter value={eaten} max={max} />
        </>
      ) : (
        <Mute>Set a calorie target on the Food tab.</Mute>
      )}
    </Tap>
  );
}

function ProteinCard() {
  const { t, limits } = useTodayTotals();
  const target = limits.proteinMin;
  return (
    <Tap title="Protein" to="/food">
      <View style={{ flexDirection: 'row' }}>
        <Big value={fmtInt(t.protein)} unit="g" label="Eaten" />
        {target ? <Big value={fmtInt(Math.max(0, target - t.protein))} unit="g" label={`To go of ${fmtInt(target)} g`} /> : <Big value="–" label="No target set" />}
      </View>
      {target ? <Meter value={t.protein} max={target} good /> : null}
    </Tap>
  );
}

function MacrosCard() {
  const { t } = useTodayTotals();
  const cells: [string, number][] = [
    ['Protein', t.protein],
    ['Carbs', t.carbs],
    ['Fat', t.fat],
    ['Fiber', t.fiber],
    ['Sugar', t.sugar],
    ['Net carbs', t.netCarbs],
  ];
  return (
    <Tap title="Macros" to="/food">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
        {cells.map(([l, v]) => (
          <View key={l} style={{ width: '33.333%' }}>
            <Big value={fmt(Math.round(v))} unit="g" label={l} />
          </View>
        ))}
      </View>
    </Tap>
  );
}

function FastingCard() {
  const c = useColors();
  const { state } = useTracker();
  const now = useClock();
  const f = activeDiet(state.diet, state.profile).fasting;
  const head = f ? fastHeadline(f, now) : null;
  return (
    <Tap title="Fasting" to="/food">
      {head ? (
        <>
          <Text style={[st.big, { color: toneColor(c, head.open ? 'ok' : 'warn') }]}>{head.title}</Text>
          <Text style={{ color: c.ink, fontSize: 15 }}>{head.detail}</Text>
        </>
      ) : (
        <Mute>No fasting window set.</Mute>
      )}
    </Tap>
  );
}

function TallyCard() {
  const { today } = useTracker();
  const now = useClock();
  const { state } = useTracker();
  if (!(state.meals[today] ?? []).some((e) => e.tally)) {
    return (
      <Tap title="Tally" to="/food">
        <Mute>Nothing tallied today. Add a food to today’s Tally from Add food.</Mute>
      </Tap>
    );
  }
  return <TallyList day={today} isToday now={now} />;
}

function WeekCard() {
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const week = liftWeek(state.lifting, today);
  const lifted = week.filter((d) => d.done).length;
  const scheduled = week.filter((d) => d.routine).length;
  const cardio = weeklyTotals(state.cardio, today, 1)[0];
  const sessions = state.cardio.sessions.filter((x) => x.date >= mondayOf(today) && x.date <= today).length;
  return (
    <Tap title="This week" to="/progress">
      <View style={{ flexDirection: 'row' }}>
        {on.lifting ? <Big value={`${lifted}${scheduled ? `/${scheduled}` : ''}`} label="Lifts" /> : null}
        {on.cardio ? <Big value={String(sessions)} label="Cardio sessions" /> : null}
        {on.cardio ? <Big value={fmt(Math.round(cardio.miles * 10) / 10)} unit="mi" label="Distance" /> : null}
      </View>
    </Tap>
  );
}

function PlanCard() {
  const c = useColors();
  const { state, today } = useTracker();
  const plan = state.cardio.plan;
  if (!plan) {
    return (
      <Tap title="Cardio plan" to="/cardio">
        <Mute>No plan. Choose one on the You tab.</Mute>
      </Tap>
    );
  }
  const weeks = planWeeks(plan);
  const w = planWeek(plan, today);
  const race = raceDay(plan);
  const left = race ? dayDiff(today, race) : null;
  return (
    <Tap title={planTitle(plan.id)} to="/cardio">
      <View style={{ flexDirection: 'row', marginBottom: space.md }}>
        <Big value={today < plan.start ? 'Soon' : w == null ? 'Done' : `${w + 1}${weeks ? `/${weeks}` : ''}`} label="Week" />
        {left != null && left >= 0 ? <Big value={String(left)} label={left === 1 ? 'Day to race' : 'Days to race'} /> : null}
      </View>
      {weeks ? <WeekBar weeks={weeks} current={w ?? (today < plan.start ? -1 : weeks)} /> : null}
      {race ? <Text style={{ color: c.mute, fontSize: 13, marginTop: space.sm }}>{`Race day: ${shortDayLabel(race)}`}</Text> : null}
    </Tap>
  );
}

function LastCard() {
  const c = useColors();
  const { state, today } = useTracker();
  const x = [...state.cardio.sessions].filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <Tap title="Last activity" to="/cardio">
      {x ? (
        <>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{`${CARDIO_LABEL[x.type]} · ${shortDayLabel(x.date)}`}</Text>
          <View style={{ flexDirection: 'row', marginTop: space.sm }}>
            <Big value={x.miles ? distText(x.type, x.miles).split(' ')[0] : '–'} unit={x.miles ? distText(x.type, x.miles).split(' ')[1] : undefined} label="Distance" />
            <Big value={x.secs ? fmtTime(x.secs) : '–'} label="Time" />
            <Big value={x.miles && x.secs && x.type !== 'swim' && x.type !== 'bike' ? paceText(x.miles, x.secs).replace(' /mi', '') : '–'} label="Pace /mi" />
          </View>
        </>
      ) : (
        <Mute>Nothing logged yet.</Mute>
      )}
    </Tap>
  );
}

function LoadCard() {
  const c = useColors();
  const { state, today } = useTracker();
  const series = useMemo(() => trainingLoad(state.cardio, state.profile, today, 84), [state.cardio, state.profile, today]);
  const status = loadStatus(series);
  const last = series[series.length - 1];
  const week = weeklyEffort(state.cardio, state.profile, today, 1)[0].effort;
  return (
    <Tap title="Training load" to="/cardio">
      {last ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            <Big value={fmtInt(week)} label="Effort this week" />
            <Big value={fmtInt(last.fitness)} label="Fitness" />
            <Big value={fmtInt(last.fatigue)} label="Fatigue" />
          </View>
          <Text style={{ color: c.mute, fontSize: 13, marginTop: space.sm }}>
            {status ? `This week: ${status.label.toLowerCase()}.` : 'Keep logging timed workouts. The trend needs about three weeks.'}
          </Text>
        </>
      ) : (
        <Mute>Log a cardio session with a time to see your effort and training load.</Mute>
      )}
    </Tap>
  );
}

function StreakCard() {
  const { state, today } = useTracker();
  const s = liftSummary(state.lifting, today);
  return (
    <Tap title="Lifting streak" to="/progress">
      <View style={{ flexDirection: 'row' }}>
        <Big value={String(s.streak)} unit={s.streak === 1 ? 'week' : 'weeks'} label="In a row" />
        <Big value={fmt(Math.round(s.perWeek * 10) / 10)} label="Per week (12 wk)" />
        <Big value={String(s.last4)} label="Last 4 weeks" />
      </View>
    </Tap>
  );
}

/** Turn cards on or off and change their order. */
function CustomizeSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { state, setSettings } = useTracker();
  const home = state.settings.home;
  const on = state.settings.sections;
  const list = [...home.map((id) => WIDGETS.find((w) => w.id === id)!), ...WIDGETS.filter((w) => !home.includes(w.id))].filter(
    (w) => !w.needs || on[w.needs],
  );
  const set = (h: typeof home) => setSettings({ home: h });
  return (
    <Sheet visible title="Customize Home" onClose={onClose}>
      <Section>
        {list.map((w, i) => {
          const shown = home.includes(w.id);
          const pos = home.indexOf(w.id);
          return (
            <View key={w.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Switch
                value={shown}
                onValueChange={(v) => set(v ? [...home, w.id] : home.filter((x) => x !== w.id))}
                accessibilityLabel={`Show ${w.label}`}
                trackColor={{ true: c.ok, false: c.line }}
                thumbColor="#ffffff"
                {...({ activeThumbColor: '#ffffff' } as object)}
              />
              <Text style={{ flex: 1, color: shown ? c.ink : c.mute, fontSize: 16, fontWeight: '600' }}>{w.label}</Text>
              {shown ? (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Arrow label="↑" a11y={`Move ${w.label} up`} disabled={pos === 0} onPress={() => set(moveWidget(home, w.id, -1))} />
                  <Arrow label="↓" a11y={`Move ${w.label} down`} disabled={pos === home.length - 1} onPress={() => set(moveWidget(home, w.id, 1))} />
                </View>
              ) : null}
            </View>
          );
        })}
      </Section>
    </Sheet>
  );
}

function Arrow({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={4}
      style={({ pressed }) => [st.arrow, { backgroundColor: c.soft, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  bar: { height: 6, borderRadius: 3, marginTop: space.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
