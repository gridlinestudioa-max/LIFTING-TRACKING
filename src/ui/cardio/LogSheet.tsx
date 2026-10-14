import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_TYPES,
  RUN_LABEL,
  defaultPlanDay,
  fmt,
  fmtTime,
  newId,
  normalizeTimeInput,
  paceText,
  parseTime,
  planDayOptions,
  shortDayLabel,
  type CardioSession,
  type CardioType,
} from '@/logic';

import { Field, Mute } from '../components';
import { Button, Pill, Sheet } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';

/** Log a cardio session on a day, or edit one. Remount (change `key`) each time it opens. */
export function LogSheet({ visible, day, editing, onClose }: { visible: boolean; day: string; editing: CardioSession | null; onClose: () => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const cardio = state.cardio;
  const [type, setType] = useState<CardioType>(editing?.type ?? 'run');
  const [miles, setMiles] = useState(editing?.miles != null ? fmt(editing.miles) : '');
  const [time, setTime] = useState(editing?.secs ? fmtTime(editing.secs) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  // '' = doesn't count toward a plan run.
  const [planDay, setPlanDay] = useState<string>(editing ? (editing.planDay ?? '') : (defaultPlanDay(cardio, day, 'run') ?? ''));
  const [err, setErr] = useState<string | null>(null);

  const others = { ...cardio, sessions: cardio.sessions.filter((x) => x.id !== editing?.id) };
  const options = type === 'run' && cardio.plan ? planDayOptions(others, day, today) : [];
  const hasDistance = CARDIO_TYPES.find((t) => t.id === type)!.distance;
  const mi = parseFloat(miles);
  const secs = parseTime(time);
  const pace = type === 'run' || type === 'walk' || type === 'hike' ? paceText(mi, secs) : '';

  const save = () => {
    const okMiles = Number.isFinite(mi) && mi > 0;
    const okTime = secs != null && secs > 0;
    if (!okMiles && !okTime) return setErr(hasDistance ? 'Enter the distance or the time.' : 'Enter the time.');
    if (miles.trim() && !okMiles) return setErr('Distance should be a number of miles, like 3.1.');
    if (time.trim() && !okTime) return setErr('Time looks like 45, 45:30 or 1:05:00.');
    const x: CardioSession = { id: editing?.id ?? newId('c'), date: day, type };
    if (okMiles && hasDistance) x.miles = mi;
    if (okTime) x.secs = secs!;
    if (note.trim()) x.note = note.trim();
    if (type === 'run' && planDay && options.some((o) => o.s === planDay)) x.planDay = planDay;
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

      <Text style={[st.lbl, { color: c.mute, marginTop: space.md }]}>What did you do?</Text>
      <View style={st.wrap}>
        {CARDIO_TYPES.map((t) => (
          <Pill
            key={t.id}
            label={t.label}
            selected={type === t.id}
            onPress={() => {
              setType(t.id);
              if (t.id !== 'run') setPlanDay('');
              else if (!editing) setPlanDay(defaultPlanDay(cardio, day, 'run') ?? '');
            }}
          />
        ))}
      </View>

      <View style={[st.pair, { marginTop: space.lg }]}>
        {hasDistance ? (
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[st.lbl, { color: c.mute }]}>Miles</Text>
            <Field value={miles} onChangeText={setMiles} keyboardType="decimal-pad" placeholder="e.g. 3.1" accessibilityLabel="Miles" />
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
          <View style={st.wrap}>
            {options.map((o) => (
              <Pill
                key={o.s}
                label={`${o.s === day ? 'Today’s' : shortDayLabel(o.s)} ${o.run.race ? 'race' : RUN_LABEL[o.run.type].toLowerCase()} · ${fmt(o.run.miles)} mi`}
                selected={planDay === o.s}
                onPress={() => setPlanDay(o.s)}
              />
            ))}
            <Pill label="Extra run" selected={!planDay} onPress={() => setPlanDay('')} />
          </View>
          <Mute style={{ fontSize: 13 }}>Pick a missed or upcoming plan run to make it up, or log this as an extra run.</Mute>
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 6 },
  pair: { flexDirection: 'row', gap: space.md },
  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.md,
    borderRadius: radius.md - 2, paddingVertical: space.sm + 2, paddingHorizontal: space.md,
  },
  readoutValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, ...tabular },
});
