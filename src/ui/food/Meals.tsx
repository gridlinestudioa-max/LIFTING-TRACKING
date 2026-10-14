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
  fmt,
  fmtClock,
  fmtInt,
  mealEntries,
  shortDayLabel,
  sumTotals,
  tallyEntry,
  type Food,
  type FoodEntry,
  type MealSlot,
} from '@/logic';

import { Mute } from '../components';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';
import { Button, Dot, LinkButton, Pill, Sheet } from './kit';

/** The day's log, a group per meal, each with Add and Copy. */
export function MealGroups({
  day,
  entries,
  flags,
  onAdd,
  onEdit,
  onCopy,
}: {
  day: string;
  entries: FoodEntry[];
  flags: Record<string, string[]>;
  onAdd: (m: MealSlot) => void;
  onEdit: (e: FoodEntry) => void;
  onCopy: (m: MealSlot) => void;
}) {
  const c = useColors();
  const { state } = useTracker();
  return (
    <View style={{ marginTop: space.md }}>
      {MEALS.map((m) => {
        const list = mealEntries(entries, m.id);
        const canCopy = daysWithMeal(state.meals, day, m.id).length > 0;
        return (
          <View key={m.id} style={[st.group, { borderTopColor: c.line }]}>
            <View style={st.groupHead}>
              <Text style={[st.groupTitle, { color: c.ink }]}>{m.label}</Text>
              {list.length ? <Text style={{ color: c.mute, fontSize: 14, ...tabular }}>{`${fmtInt(sumTotals(list).kcal)} kcal`}</Text> : null}
              <View style={{ flex: 1 }} />
              {canCopy ? <LinkButton label="Copy" onPress={() => onCopy(m.id)} /> : null}
              <LinkButton label="Add" onPress={() => onAdd(m.id)} />
            </View>
            {list.map((e) => (
              <EntryRow key={e.id} e={e} flags={flags[e.id]} onPress={() => onEdit(e)} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function EntryRow({ e, flags, onPress }: { e: FoodEntry; flags?: string[]; onPress: () => void }) {
  const c = useColors();
  const t = entryTotals(e);
  const off = !!flags?.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}${e.note ? `, ${e.note}` : ''}, ${fmtClock(e.at)}, ${fmtInt(t.kcal)} calories${off ? ', off track' : ''}. Edit`}
      style={({ pressed }) => [st.entry, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ width: 72, color: c.mute, fontSize: 13, paddingTop: 2, ...tabular }}>{fmtClock(e.at)}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {off ? <Dot tone="bad" size={8} /> : null}
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{e.name}</Text>
        </View>
        {e.note ? <Text style={{ color: c.ink, fontSize: 13.5 }}>{e.note}</Text> : null}
        <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>
          {amountText(e)} · P {fmt(Math.round(t.protein))} · C {fmt(Math.round(t.netCarbs))} net · F {fmt(Math.round(t.fat))}
        </Text>
        {off ? <Text style={{ color: c.bad, fontSize: 13, marginTop: 2 }}>{flags!.join(' · ')}</Text> : null}
      </View>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>{fmtInt(t.kcal)}</Text>
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
          <Mute style={{ marginTop: space.lg }}>Untick anything that was different.</Mute>
          <View style={{ marginTop: space.sm }}>
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
                    {e.note ? <Text style={{ color: c.ink, fontSize: 13.5 }}>{e.note}</Text> : null}
                    <Text style={{ color: c.mute, fontSize: 13 }}>{amountText(e)}</Text>
                  </View>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>{fmtInt(entryTotals(e).kcal)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Mute style={{ marginTop: space.md }}>
            {chosen.length ? `${fmtInt(sumTotals(chosen).kcal)} kcal. Same times as before; tap an item afterwards to change it.` : 'Nothing ticked.'}
          </Mute>
          <Button
            label={chosen.length ? `Add ${chosen.length} to ${name}` : 'Add to log'}
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
  const foods: Food[] = state.foods.filter((f) => f.tally);
  // A tally kept for a food that's since been removed from the list still shows for its day.
  entries
    .filter((e) => e.tally && e.foodId && !foods.some((f) => f.id === e.foodId))
    .forEach((e) => foods.push({ id: e.foodId!, name: e.name, serving: e.serving, n: e.n, tags: e.tags, ...(e.note ? { note: e.note } : {}) }));
  if (!foods.length) return null;

  const tap = (f: Food, d: number) => {
    const cur = tallyEntry(entries, f.id);
    setEntries(day, (l) => bumpTally(l, f, d, isToday ? now : (cur?.at ?? 12 * 60)));
  };

  return (
    <View style={[st.group, { borderTopColor: c.line }]}>
      <View style={st.groupHead}>
        <Text style={[st.groupTitle, { color: c.ink }]}>Tally</Text>
        <View style={{ flex: 1 }} />
        <LinkButton label={editing ? 'Done' : 'Edit list'} onPress={() => setEditing(!editing)} />
      </View>
      {foods.map((f) => {
        const e = tallyEntry(entries, f.id);
        const n = e?.qty ?? 0;
        const listed = state.foods.some((x) => x.id === f.id && x.tally);
        return (
          <View key={f.id} style={st.tally}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
              {f.note ? <Text style={{ color: c.ink, fontSize: 13.5 }}>{f.note}</Text> : null}
              <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>
                {e ? `${amountText(e)} · ${fmtInt(entryTotals(e).kcal)} kcal` : 'None yet'}
              </Text>
              {editing && listed ? (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <LinkButton label="Take off the list" color={c.bad} onPress={() => {
                      const { tally: _t, tallyPortion: _p, ...rest } = f;
                      saveFood(rest);
                    }} />
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
      <Mute style={{ fontSize: 13, marginTop: space.xs }}>Counts go into the day’s totals. Add more from Add food → Add to Tally list.</Mute>
    </View>
  );
}

const st = StyleSheet.create({
  group: { borderTopWidth: 1, paddingTop: space.md, paddingBottom: space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  groupTitle: { fontFamily: fonts.semi, fontSize: 20, lineHeight: 26 },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: 1 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tally: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  count: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, minWidth: 32, textAlign: 'center', ...tabular },
});
