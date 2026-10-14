import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACTIVITY,
  GOALS,
  MONTHS,
  ageOn,
  daysInMonth,
  fmt,
  missingForSuggestions,
  pad,
  profileError,
  todayString,
  type Activity,
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
  const missing = missingForSuggestions(draft, today);

  return (
    <View>
      <Mute style={{ marginBottom: space.md }}>Everything here is optional. Fill in what you like.</Mute>

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
      {activity ? <Mute style={{ marginTop: space.xs }}>{ACTIVITY.find((a) => a.id === activity)!.blurb}</Mute> : null}

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Goal</Text>
      <Select label="Goal" value={goal} options={GOALS.map((g) => ({ value: g.id, label: g.label, hint: g.blurb }))} onChange={setGoal} placeholder="Not set" />
      {goal ? <Mute style={{ marginTop: space.xs }}>{GOALS.find((g) => g.id === goal)!.blurb}</Mute> : null}

      <Mute style={{ marginTop: space.lg, fontSize: 13 }}>
        {missing
          ? `For suggested daily calories, protein, carbs, sugar and fat, add ${missing}.`
          : 'Suggested daily calories, protein, carbs, sugar and fat come from these stats.'}
      </Mute>

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label={saveLabel}
        primary
        style={{ marginTop: space.lg }}
        onPress={() => {
          if (partialBirthday) return setErr('Choose the month, day and year of your birthday, or none of them.');
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
  line: { flexDirection: 'row', gap: space.sm },
});
