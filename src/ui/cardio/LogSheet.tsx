import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_TYPES,
  KIND_LABEL,
  METERS_PER_MILE,
  SPORT_LABEL,
  defaultPlanDay,
  distText,
  fmt,
  fmtTime,
  newId,
  normalizeTimeInput,
  paceText,
  parseTime,
  planDayOptions,
  plannedOn,
  shortDayLabel,
  type CardioSession,
  type CardioType,
} from '@/logic';

import { Field, Mute } from '../components';
import { Button, Sheet } from '../food/kit';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';

/** Log a cardio session on a day, or edit one. Remount (change `key`) each time it opens. */
export function LogSheet({ visible, day, editing, onClose }: { visible: boolean; day: string; editing: CardioSession | null; onClose: () => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const cardio = state.cardio;
  // Without a session to edit, start from the sport planned today (or a run).
  const [type, setType] = useState<CardioType>(editing?.type ?? plannedOn(cardio.plan, day)[0]?.sport ?? 'run');
  const swim = type === 'swim';
  // Swims are entered in meters; everything is stored in miles.
  const [miles, setMiles] = useState(
    editing?.miles != null ? (editing.type === 'swim' ? String(Math.round(editing.miles * METERS_PER_MILE)) : fmt(editing.miles)) : '',
  );
  const [time, setTime] = useState(editing?.secs ? fmtTime(editing.secs) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  // '' = doesn't count toward a plan run.
  const [planDay, setPlanDay] = useState<string>(editing ? (editing.planDay ?? '') : (defaultPlanDay(cardio, day, type) ?? ''));
  const [err, setErr] = useState<string | null>(null);

  const others = { ...cardio, sessions: cardio.sessions.filter((x) => x.id !== editing?.id) };
  const options = cardio.plan ? planDayOptions(others, day, today, type) : [];
  const hasDistance = CARDIO_TYPES.find((t) => t.id === type)!.distance;
  const entered = parseFloat(miles);
  const mi = swim ? entered / METERS_PER_MILE : entered;
  const secs = parseTime(time);
  const pace = type === 'run' || type === 'walk' || type === 'hike' ? paceText(mi, secs) : '';

  const save = () => {
    const okMiles = Number.isFinite(mi) && mi > 0;
    const okTime = secs != null && secs > 0;
    if (!okMiles && !okTime) return setErr(hasDistance ? 'Enter the distance or the time.' : 'Enter the time.');
    if (miles.trim() && !okMiles) return setErr(swim ? 'Distance should be a number of meters, like 750.' : 'Distance should be a number of miles, like 3.1.');
    if (time.trim() && !okTime) return setErr('Time looks like 45, 45:30 or 1:05:00.');
    const x: CardioSession = { id: editing?.id ?? newId('c'), date: day, type };
    if (okMiles && hasDistance) x.miles = mi;
    if (okTime) x.secs = secs!;
    if (note.trim()) x.note = note.trim();
    if (planDay && options.some((o) => o.s === planDay)) x.planDay = planDay;
    update((s) => {
      const list = s.cardio.sessions.filter((y) => y.id !== x.id);
      // Logging toward a skipped run un-skips it.
      const skips = x.planDay ? s.cardio.skips.filter((d) => d !== x.planDay) : s.cardio.skips;
      return { ...s, cardio: { ...s.cardio, sessions: [...list, x].sort((a, b) => a.date.localeCompare(b.date)), skips } };
    });
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    update((s) => ({ ...s, cardio: { ...s.cardio, sessions: s.cardio.sessions.filter((y) => y.id !== editing.id) } }));
    onClose();
  };

  return (
    <Sheet visible={visible} title={editing ? 'Edit cardio' : 'Log cardio'} onClose={onClose}>
      <Text style={[st.day, { color: c.ink }]}>{shortDayLabel(day)}</Text>

      <Text style={[st.lbl, { color: c.mute, marginTop: space.md, marginBottom: 6 }]}>What did you do?</Text>
      <Select
        label="What did you do?"
        value={type}
        options={CARDIO_TYPES.map((t) => ({ value: t.id, label: t.label }))}
        onChange={(t) => {
          if (t === type) return;
          setType(t);
          if (t === 'swim' || type === 'swim') setMiles('');
          setPlanDay(editing ? '' : (defaultPlanDay(cardio, day, t) ?? ''));
        }}
      />

      <View style={[st.pair, { marginTop: space.lg }]}>
        {hasDistance ? (
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[st.lbl, { color: c.mute }]}>{swim ? 'Meters' : 'Miles'}</Text>
            <Field
              value={miles}
              onChangeText={setMiles}
              keyboardType="decimal-pad"
              placeholder={swim ? 'e.g. 750' : 'e.g. 3.1'}
              accessibilityLabel={swim ? 'Meters' : 'Miles'}
            />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[st.lbl, { color: c.mute }]}>Time (m:ss or h:mm:ss)</Text>
          <Field
            value={time}
            onChangeText={setTime}
            onEndEditing={() => setTime(normalizeTimeInput(time))}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 28:30"
            accessibilityLabel="Time"
          />
        </View>
      </View>
      {pace ? (
        <View style={[st.readout, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.mute, fontSize: 14 }}>Pace</Text>
          <Text style={[st.readoutValue, { color: c.ink }]}>
            {pace.replace(' /mi', '')}
            <Text style={{ fontFamily: fonts.semi, fontSize: 16, color: c.mute }}> /mi</Text>
          </Text>
        </View>
      ) : null}

      {options.length ? (
        <View style={{ marginTop: space.lg, gap: 6 }}>
          <Text style={[st.lbl, { color: c.mute }]}>Counts toward your plan</Text>
          <Select
            label="Counts toward your plan"
            value={planDay}
            options={[
              ...options.map((o) => ({
                value: o.s,
                label: `${o.s === day ? 'Today’s' : shortDayLabel(o.s)} ${o.wk.race ? 'race' : KIND_LABEL[o.wk.kind].toLowerCase()} ${SPORT_LABEL[o.wk.sport].toLowerCase()} · ${distText(o.wk.sport, o.wk.miles)}`,
              })),
              { value: '', label: `Extra ${SPORT_LABEL[type as keyof typeof SPORT_LABEL]?.toLowerCase() ?? 'session'}, not part of the plan` },
            ]}
            onChange={setPlanDay}
          />
          <Mute style={{ fontSize: 13 }}>Pick a missed or upcoming planned workout to make it up, or log this as extra.</Mute>
        </View>
      ) : null}

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg, marginBottom: 6 }]}>Notes</Text>
      <Field value={note} onChangeText={setNote} placeholder="Splits, how it felt" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button label={editing ? 'Save' : 'Log it'} primary onPress={save} style={{ marginTop: space.xl }} />
      {editing ? <Button label="Delete" danger onPress={remove} style={{ marginTop: space.md }} /> : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  day: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  lbl: { fontSize: 13, fontWeight: '600' },
  pair: { flexDirection: 'row', gap: space.md },
  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.md,
    borderRadius: radius.md - 2, paddingVertical: space.sm + 2, paddingHorizontal: space.md,
  },
  readoutValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
});
