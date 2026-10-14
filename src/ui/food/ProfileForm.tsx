import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACTIVITY,
  DAILY_MOVES,
  GOALS,
  TRACKERS,
  burnAccuracy,
  MONTHS,
  ageOn,
  daysInMonth,
  fmt,
  missingForSuggestions,
  pad,
  profileError,
  todayString,
  type Activity,
  type DailyMove,
  type Tracker,
  type Goal,
  type Profile,
  type Sex,
} from '@/logic';

import { Field, Mute } from '../components';
import { Select } from '../Select';
import { space, useColors } from '../theme';
import { Button } from './kit';

const SEXES: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

/** Body stats. Every field is optional. Units are the app's: pounds, feet and inches. */
export function ProfileForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  initial: Profile | null;
  onSave: (p: Profile | null) => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const c = useColors();
  const today = todayString();
  const [sex, setSex] = useState<Sex | undefined>(initial?.sex);
  const b = initial?.birthday?.split('-').map(Number);
  const [by, setBy] = useState<number | undefined>(b?.[0]);
  const [bm, setBm] = useState<number | undefined>(b?.[1]);
  const [bd, setBd] = useState<number | undefined>(b?.[2]);
  const [ft, setFt] = useState(initial?.heightIn ? String(Math.floor(initial.heightIn / 12)) : '');
  const [inch, setInch] = useState(initial?.heightIn ? fmt(Math.round((initial.heightIn % 12) * 10) / 10) : '');
  const [lb, setLb] = useState(initial?.weightLb ? fmt(initial.weightLb) : '');
  const [activity, setActivity] = useState<Activity | undefined>(initial?.activity);
  const [goal, setGoal] = useState<Goal | undefined>(initial?.goal);
  const [tracker, setTracker] = useState<Tracker | undefined>(initial?.tracker);
  const [daily, setDaily] = useState<DailyMove | undefined>(initial?.daily);
  const [steps, setSteps] = useState(initial?.steps ? String(initial.steps) : '');
  const [bf, setBf] = useState(initial?.bodyFat ? fmt(initial.bodyFat) : '');
  const [err, setErr] = useState<string | null>(null);

  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 101 }, (_, i) => thisYear - i).map((y) => ({ value: y, label: String(y) }));
  const maxDay = bm ? daysInMonth(by ?? 2000, bm - 1) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const birthday = by && bm && bd ? `${by}-${pad(bm)}-${pad(Math.min(bd, maxDay))}` : undefined;
  const partialBirthday = !birthday && (by || bm || bd);

  const blank = (v: string) => v.trim() === '';
  const draft: Profile = {};
  if (sex) draft.sex = sex;
  if (birthday) draft.birthday = birthday;
  else if (!partialBirthday && initial?.age != null && !initial.birthday) draft.age = initial.age;
  if (!blank(ft) || !blank(inch)) draft.heightIn = (blank(ft) ? 0 : Number(ft)) * 12 + (blank(inch) ? 0 : Number(inch));
  if (!blank(lb)) draft.weightLb = Number(lb);
  if (activity) draft.activity = activity;
  if (goal) draft.goal = goal;
  if (tracker) draft.tracker = tracker;
  if (tracker === 'none') {
    if (daily) draft.daily = daily;
    if (!blank(steps)) draft.steps = Number(steps.replace(/,/g, ''));
    if (!blank(bf)) draft.bodyFat = Number(bf);
  }
  const acc = burnAccuracy(draft);
  const missing = missingForSuggestions(draft, today);

  return (
    <View>
      <Text style={[st.lbl, { color: c.mute }]}>Sex</Text>
      <Select label="Sex" value={sex} options={SEXES} onChange={setSex} placeholder="Not set" />

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Birthday</Text>
      <View style={st.line}>
        <Select
          label="Birth month"
          value={bm}
          options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          onChange={setBm}
          placeholder="Month"
          style={{ flex: 1.6 }}
        />
        <Select label="Birth day" value={bd} options={days} onChange={setBd} placeholder="Day" style={{ flex: 1 }} />
        <Select label="Birth year" value={by} options={years} onChange={setBy} placeholder="Year" style={{ flex: 1.2 }} />
      </View>
      {birthday ? <Mute style={{ marginTop: space.xs }}>{`${ageOn(birthday, today)} years old`}</Mute> : null}

      <View style={[st.line, { marginTop: space.lg }]}>
        <Num label="Height" unit="ft" value={ft} onChange={setFt} />
        <Num label=" " unit="in" value={inch} onChange={setInch} a11y="Height, inches" />
      </View>
      <View style={[st.line, { marginTop: space.md }]}>
        <Num label="Weight" unit="lb" value={lb} onChange={setLb} />
        <View style={{ flex: 1 }} />
      </View>

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>How active are you?</Text>
      <Select
        label="How active are you?"
        value={activity}
        options={ACTIVITY.map((a) => ({ value: a.id, label: a.label, hint: a.blurb }))}
        onChange={setActivity}
        placeholder="Not set"
      />

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Goal</Text>
      <Select label="Goal" value={goal} options={GOALS.map((g) => ({ value: g.id, label: g.label, hint: g.blurb }))} onChange={setGoal} placeholder="Not set" />

      <Text style={[st.head, { color: c.ink }]}>Calories burned</Text>
      <Text style={[st.lbl, { color: c.mute }]}>What tracks your calories burned?</Text>
      <Select label="What tracks your calories burned?" value={tracker} options={TRACKERS.map((t) => ({ value: t.id, label: t.label }))} onChange={setTracker} placeholder="Not set" />
      {tracker === 'none' ? (
        <>
          <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Outside of workouts, you’re…</Text>
          <Select
            label="Outside of workouts"
            value={daily}
            options={DAILY_MOVES.map((d) => ({ value: d.id, label: d.label, hint: d.hint }))}
            onChange={setDaily}
            placeholder="Choose one"
          />
          <View style={[st.line, { marginTop: space.md }]}>
            <Num label="Steps a day (avg)" unit="" value={steps} onChange={setSteps} a11y="Average steps a day" />
            <Num label="Body fat" unit="%" value={bf} onChange={setBf} a11y="Body fat percent" />
          </View>
          <Mute style={{ marginTop: space.sm, fontSize: 13 }}>
            {acc.level === 'best' ? 'Estimate accuracy: best.' : `Estimate accuracy: ${acc.level}. Add ${acc.add.join(' and ')} to improve it.`}
          </Mute>
        </>
      ) : null}

      {missing ? <Mute style={{ marginTop: space.lg, fontSize: 13 }}>{`Add ${missing} for suggested daily targets.`}</Mute> : null}

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label={saveLabel}
        primary
        style={{ marginTop: space.lg }}
        onPress={() => {
          if (partialBirthday) return setErr('Choose the month, day and year of your birthday, or none of them.');
          if (tracker === 'none' && ((!blank(steps) && !Number.isFinite(Number(steps.replace(/,/g, '')))) || (!blank(bf) && !Number.isFinite(Number(bf)))))
            return setErr('Steps and body fat should be numbers.');
          if ((!blank(ft) && !Number.isFinite(Number(ft))) || (!blank(inch) && !Number.isFinite(Number(inch))) || (!blank(lb) && !Number.isFinite(Number(lb))))
            return setErr('Height and weight should be numbers.');
          const e = profileError(draft, today);
          if (e) return setErr(e);
          setErr(null);
          onSave(Object.keys(draft).length ? draft : null);
        }}
      />
      {onCancel ? <Button label="Cancel" onPress={onCancel} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

function Num({ label, unit, value, onChange, a11y }: { label: string; unit: string; value: string; onChange: (v: string) => void; a11y?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={[st.lbl, { color: c.mute, marginBottom: 0 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Field
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          accessibilityLabel={a11y ?? `${label}, ${unit}`}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Text style={{ color: c.mute, fontSize: 14, width: 24 }}>{unit}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  head: { fontSize: 16, fontWeight: '700', marginTop: space.xl, marginBottom: space.sm },
  line: { flexDirection: 'row', gap: space.sm },
});
