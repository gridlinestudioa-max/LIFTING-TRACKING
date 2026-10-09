import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LIFTS,
  REST_TEXT,
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

import { Field, Label, Mute } from './components';
import { useTracker } from './store';
import { toneColor, useColors, type Palette } from './theme';

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
  const showLog = isRest ? !!p.swapped : p.swapped || !f.skipped;

  let msg = '', msgColor = c.mute, msgBold = false;
  if (error) { msg = error; msgColor = c.bad; msgBold = true; }
  else if (draft) { msg = 'Not submitted yet'; msgColor = c.warn; }
  else if (flash === s) { msg = 'Submitted ✓'; msgColor = c.ok; msgBold = true; }
  else if (sub) { msg = 'Submitted'; }

  const k = kcalInfo(num(f.cin), num(f.cout), state.goal);

  return (
    <View>
      <View style={st.dtitle}>
        <Text style={[st.title, { color: c.ink, flexShrink: 1 }]}>
          {dname} · Week {base.w + 1}
        </Text>
        <Text style={[st.chip, { backgroundColor: c.types[p.type] }]}>{p.race ? 'Race day' : T.label}</Text>
      </View>
      <StatusBadge st={dayStatus} movedTo={movedTo} c={c} />

      <PlanBox plan={base} head="Scheduled" c={c} />

      {!isRest && !p.swapped ? (
        <SkipControl skipped={f.skipped} onToggle={() => edit({ skipped: !f.skipped })} c={c} />
      ) : null}

      {isRest || !f.skipped ? (
        <WorkoutSwap
          f={f}
          scheduled={base.type}
          open={openFor === s || !!p.swapped}
          onOpen={() => setOpenFor(s)}
          candidates={isRest ? makeupCandidates(state, s) : []}
          edit={(patch) => {
            if (!patch.swap && !patch.makeupFor) setOpenFor(null);
            edit({ ...patch, skipped: false });
          }}
          c={c}
        />
      ) : null}

      {p.swapped ? (
        <PlanBox plan={p} head={p.makeupFor ? `Making up ${shortDayLabel(p.makeupFor)}` : 'Doing instead'} c={c} />
      ) : null}

      {showLog && T.kind === 'lift' ? (
        <>
          <Label>Log what you lifted</Label>
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
                  <Text style={{ fontWeight: '600', color: c.ink, fontSize: 15 }}>{e.name}</Text>
                  <Text style={{ fontSize: 12, color: c.mute }}>
                    {e.sets} · target {fmt(targetFor(state.base, e.id, p.w))} {e.unit}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Field
                    value={rec.w}
                    onChangeText={(w) => edit({ lifts: { ...f.lifts, [e.id]: { ...rec, w } } })}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${e.name} weight used`}
                    style={{ width: 76, textAlign: 'right' }}
                  />
                  <Text style={{ fontSize: 13, color: c.mute, width: 18 }}>{e.unit}</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {showLog && T.kind === 'run' ? (
        <>
          <Label>Log your run</Label>
          <View style={st.runrow}>
            <LabeledField label="Miles" c={c}>
              <Field
                value={f.miles}
                onChangeText={(miles) => edit({ miles })}
                keyboardType="decimal-pad"
                placeholder={fmt(p.miles)}
                accessibilityLabel="Miles"
                style={{ width: 80, textAlign: 'right' }}
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
                style={{ width: 120 }}
              />
            </LabeledField>
            <Text style={[st.pace, { color: c.ink }]}>{paceText(parseFloat(f.miles), parseTime(f.time))}</Text>
          </View>
        </>
      ) : null}

      <Label>Calories</Label>
      <View style={st.runrow}>
        <LabeledField label="In (eaten)" c={c}>
          <Field
            value={f.cin}
            onChangeText={(cin) => edit({ cin })}
            keyboardType="number-pad"
            placeholder="0"
            accessibilityLabel="Calories in"
            style={{ width: 96, textAlign: 'right' }}
          />
        </LabeledField>
        <LabeledField label="Out (total burned)" c={c}>
          <Field
            value={f.cout}
            onChangeText={(cout) => edit({ cout })}
            keyboardType="number-pad"
            placeholder="0"
            accessibilityLabel="Calories out"
            style={{ width: 96, textAlign: 'right' }}
          />
        </LabeledField>
      </View>
      <Text style={{ color: toneColor(c, k.tone), fontSize: 15, fontWeight: k.tone === 'mute' ? '400' : '700', marginTop: 6 }}>
        {k.text}
      </Text>

      <Field
        value={f.note}
        onChangeText={(note) => edit({ note })}
        placeholder="Notes (how it felt, splits, etc.)"
        multiline
        style={{ marginTop: 10, minHeight: 60, textAlignVertical: 'top' }}
      />

      <View style={st.submitrow}>
        <Pressable
          onPress={() => setError(submit(s, f))}
          accessibilityRole="button"
          style={({ pressed }) => [st.submit, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={{ color: c.bg, fontWeight: '700', fontSize: 15 }}>{sub ? 'Update' : 'Submit'}</Text>
        </Pressable>
        <Text style={{ color: msgColor, fontWeight: msgBold ? '700' : '400', fontSize: 13, flexShrink: 1 }}>{msg}</Text>
      </View>
    </View>
  );
}

/** The workout for a plan: lift list with target weights, run miles and tip, or rest. */
function PlanBox({ plan, head, c }: { plan: PlanDay; head: string; c: Palette }) {
  const { state } = useTracker();
  const T = TYPES[plan.type];
  let title: string;
  let lines: string[];
  if (T.kind === 'lift') {
    title = `${head}: ${T.label} day`;
    lines = LIFTS[plan.type as LiftGroup].map(
      (e) => `${e.name} ${e.sets} @ ${fmt(targetFor(state.base, e.id, plan.w))} ${e.unit}`,
    );
  } else if (T.kind === 'run') {
    title = `${head}: ${plan.race ? 'Race, ' : `${T.label} run, `}${fmt(plan.miles)} mi`;
    lines = [plan.race ? RUN_TIPS.race : RUN_TIPS[plan.type as 'long' | 'tempo' | 'easy']];
  } else {
    title = `${head}: Rest day`;
    lines = [REST_TEXT];
  }
  return (
    <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
      <Text style={[st.planHead, { color: c.ink }]}>{title}</Text>
      {lines.map((t) => (
        <Text key={t} style={{ color: c.ink, fontSize: 13 }}>
          {t}
        </Text>
      ))}
    </View>
  );
}

const SWAP_TYPES: DayType[] = ['push', 'pull', 'legs', 'tempo', 'easy', 'long'];

/**
 * Do a different workout than scheduled. On a rest day this can also make up a
 * skipped workout from the surrounding weeks.
 */
function WorkoutSwap({
  f,
  scheduled,
  open,
  onOpen,
  candidates,
  edit,
  c,
}: {
  f: DayForm;
  scheduled: DayType;
  open: boolean;
  onOpen: () => void;
  candidates: { s: string; plan: PlanDay }[];
  edit: (patch: Partial<DayForm>) => void;
  c: Palette;
}) {
  const isRest = scheduled === 'rest';
  if (!open) {
    return (
      <View style={st.skiprow}>
        <OptionButton label={isRest ? 'Do a workout instead' : 'Did something else'} selected={false} onPress={onOpen} c={c} />
      </View>
    );
  }
  const asScheduled = !f.makeupFor && (!f.swap || f.swap === scheduled);
  return (
    <View style={{ gap: 6, marginBottom: 2 }}>
      {candidates.length ? (
        <>
          <Text style={[st.optHead, { color: c.mute }]}>Move a skipped workout here</Text>
          <View style={st.optrow}>
            {candidates.map((m) => (
              <OptionButton
                key={m.s}
                label={`${shortDayLabel(m.s)} · ${TYPES[m.plan.type].label}${m.plan.miles ? ` ${fmt(m.plan.miles)} mi` : ''}`}
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
        {isRest ? `${candidates.length ? 'Or do' : 'Do'} a workout instead` : 'What did you do instead?'}
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
          label={isRest ? 'Rest' : `${TYPES[scheduled].label} as planned`}
          selected={asScheduled}
          onPress={() => edit({ swap: '', makeupFor: '' })}
          c={c}
        />
      </View>
    </View>
  );
}

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
  const fill = color ?? c.mute;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        st.opt,
        { borderColor: selected ? fill : c.line, backgroundColor: selected ? fill : c.bg, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: selected ? '#fff' : c.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ st: status, movedTo, c }: { st: string | null; movedTo: string | null; c: Palette }) {
  const m =
    status === 'done' ? { t: '✓ Completed', fg: c.ok, bg: c.okbg }
    : status === 'missed' ? { t: '✕ Missed', fg: c.bad, bg: c.badbg }
    : status === 'partial' ? { t: '◐ Partial', fg: c.warn, bg: c.warnbg }
    : status === 'skipped' ? { t: '– Skipped', fg: c.mute, bg: c.line }
    : status === 'moved' ? { t: `↪ Moved to ${movedTo ? shortDayLabel(movedTo) : 'a rest day'}`, fg: c.mute, bg: c.line }
    : null;
  if (!m) return null;
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <Text style={[st.badge, { color: m.fg, backgroundColor: m.bg }]}>{m.t}</Text>
    </View>
  );
}

/** "Skip this workout" toggle. When on, the workout fields hide; calories and notes stay. */
function SkipControl({ skipped, onToggle, c }: { skipped: boolean; onToggle: () => void; c: Palette }) {
  return (
    <View style={st.skiprow}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: skipped }}
        hitSlop={6}
        style={({ pressed }) => [
          st.skipbtn,
          { borderColor: skipped ? c.mute : c.line, backgroundColor: skipped ? c.line : c.bg, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 14 }}>{skipped ? 'Undo skip' : 'Skip'}</Text>
      </Pressable>
      {skipped ? (
        <Text style={{ color: c.mute, fontSize: 13, flexShrink: 1 }}>Workout skipped. You can still log calories.</Text>
      ) : null}
    </View>
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
      {checked ? <Text style={{ color: c.bg, fontWeight: '800', fontSize: 15, lineHeight: 17 }}>✓</Text> : null}
    </Pressable>
  );
}

function LabeledField({ label, c, children }: { label: string; c: Palette; children: React.ReactNode }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontSize: 12, color: c.mute }}>{label}</Text>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  dtitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  chip: { fontSize: 11, fontWeight: '700', color: '#fff', borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  badge: { fontSize: 12, fontWeight: '700', borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  plan: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6, marginBottom: 8, gap: 2 },
  planHead: { fontSize: 14, fontWeight: '700' },
  ex: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  runrow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, marginTop: 6 },
  pace: { fontSize: 16, fontWeight: '700', paddingBottom: 9, minWidth: 80 },
  submitrow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  skiprow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  optHead: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  optrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  skipbtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  submit: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
});
