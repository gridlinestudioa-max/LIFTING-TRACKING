import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MEALS,
  MEAL_LABEL,
  addDays,
  amountText,
  bumpTally,
  copyEntries,
  daysWithMeal,
  entryTotals,
  fmtClock,
  fmtInt,
  mealEntries,
  shortDayLabel,
  sumTotals,
  tallyCount,
  tallyEntry,
  tallyPieces,
  type Food,
  type FoodEntry,
  type MealSlot,
} from '@/logic';

import { Field, Mute, Section } from '../components';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';
import { Button, Dot, LinkButton, Pill, Sheet } from './kit';

/** The day's log, a group per meal, each with Add and Copy. */
export function MealGroups({
  day,
  entries,
  flags,
  onEdit,
  onCopy,
}: {
  day: string;
  entries: FoodEntry[];
  flags: Record<string, string[]>;
  onEdit: (e: FoodEntry) => void;
  onCopy: (m: MealSlot) => void;
}) {
  const c = useColors();
  const { state } = useTracker();
  return (
    <>
      {MEALS.map((m) => {
        const list = mealEntries(entries, m.id);
        const canCopy = daysWithMeal(state.meals, day, m.id).length > 0;
        return (
          <Section
            key={m.id}
            title={m.label}
            action={
              list.length ? (
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>{fmtInt(sumTotals(list).kcal)}</Text>
              ) : canCopy ? (
                <TextButton label="Copy previous" onPress={() => onCopy(m.id)} a11y={`Copy ${m.label.toLowerCase()} from an earlier day`} muted />
              ) : undefined
            }
            style={list.length ? undefined : { paddingBottom: space.xs }}>
            {list.map((e, i) => (
              <EntryRow key={e.id} e={e} flags={flags[e.id]} first={i === 0} onPress={() => onEdit(e)} />
            ))}
            {list.length && canCopy ? (
              <View style={[st.foot, { borderTopColor: c.line, borderTopWidth: 1, marginTop: space.xs }]}>
                <View />
                <TextButton label="Copy previous" onPress={() => onCopy(m.id)} a11y={`Copy ${m.label.toLowerCase()} from an earlier day`} muted />
              </View>
            ) : null}
          </Section>
        );
      })}
    </>
  );
}

/** A plain text action, larger than a link and without the underline. */
function TextButton({ label, onPress, a11y, muted }: { label: string; onPress: () => void; a11y?: string; muted?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={8}>
      {({ pressed }) => <Text style={{ color: muted ? c.mute : c.ink, fontSize: 15, fontWeight: '700', opacity: pressed ? 0.5 : 1 }}>{label}</Text>}
    </Pressable>
  );
}

function EntryRow({ e, flags, first, onPress }: { e: FoodEntry; flags?: string[]; first: boolean; onPress: () => void }) {
  const c = useColors();
  const t = entryTotals(e);
  const off = !!flags?.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}${e.note ? `, ${e.note}` : ''}, ${fmtClock(e.at)}, ${fmtInt(t.kcal)} calories${off ? ', off track' : ''}. Edit`}
      style={({ pressed }) => [st.entry, !first && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {off ? <Dot tone="bad" size={8} /> : null}
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{e.name}</Text>
        </View>
        <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>{[e.note, amountText(e), fmtClock(e.at)].filter(Boolean).join(' · ')}</Text>
        {off ? <Text style={{ color: c.bad, fontSize: 13, marginTop: 2 }}>{flags!.join(' · ')}</Text> : null}
      </View>
      <Text style={{ color: c.ink, fontSize: 16, ...tabular }}>{fmtInt(t.kcal)}</Text>
    </Pressable>
  );
}

/** Copy some or all of a meal from an earlier day. Remount (change `key`) each time it opens. */
export function CopyMealSheet({
  visible,
  day,
  today,
  meal,
  onClose,
}: {
  visible: boolean;
  day: string;
  today: string;
  meal: MealSlot;
  onClose: () => void;
}) {
  const c = useColors();
  const { state, setEntries } = useTracker();
  const sources = daysWithMeal(state.meals, day, meal);
  const [from, setFrom] = useState<string | null>(sources[0] ?? null);
  const list = from ? mealEntries(state.meals[from] ?? [], meal) : [];
  // Everything starts ticked; untick what was different this time.
  const [off, setOff] = useState<Set<string>>(new Set());
  const chosen = list.filter((e) => !off.has(e.id));
  const name = MEAL_LABEL[meal].toLowerCase();
  const dayName = (d: string) =>
    d === addDays(day, -1) ? (day === today ? 'Yesterday' : `The day before (${shortDayLabel(d)})`) : shortDayLabel(d);

  return (
    <Sheet visible={visible} title={`Copy ${name}`} onClose={onClose}>
      {!from ? (
        <Mute>{`No ${name} logged in the 30 days before this one.`}</Mute>
      ) : (
        <View>
          <Text style={[st.lbl, { color: c.mute }]}>{`Copy from`}</Text>
          <Select
            label="Copy from"
            value={from}
            options={sources.map((d) => ({ value: d, label: dayName(d) }))}
            onChange={(d) => {
              setFrom(d);
              setOff(new Set());
            }}
          />
          <View style={{ marginTop: space.lg }}>
            {list.map((e) => {
              const on = !off.has(e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() =>
                    setOff((s) => {
                      const n = new Set(s);
                      if (on) n.add(e.id);
                      else n.delete(e.id);
                      return n;
                    })
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [st.check, { borderTopColor: c.line, opacity: pressed ? 0.6 : 1 }]}>
                  <View style={[st.box, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.card }]}>
                    {on ? <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{e.name}</Text>
                    <Text style={{ color: c.mute, fontSize: 13 }}>{[e.note, amountText(e)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>{fmtInt(entryTotals(e).kcal)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label={chosen.length ? `Add ${chosen.length} · ${fmtInt(sumTotals(chosen).kcal)} kcal` : 'Nothing selected'}
            primary
            style={{ marginTop: space.lg, opacity: chosen.length ? 1 : 0.4 }}
            onPress={() => {
              if (!chosen.length) return;
              setEntries(day, (l) => [...l, ...copyEntries(chosen, meal)]);
              onClose();
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

/** Foods counted through the day with + and −. Hidden until a food is added to the list. */
export function TallyList({ day, isToday, now }: { day: string; isToday: boolean; now: number }) {
  const c = useColors();
  const { state, setEntries, saveFood } = useTracker();
  const [editing, setEditing] = useState(false);
  const entries = state.meals[day] ?? [];
  // Only what was tallied on this day: a tally doesn't carry over to other days.
  const foods: Food[] = entries
    .filter((e) => e.tally && e.foodId)
    .map((e) => state.foods.find((f) => f.id === e.foodId) ?? { id: e.foodId!, name: e.name, serving: e.serving, n: e.n, tags: e.tags, ...(e.note ? { note: e.note } : {}) });
  if (!foods.length) return null;

  const setPieces = (f: Food, v: number) => {
    if (v === tallyPieces(f)) return;
    const next = { ...f, pieces: v };
    // Today's count keeps its calories and switches to the new unit.
    const cur = tallyEntry(entries, f.id);
    if (cur) setEntries(day, (l) => bumpTally(l, next, 0, cur.at));
    saveFood(next);
  };

  const tap = (f: Food, d: number) => {
    const cur = tallyEntry(entries, f.id);
    setEntries(day, (l) => bumpTally(l, f, d, isToday ? now : (cur?.at ?? 12 * 60)));
  };

  return (
    <Section title="Tally" action={<LinkButton label={editing ? 'Done' : 'Edit'} onPress={() => setEditing(!editing)} />}>
      {foods.map((f) => {
        const e = tallyEntry(entries, f.id);
        const n = e ? tallyCount(e, f) : 0;
        const saved = state.foods.some((x) => x.id === f.id);
        const k = tallyPieces(f);
        return (
          <View key={f.id} style={st.tally}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
              <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>
                {[f.note, k > 1 ? `${k} per serving` : 'by the serving', e ? `${fmtInt(entryTotals(e).kcal)} kcal` : null].filter(Boolean).join(' · ')}
              </Text>
              {editing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: 6 }}>
                  {saved ? (
                    <>
                      <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Pieces per serving</Text>
                      <PiecesField start={k} label={`${f.name}: pieces per serving`} onSet={(v) => setPieces(f, v)} />
                    </>
                  ) : null}
                  <LinkButton label="Remove" color={c.bad} onPress={() => setEntries(day, (l) => l.filter((x) => !(x.tally && x.foodId === f.id)))} />
                </View>
              ) : null}
            </View>
            <Pill label="−" selected={false} onPress={() => n > 0 && tap(f, -1)} style={{ paddingHorizontal: 16, opacity: n > 0 ? 1 : 0.4 }} />
            <Text style={[st.count, { color: c.ink }]} accessibilityLabel={`${f.name}: ${n}`}>
              {n}
            </Text>
            <Pill label="+" selected={false} onPress={() => tap(f, 1)} style={{ paddingHorizontal: 16 }} />
          </View>
        );
      })}
    </Section>
  );
}

/** How many pieces a tally serving holds; saved when the field is left or submitted. */
function PiecesField({ start, label, onSet }: { start: number; label: string; onSet: (v: number) => void }) {
  const [v, setV] = useState(String(start));
  const commit = () => {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 200) onSet(n);
    else setV(String(start));
  };
  return (
    <Field
      value={v}
      onChangeText={setV}
      keyboardType="number-pad"
      accessibilityLabel={label}
      onEndEditing={commit}
      onSubmitEditing={commit}
      style={{ width: 64, textAlign: 'center', paddingVertical: 6 }}
    />
  );
}

const st = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm + 2 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.md },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: 1 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tally: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  count: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, minWidth: 32, textAlign: 'center', ...tabular },
});
