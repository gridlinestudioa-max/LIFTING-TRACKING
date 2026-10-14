import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LIFTS,
  REST_TEXT,
  fmtInt,
  foodKcal,
  RUN_TIPS,
  TYPES,
  fmt,
  formFromLog,
  formPlan,
  kcalInfo,
  madeUpBy,
  makeupCandidates,
  normalizeTimeInput,
  num,
  paceText,
  parseTime,
  planFor,
  shortDayLabel,
  status,
  targetFor,
  type DayForm,
  type DayType,
  type LiftGroup,
  type PlanDay,
} from '@/logic';

import { Field, Mute } from './components';
import { StatusMark } from './marks';
import { useTracker } from './store';
import { fonts, radius, space, tabular, toneBg, toneColor, useColors, type Palette } from './theme';

export function DayDetail() {
  const c = useColors();
  const { state, today, selected: s, drafts, setDraft, flash, submit } = useTracker();
  // Validation message, tied to the day it was shown for.
  const [err, setErr] = useState<{ s: string; msg: string } | null>(null);
  const error = err && err.s === s ? err.msg : null;
  const setError = (msg: string | null) => setErr(msg ? { s, msg } : null);
  // "Do a different workout" chooser, opened per day.
  const [openFor, setOpenFor] = useState<string | null>(null);

  const base = planFor(state.start, s);
  const dname = shortDayLabel(s);

  if (!base) {
    return (
      <View>
        <Text style={[st.title, { color: c.ink }]}>{dname}</Text>
        <Mute>Outside the 12-week plan. Adjust the plan start on the Progress tab.</Mute>
      </View>
    );
  }

  const sub = state.logs[s];
  const draft = drafts[s];
  const f: DayForm = draft ?? formFromLog(state, base, sub);
  // The plan being logged: a rest day may have a workout swapped in.
  const p = formPlan(state, base, f);
  const T = TYPES[p.type];
  const isRest = base.type === 'rest';
  const edit = (patch: Partial<DayForm>) => {
    setError(null);
    setDraft(s, { ...f, ...patch });
  };
  const dayStatus = status(state, s, today);
  const movedTo = dayStatus === 'moved' ? madeUpBy(state, s) : null;
  // Nothing scheduled to log here: a rest day, or a workout moved to another day.
  const free = isRest || !!movedTo;
  const showLog = free ? !!p.swapped : p.swapped || !f.skipped;

  let msg = '', msgColor = c.mute, msgBold = false;
  if (error) { msg = error; msgColor = c.bad; msgBold = true; }
  else if (draft) { msg = 'Not submitted yet'; msgColor = c.warn; }
  else if (flash === s) { msg = 'Submitted ✓'; msgColor = c.ok; msgBold = true; }
  else if (sub) { msg = 'Submitted'; }

  // Food logged on the Food tab is the day's calories in; the typed number is only used without it.
  const fromFood = foodKcal(state, s);
  const k = kcalInfo(fromFood ?? num(f.cin), num(f.cout), state.goal);
  const pace = paceText(parseFloat(f.miles), parseTime(f.time));

  return (
    <View>
      <View style={st.dtitle}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[st.title, { color: c.ink }]}>{dname}</Text>
          <Text style={{ color: c.mute, fontSize: 14 }}>Week {base.w + 1}</Text>
        </View>
        <Text style={[st.chip, { backgroundColor: c.types[p.type], color: c.onType }]}>{p.race ? 'Race day' : T.label}</Text>
      </View>
      <StatusBadge st={dayStatus} movedTo={movedTo} c={c} />

      <PlanBox plan={base} head="Scheduled" c={c} />

      {(!free && !p.swapped) || free || !f.skipped ? (
        <View style={st.actions}>
          {!free && !p.swapped ? (
            <SkipControl skipped={f.skipped} onToggle={() => edit({ skipped: !f.skipped })} c={c} />
          ) : null}
          {free || !f.skipped ? (
            <WorkoutSwap
              f={f}
              scheduled={base.type}
              free={free}
              open={openFor === s || !!p.swapped}
              onOpen={() => setOpenFor(s)}
              candidates={makeupCandidates(state, s)}
              edit={(patch) => {
                if (!patch.swap && !patch.makeupFor) setOpenFor(null);
                edit({ ...patch, skipped: false });
              }}
              c={c}
            />
          ) : null}
        </View>
      ) : null}

      {p.swapped ? (
        <PlanBox plan={p} head={p.makeupFor ? `Moved from ${shortDayLabel(p.makeupFor)}` : 'Doing instead'} c={c} />
      ) : null}

      {showLog && T.kind === 'lift' ? (
        <Block title="Log what you lifted" c={c}>
          {LIFTS[p.type as LiftGroup].map((e, i) => {
            const rec = f.lifts[e.id] ?? { w: String(targetFor(state.base, e.id, p.w)), done: false };
            return (
              <View key={e.id} style={[st.ex, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Checkbox
                  checked={rec.done}
                  c={c}
                  label={`${e.name} done`}
                  onToggle={() => edit({ lifts: { ...f.lifts, [e.id]: { ...rec, done: !rec.done } } })}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: c.ink, fontSize: 16 }}>{e.name}</Text>
                  <Text style={{ fontSize: 13, color: c.mute, ...tabular }}>
                    {e.sets}, target {fmt(targetFor(state.base, e.id, p.w))} {e.unit}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Field
                    value={rec.w}
                    onChangeText={(w) => edit({ lifts: { ...f.lifts, [e.id]: { ...rec, w } } })}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${e.name} weight used`}
                    style={{ width: 68, textAlign: 'center', fontWeight: '700', paddingHorizontal: 4 }}
                  />
                  <Text style={{ fontSize: 13, color: c.mute, width: 18 }}>{e.unit}</Text>
                </View>
              </View>
            );
          })}
        </Block>
      ) : null}

      {showLog && T.kind === 'run' ? (
        <Block title="Log your run" c={c}>
          <View style={st.pair}>
            <LabeledField label="Miles" c={c}>
              <Field
                value={f.miles}
                onChangeText={(miles) => edit({ miles })}
                keyboardType="decimal-pad"
                placeholder={fmt(p.miles)}
                accessibilityLabel="Miles"
              />
            </LabeledField>
            <LabeledField label="Time (m:ss or h:mm:ss)" c={c}>
              <Field
                value={f.time}
                onChangeText={(time) => edit({ time })}
                onEndEditing={() => {
                  const t = normalizeTimeInput(f.time);
                  if (t !== f.time) edit({ time: t });
                }}
                keyboardType="numbers-and-punctuation"
                placeholder="e.g. 58:30"
                accessibilityLabel="Time"
              />
            </LabeledField>
          </View>
          <View style={[st.readout, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.mute, fontSize: 14 }}>Pace</Text>
            <Text style={[st.readoutValue, { color: pace ? c.ink : c.mute }]}>
              {pace ? pace.replace(' /mi', '') : '–'}
              {pace ? <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}> /mi</Text> : null}
            </Text>
          </View>
        </Block>
      ) : null}

      <Block title="Calories" c={c}>
        <View style={st.pair}>
          <LabeledField label={fromFood != null ? 'In (from Food tab)' : 'In (eaten)'} c={c}>
            {fromFood != null ? (
              <View style={[st.fromFood, { backgroundColor: c.soft, borderColor: c.line }]} accessibilityLabel={`Calories in from food log: ${fromFood}`}>
                <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700', ...tabular }}>{fmtInt(fromFood)}</Text>
              </View>
            ) : (
              <Field
                value={f.cin}
                onChangeText={(cin) => edit({ cin })}
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel="Calories in"
              />
            )}
          </LabeledField>
          <LabeledField label="Out (total burned)" c={c}>
            <Field
              value={f.cout}
              onChangeText={(cout) => edit({ cout })}
              keyboardType="number-pad"
              placeholder="0"
              accessibilityLabel="Calories out"
            />
          </LabeledField>
        </View>
        <View style={[st.result, { backgroundColor: toneBg(c, k.tone) }]} accessibilityLiveRegion="polite">
          <Text
            style={
              k.tone === 'mute'
                ? { color: c.mute, fontSize: 14 }
                : { color: toneColor(c, k.tone), fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 }
            }>
            {k.text}
          </Text>
        </View>
      </Block>

      <Block title="Notes" c={c}>
        <Field
          value={f.note}
          onChangeText={(note) => edit({ note })}
          placeholder="How it felt, splits, anything to remember"
          multiline
          style={{ minHeight: 76, textAlignVertical: 'top', fontSize: 16 }}
        />
      </Block>

      <Pressable
        onPress={() => setError(submit(s, f))}
        accessibilityRole="button"
        style={({ pressed }) => [st.submit, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 17 }}>{sub ? 'Update' : 'Submit'}</Text>
      </Pressable>
      {msg ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: msgColor, fontWeight: msgBold ? '700' : '400', fontSize: 14, textAlign: 'center', marginTop: space.sm }}>
          {msg}
        </Text>
      ) : null}
    </View>
  );
}

/** A titled group inside the day detail, set off by a hairline. */
function Block({ title, c, children }: { title: string; c: Palette; children: React.ReactNode }) {
  return (
    <View style={[st.block, { borderTopColor: c.line }]}>
      <Text style={[st.blockTitle, { color: c.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

/** The workout for a plan: lift list with target weights, run miles and tip, or rest. */
function PlanBox({ plan, head, c }: { plan: PlanDay; head: string; c: Palette }) {
  const { state } = useTracker();
  const T = TYPES[plan.type];
  return (
    <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
      <View style={[st.rail, { backgroundColor: c.types[plan.type] }]} />
      <View style={st.planBody}>
        <Text style={{ color: c.mute, fontSize: 13 }}>{head}</Text>
        {T.kind === 'lift' ? (
          <>
            <Text style={[st.planTitle, { color: c.ink }]}>{T.label} day</Text>
            {LIFTS[plan.type as LiftGroup].map((e) => (
              <View key={e.id} style={st.planRow}>
                <Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>
                  {e.name} <Text style={{ color: c.mute }}>{e.sets}</Text>
                </Text>
                <Text style={{ color: c.ink, fontSize: 14, fontWeight: '700', ...tabular }}>
                  {fmt(targetFor(state.base, e.id, plan.w))} {e.unit}
                </Text>
              </View>
            ))}
          </>
        ) : T.kind === 'run' ? (
          <>
            <View style={st.planRow}>
              <Text style={[st.planTitle, { color: c.ink, flex: 1 }]}>{plan.race ? 'Race day' : `${T.label} run`}</Text>
              <Text style={[st.planMiles, { color: c.ink }]}>
                {fmt(plan.miles)}
                <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}> mi</Text>
              </Text>
            </View>
            <Text style={{ color: c.ink, fontSize: 14 }}>{plan.race ? RUN_TIPS.race : RUN_TIPS[plan.type as 'long' | 'tempo' | 'easy']}</Text>
          </>
        ) : (
          <>
            <Text style={[st.planTitle, { color: c.ink }]}>Rest day</Text>
            <Text style={{ color: c.ink, fontSize: 14 }}>{REST_TEXT}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const SWAP_TYPES: DayType[] = ['push', 'pull', 'legs', 'tempo', 'easy', 'long'];

/**
 * Do a different workout than scheduled: another day's workout moved here (same
 * week, or a recent skip), or any workout type.
 */
function WorkoutSwap({
  f,
  scheduled,
  free,
  open,
  onOpen,
  candidates,
  edit,
  c,
}: {
  f: DayForm;
  scheduled: DayType;
  /** Nothing to do here as scheduled (rest day, or this day's workout moved away). */
  free: boolean;
  open: boolean;
  onOpen: () => void;
  candidates: { s: string; plan: PlanDay }[];
  edit: (patch: Partial<DayForm>) => void;
  c: Palette;
}) {
  if (!open) {
    return <OptionButton label={free ? 'Do a workout instead' : 'Did something else'} selected={false} onPress={onOpen} c={c} />;
  }
  const asScheduled = !f.makeupFor && (!f.swap || f.swap === scheduled);
  return (
    <View style={{ gap: space.sm, width: '100%' }}>
      {candidates.length ? (
        <>
          <Text style={[st.optHead, { color: c.mute }]}>{"Move another day's workout here"}</Text>
          <View style={st.optrow}>
            {candidates.map((m) => (
              <OptionButton
                key={m.s}
                label={`${shortDayLabel(m.s)}, ${TYPES[m.plan.type].label}${m.plan.miles ? ` ${fmt(m.plan.miles)} mi` : ''}`}
                selected={f.makeupFor === m.s}
                color={c.types[m.plan.type]}
                onPress={() => edit({ makeupFor: m.s, swap: m.plan.type })}
                c={c}
              />
            ))}
          </View>
        </>
      ) : null}
      <Text style={[st.optHead, { color: c.mute }]}>
        {free
          ? `${candidates.length ? 'Or do' : 'Do'} a workout instead`
          : candidates.length ? 'Or something else' : 'What did you do instead?'}
      </Text>
      <View style={st.optrow}>
        {SWAP_TYPES.filter((t) => t !== scheduled).map((t) => (
          <OptionButton
            key={t}
            label={TYPES[t].label}
            selected={!f.makeupFor && f.swap === t}
            color={c.types[t]}
            onPress={() => edit({ swap: t, makeupFor: '' })}
            c={c}
          />
        ))}
        <OptionButton
          label={scheduled === 'rest' ? 'Rest' : free ? 'Nothing' : `${TYPES[scheduled].label} as planned`}
          selected={asScheduled}
          onPress={() => edit({ swap: '', makeupFor: '' })}
          c={c}
        />
      </View>
    </View>
  );
}

/** A pill choice. Workout types fill with their own color; everything else fills with ink. */
function OptionButton({
  label,
  selected,
  onPress,
  color,
  c,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  c: Palette;
}) {
  const fill = color ?? c.accent;
  const onFill = color ? c.onType : c.onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        st.opt,
        { borderColor: selected ? fill : c.line, backgroundColor: selected ? fill : c.card, opacity: pressed ? 0.7 : 1 },
      ]}>
      {color && !selected ? <View style={[st.optDot, { backgroundColor: color }]} /> : null}
      <Text style={{ color: selected ? onFill : c.ink, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ st: status, movedTo, c }: { st: string | null; movedTo: string | null; c: Palette }) {
  const m =
    status === 'done' ? { t: 'Completed', fg: c.ok, bg: c.okbg, mark: 'done' as const }
    : status === 'missed' ? { t: 'Missed', fg: c.bad, bg: c.badbg, mark: 'missed' as const }
    : status === 'partial' ? { t: 'Partial', fg: c.warn, bg: c.warnbg, mark: 'partial' as const }
    : status === 'skipped' ? { t: 'Skipped', fg: c.mute, bg: c.soft, mark: null }
    : status === 'moved' ? { t: `Moved to ${movedTo ? shortDayLabel(movedTo) : 'another day'}`, fg: c.mute, bg: c.soft, mark: null }
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

/** "Skip this workout" toggle. When on, the workout fields hide; calories and notes stay. */
function SkipControl({ skipped, onToggle, c }: { skipped: boolean; onToggle: () => void; c: Palette }) {
  return (
    <>
      <OptionButton label={skipped ? 'Undo skip' : 'Skip'} selected={skipped} onPress={onToggle} c={c} />
      {skipped ? (
        <Text style={{ color: c.mute, fontSize: 14, flexShrink: 1 }}>Workout skipped. You can still log calories.</Text>
      ) : null}
    </>
  );
}

function Checkbox({ checked, onToggle, c, label }: { checked: boolean; onToggle: () => void; c: Palette; label: string }) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[st.check, { borderColor: checked ? c.accent : c.mute, backgroundColor: checked ? c.accent : 'transparent' }]}>
      {checked ? <StatusMark kind="done" color={c.onAccent} size={18} /> : null}
    </Pressable>
  );
}

function LabeledField({ label, c, children }: { label: string; c: Palette; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.mute }}>{label}</Text>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  dtitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  chip: {
    fontSize: 13, fontWeight: '700', borderRadius: radius.pill, overflow: 'hidden',
    paddingHorizontal: space.md, paddingVertical: 5, marginTop: 4,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  plan: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space.md },
  rail: { width: 5 },
  planBody: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, gap: 3 },
  planTitle: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  planRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  planMiles: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  block: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1 },
  blockTitle: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26, marginBottom: space.sm },
  ex: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md - 2 },
  check: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.md },
  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.md,
    borderRadius: radius.md - 2, paddingVertical: space.sm + 2, paddingHorizontal: space.md,
  },
  readoutValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
  fromFood: { minHeight: 46, borderWidth: 1.5, borderRadius: radius.md - 2, paddingHorizontal: space.md, justifyContent: 'center' },
  result: { marginTop: space.md, borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md },
  submit: {
    marginTop: space.xl, minHeight: 54, borderRadius: radius.md + 2,
    alignItems: 'center', justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md },
  optHead: { fontSize: 13, fontWeight: '600', marginTop: space.xs },
  optrow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, borderRadius: radius.pill,
    paddingVertical: 8, paddingHorizontal: space.lg, minHeight: 42,
  },
  optDot: { width: 8, height: 8, borderRadius: 4 },
});
