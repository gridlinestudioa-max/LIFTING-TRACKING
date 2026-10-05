import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  LIFTS,
  REST_TEXT,
  RUN_TIPS,
  TYPES,
  fmt,
  formFromLog,
  kcalInfo,
  normalizeTimeInput,
  num,
  paceText,
  parseTime,
  planFor,
  shortDayLabel,
  status,
  targetFor,
  type DayForm,
  type LiftGroup,
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

  const p = planFor(state.start, s);
  const dname = shortDayLabel(s);

  if (!p) {
    return (
      <View>
        <Text style={[st.title, { color: c.ink }]}>{dname}</Text>
        <Mute>Outside the 12-week plan. Adjust the plan start on the Progress tab.</Mute>
      </View>
    );
  }

  const T = TYPES[p.type];
  const sub = state.logs[s];
  const draft = drafts[s];
  const f: DayForm = draft ?? formFromLog(state, p, sub);
  const edit = (patch: Partial<DayForm>) => {
    setError(null);
    setDraft(s, { ...f, ...patch });
  };
  const dayStatus = status(state, s, today);

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
          {dname} · Week {p.w + 1}
        </Text>
        <Text style={[st.chip, { backgroundColor: c.types[p.type] }]}>{p.race ? 'Race day' : T.label}</Text>
      </View>
      <StatusBadge st={dayStatus} c={c} />

      {T.kind === 'lift' ? (
        <>
          <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Text style={[st.planHead, { color: c.ink }]}>Scheduled: {T.label} day</Text>
            {LIFTS[p.type as LiftGroup].map((e) => (
              <Text key={e.id} style={{ color: c.ink, fontSize: 13 }}>
                {e.name} {e.sets} @ {fmt(targetFor(state.base, e.id, p.w))} {e.unit}
              </Text>
            ))}
          </View>
          <SkipControl skipped={f.skipped} onToggle={() => edit({ skipped: !f.skipped })} c={c} />
          {!f.skipped && <Label>Log what you lifted</Label>}
          {!f.skipped && LIFTS[p.type as LiftGroup].map((e, i) => {
            const rec = f.lifts[e.id] ?? { w: '', done: false };
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
      ) : T.kind === 'run' ? (
        <>
          <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Text style={[st.planHead, { color: c.ink }]}>
              Scheduled: {p.race ? 'Race, ' : `${T.label} run, `}
              {fmt(p.miles)} mi
            </Text>
            <Text style={{ color: c.ink, fontSize: 13 }}>
              {p.race ? RUN_TIPS.race : RUN_TIPS[p.type as 'long' | 'tempo' | 'easy']}
            </Text>
          </View>
          <SkipControl skipped={f.skipped} onToggle={() => edit({ skipped: !f.skipped })} c={c} />
          {!f.skipped && <Label>Log your run</Label>}
          {!f.skipped && <View style={st.runrow}>
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
          </View>}
        </>
      ) : (
        <View style={[st.plan, { backgroundColor: c.bg, borderColor: c.line }]}>
          <Text style={[st.planHead, { color: c.ink }]}>Scheduled: Rest day</Text>
          <Text style={{ color: c.ink, fontSize: 13 }}>{REST_TEXT}</Text>
        </View>
      )}

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

function StatusBadge({ st: status, c }: { st: string | null; c: Palette }) {
  const m =
    status === 'done' ? { t: '✓ Completed', fg: c.ok, bg: c.okbg }
    : status === 'missed' ? { t: '✕ Missed', fg: c.bad, bg: c.badbg }
    : status === 'partial' ? { t: '◐ Partial', fg: c.warn, bg: c.warnbg }
    : status === 'skipped' ? { t: '– Skipped', fg: c.mute, bg: c.line }
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
  skipbtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18, minHeight: 40, justifyContent: 'center' },
  submit: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
});
