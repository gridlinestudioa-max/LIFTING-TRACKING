import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  activeDiet,
  addDays,
  byTime,
  dietName,
  evaluateDay,
  fastHeadline,
  fmtDuration,
  fmtInt,
  hasRules,
  minsSinceLastMeal,
  shortDayLabel,
  cinFor,
  foodKcal,
  kcalInfo,
  type DayEval,
  type FoodEntry,
  type MealSlot,
  type Verdict,
} from '@/logic';
import { Card, CommitNumberField, Field, Header, Section } from '@/ui/components';
import { AddFoodSheet } from '@/ui/food/AddFoodSheet';
import { DietSheet } from '@/ui/food/DietSheet';
import { CopyMealSheet, MealGroups, TallyList } from '@/ui/food/Meals';
import { Dot, LinkButton, Notice, useClock } from '@/ui/food/kit';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, toneBg, toneColor, useColors } from '@/ui/theme';

const VERDICT: Record<Verdict, { text: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  none: { text: 'Nothing logged yet', tone: 'mute' },
  on: { text: 'On track', tone: 'ok' },
  close: { text: 'On track, close to a limit', tone: 'warn' },
  off: { text: 'Off track', tone: 'bad' },
};

export default function FoodScreen() {
  const c = useColors();
  const { state, today, setDay: saveDay } = useTracker();
  const now = useClock();
  const [day, setDay] = useState(today);
  // Add/edit sheet. `n` remounts it fresh on every open.
  const [sheet, setSheet] = useState<{ n: number; open: boolean; editing: FoodEntry | null; meal?: MealSlot }>({ n: 0, open: false, editing: null });
  const [copy, setCopy] = useState<{ n: number; open: boolean; meal: MealSlot }>({ n: 0, open: false, meal: 'breakfast' });
  const [dietOpen, setDietOpen] = useState(false);

  const isToday = day === today;
  const entries = byTime(state.meals[day] ?? []);
  // Calories typed for this day, outside the food log.
  const typed = state.days[day]?.cin ?? null;
  const diet = activeDiet(state.diet, state.profile);
  const ev = evaluateDay(diet, entries, day < today, typed ?? 0);
  const openSheet = (editing: FoodEntry | null, meal?: MealSlot) => setSheet((s) => ({ n: s.n + 1, open: true, editing, meal }));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Header title="Food" />

        <View style={st.daynav}>
          <NavButton label="‹" a11y="Previous day" onPress={() => setDay(addDays(day, -1))} />
          <Pressable
            onPress={() => setDay(today)}
            disabled={isToday}
            accessibilityRole="button"
            accessibilityLabel={isToday ? `Today, ${shortDayLabel(day)}` : `${shortDayLabel(day)}. Back to today`}
            style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[st.day, { color: c.ink }]}>{isToday ? 'Today' : shortDayLabel(day)}</Text>
            {!isToday ? <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Back to today</Text> : null}
          </Pressable>
          <NavButton label="›" a11y="Next day" onPress={() => setDay(addDays(day, 1))} />
        </View>

        <Summary ev={ev} limit={diet.limits.kcalMax} typed={typed} />
        <DietCard ev={ev} isToday={isToday} now={now} day={day} onChange={() => setDietOpen(true)} />

        <MealGroups
          day={day}
          entries={entries}
          flags={ev.flags}
          onAdd={(m) => openSheet(null, m)}
          onEdit={(e) => openSheet(e)}
          onCopy={(m) => setCopy((x) => ({ n: x.n + 1, open: true, meal: m }))}
        />
        <TallyList day={day} isToday={isToday} now={now} />

        <InAndOut key={day} day={day} onSave={saveDay} />
      </ScrollView>

      <AddFoodSheet
        key={sheet.n}
        visible={sheet.open}
        day={day}
        isToday={isToday}
        now={now}
        editing={sheet.editing}
        meal={sheet.meal}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
      <CopyMealSheet
        key={`copy${copy.n}`}
        visible={copy.open}
        day={day}
        today={today}
        meal={copy.meal}
        onClose={() => setCopy((x) => ({ ...x, open: false }))}
      />
      <DietSheet visible={dietOpen} onClose={() => setDietOpen(false)} />
    </SafeAreaView>
  );
}

/** Calories and macros eaten so far, and what's left under the limit. */
function Summary({ ev, limit, typed }: { ev: DayEval; limit?: number; typed: number | null }) {
  const c = useColors();
  const kcal = ev.totals.kcal + (typed ?? 0);
  const left = limit ? limit - kcal : null;
  const macro = (label: string, v: number) => (
    <View style={{ flex: 1 }}>
      <Text style={[st.macro, { color: c.ink }]}>
        {fmtInt(v)}
        <Text style={{ fontSize: 15, color: c.mute }}> g</Text>
      </Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{label}</Text>
    </View>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Text style={[st.kcal, { color: c.ink }]}>{fmtInt(kcal)}</Text>
          <Text style={{ color: c.mute, fontSize: 13 }}>kcal eaten</Text>
        </View>
        {left != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.macro, { color: left >= 0 ? c.ink : c.bad }]}>{fmtInt(Math.abs(left))}</Text>
            <Text style={{ color: c.mute, fontSize: 13 }}>{left >= 0 ? 'kcal left' : 'kcal over'}</Text>
          </View>
        ) : null}
      </View>
      {limit ? (
        <View style={[st.bar, { backgroundColor: c.soft }]}>
          <View style={{ width: `${Math.min(100, (kcal / limit) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: kcal > limit ? c.bad : c.ink }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', marginTop: space.lg }}>
        {macro('Protein', ev.totals.protein)}
        {macro('Net carbs', ev.totals.netCarbs)}
        {macro('Fat', ev.totals.fat)}
      </View>
    </Card>
  );
}

/** Calories in and burned, and the deficit. */
function InAndOut({ day, onSave }: { day: string; onSave: (s: string, patch: { cin?: number; cout?: number; note?: string }) => void }) {
  const c = useColors();
  const { state } = useTracker();
  const info = state.days[day] ?? {};
  const food = foodKcal(state, day);
  const total = cinFor(state, day);
  const k = kcalInfo(total, info.cout, state.goal);
  const [low, setLow] = useState(false);
  return (
    <>
      <Section title="In and out">
        <View style={st.pair}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[st.lbl, { color: c.mute }]}>Calories in</Text>
            <CommitNumberField
              key={`${day}:${total ?? ''}`}
              value={total}
              onCommit={(v) => {
                // With a food log, the field shows the log plus anything extra; only the extra is saved.
                const extra = v == null ? 0 : Math.round(v - (food ?? 0));
                setLow(food != null && v != null && extra < 0);
                onSave(day, { cin: extra > 0 ? extra : undefined });
              }}
              placeholder="0"
              accessibilityLabel="Calories in"
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[st.lbl, { color: c.mute }]}>Burned</Text>
            <CommitNumberField value={info.cout ?? null} onCommit={(v) => onSave(day, { cout: v ?? undefined })} placeholder="0" accessibilityLabel="Calories burned today" />
          </View>
        </View>
        {low && food != null ? (
          <Text style={{ color: c.bad, fontSize: 13, marginTop: space.sm }}>{`Your food log already has ${fmtInt(food)} kcal.`}</Text>
        ) : null}
        {k.tone !== 'mute' ? (
          <View style={[st.result, { backgroundColor: toneBg(c, k.tone) }]} accessibilityLiveRegion="polite">
            <Text style={{ color: toneColor(c, k.tone), fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 }}>{k.text}</Text>
          </View>
        ) : null}
      </Section>
      <Section title="Notes">
        <NoteField key={day} value={info.note ?? ''} onCommit={(note) => onSave(day, { note: note || undefined })} />
      </Section>
    </>
  );
}

/** A note that saves when you leave the field. */
function NoteField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <Field
      value={text}
      onChangeText={setText}
      onEndEditing={() => text !== value && onCommit(text.trim())}
      placeholder="Anything to remember"
      multiline
      accessibilityLabel="Notes for the day"
      style={{ minHeight: 76, textAlignVertical: 'top', fontSize: 16 }}
    />
  );
}

function NavButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [st.nav, { backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: c.ink, fontSize: 22, lineHeight: 24, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** The diet: whether the day is on track, the fasting window, and each limit. One line when no diet is set. */
function DietCard({ ev, isToday, now, day, onChange }: { ev: DayEval; isToday: boolean; now: number; day: string; onChange: () => void }) {
  const c = useColors();
  const { state } = useTracker();
  const d = activeDiet(state.diet, state.profile);

  if (!hasRules(d)) {
    return (
      <Pressable onPress={onChange} accessibilityRole="button" style={({ pressed }) => [st.dietRow, { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}>
        <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: '600' }}>Set a diet or calorie target</Text>
        <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
      </Pressable>
    );
  }

  const f = d.fasting;
  const head = f && isToday ? fastHeadline(f, now) : null;
  const ago = f && isToday ? minsSinceLastMeal(state.meals[day] ?? [], state.meals[addDays(day, -1)] ?? [], now) : null;
  const v = VERDICT[ev.verdict];

  return (
    <Section title={dietName(state.diet, state.profile)} action={<LinkButton label="Change" onPress={onChange} />}>
      {head ? (
        <Notice tone={head.open ? 'ok' : 'warn'} style={{ marginBottom: space.md }}>
          <Text style={[st.fastTitle, { color: toneColor(c, head.open ? 'ok' : 'warn') }]}>{head.title}</Text>
          <Text style={{ color: c.ink, fontSize: 15 }}>{head.detail}</Text>
          {ago != null && ago >= 1 ? <Text style={{ color: c.mute, fontSize: 14 }}>{`Last ate ${fmtDuration(ago)} ago`}</Text> : null}
        </Notice>
      ) : null}
      <View style={st.verdict} accessibilityLiveRegion="polite">
        <Dot tone={v.tone} size={12} />
        <Text style={[st.verdictText, { color: v.tone === 'mute' ? c.mute : toneColor(c, v.tone) }]}>{v.text}</Text>
      </View>
      {ev.checks.map((k) => (
        <View key={k.key} style={[st.check, { borderTopColor: c.line }]}>
          <View style={{ paddingTop: 5 }}>
            <Dot tone={k.tone} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{k.label}</Text>
            {k.note && k.tone === 'bad' ? <Text style={{ color: c.bad, fontSize: 13 }}>{k.note}</Text> : null}
          </View>
          <Text style={{ color: c.ink, fontSize: 14, textAlign: 'right', flexShrink: 1, maxWidth: '50%', ...tabular }}>{k.value}</Text>
        </View>
      ))}
    </Section>
  );
}

const st = StyleSheet.create({
  daynav: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  day: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  nav: { borderRadius: radius.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kcal: { fontFamily: fonts.display, fontSize: 52, lineHeight: 54, ...tabular },
  macro: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, ...tabular },
  bar: { height: 6, borderRadius: 3, marginTop: space.md, overflow: 'hidden' },
  dietRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.lg },
  fastTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  verdictText: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1 },
  pair: { flexDirection: 'row', gap: space.md },
  lbl: { fontSize: 13, fontWeight: '600' },
  result: { marginTop: space.md, borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md },
});
