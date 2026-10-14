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
import { CommitNumberField, Field, Header, Mute } from '@/ui/components';
import { AddFoodSheet, NutritionSummary } from '@/ui/food/AddFoodSheet';
import { DietSheet } from '@/ui/food/DietSheet';
import { CopyMealSheet, MealGroups, TallyList } from '@/ui/food/Meals';
import { Button, Dot, LinkButton, Notice, Pill, useClock } from '@/ui/food/kit';
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
  // Calories typed for this day, outside the food log (below).
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
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[st.day, { color: c.ink }]}>{isToday ? 'Today' : shortDayLabel(day)}</Text>
            {isToday ? <Mute style={{ fontSize: 13 }}>{shortDayLabel(day)}</Mute> : <LinkButton label="Back to today" onPress={() => setDay(today)} />}
          </View>
          <NavButton label="›" a11y="Next day" onPress={() => setDay(addDays(day, 1))} />
        </View>

        <DietStatus ev={ev} isToday={isToday} now={now} day={day} onChange={() => setDietOpen(true)} />

        <View style={[st.section, { borderTopColor: c.line }]}>
          <View style={st.sectionHead}>
            <Text style={[st.h, { color: c.ink }]}>Eaten</Text>
            {diet.limits.kcalMax ? (
              <Text style={{ color: c.mute, fontSize: 14, ...tabular }}>Limit {fmtInt(diet.limits.kcalMax)} kcal</Text>
            ) : null}
          </View>
          <NutritionSummary t={ev.totals} />
          {typed ? (
            <Mute style={{ marginTop: space.sm }}>
              {`Plus ${fmtInt(typed)} extra kcal entered below = ${fmtInt(ev.totals.kcal + typed)} kcal in.`}
            </Mute>
          ) : null}
          <Button label="Add food" primary onPress={() => openSheet(null)} style={{ marginTop: space.lg }} />

          <MealGroups
            day={day}
            entries={entries}
            flags={ev.flags}
            onAdd={(m) => openSheet(null, m)}
            onEdit={(e) => openSheet(e)}
            onCopy={(m) => setCopy((x) => ({ n: x.n + 1, open: true, meal: m }))}
          />
          <TallyList day={day} isToday={isToday} now={now} />
        </View>

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

/** Calories outside the food log, calories burned, the deficit, and a note for the day. */
function InAndOut({ day, onSave }: { day: string; onSave: (s: string, patch: { cin?: number; cout?: number; note?: string }) => void }) {
  const c = useColors();
  const { state } = useTracker();
  const info = state.days[day] ?? {};
  const food = foodKcal(state, day);
  const total = cinFor(state, day);
  const k = kcalInfo(total, info.cout, state.goal);
  const [low, setLow] = useState(false);
  return (
    <View style={[st.section, { borderTopColor: c.line }]}>
      <Text style={[st.h, { color: c.ink }]}>In and out</Text>
      <View style={[st.pair, { marginTop: space.sm }]}>
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
          <Text style={[st.lbl, { color: c.mute }]}>Burned (total)</Text>
          <CommitNumberField value={info.cout ?? null} onCommit={(v) => onSave(day, { cout: v ?? undefined })} placeholder="0" accessibilityLabel="Calories burned" />
        </View>
      </View>
      <Mute style={{ fontSize: 13, marginTop: space.xs }}>
        {food != null
          ? info.cin
            ? `${fmtInt(food)} from your food log + ${fmtInt(info.cin)} extra. `
            : `Filled in from your food log. Make it higher to add anything you didn’t log. `
          : ''}
        Burned = your watch or Health app total for the whole day.
      </Mute>
      {low && food != null ? (
        <Text style={{ color: c.bad, fontSize: 13, marginTop: 2 }}>{`Can’t be less than the ${fmtInt(food)} kcal in your food log. Remove foods above to lower it.`}</Text>
      ) : null}
      <View style={[st.result, { backgroundColor: toneBg(c, k.tone) }]} accessibilityLiveRegion="polite">
        <Text style={k.tone === 'mute' ? { color: c.mute, fontSize: 14 } : { color: toneColor(c, k.tone), fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 }}>
          {k.text}
        </Text>
      </View>
      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg, marginBottom: 6 }]}>Notes for the day</Text>
      <NoteField key={day} value={info.note ?? ''} onCommit={(note) => onSave(day, { note: note || undefined })} />
    </View>
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
      placeholder="How it went, anything to remember"
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
      style={({ pressed }) => [st.nav, { borderColor: c.line, backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: c.ink, fontSize: 22, lineHeight: 24, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Eating-window status (today) and whether the day is on track. */
function DietStatus({ ev, isToday, now, day, onChange }: { ev: DayEval; isToday: boolean; now: number; day: string; onChange: () => void }) {
  const c = useColors();
  const { state } = useTracker();
  const d = activeDiet(state.diet, state.profile);

  if (!hasRules(d)) {
    return (
      <View style={[st.dietRow, { marginTop: space.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>No diet set</Text>
          <Mute style={{ fontSize: 13 }}>
            Add your body stats for suggested daily targets, and pick fasting, keto, vegan and more. Food you log is checked against it.
          </Mute>
        </View>
        <Pill label="Choose a diet" selected={false} onPress={onChange} />
      </View>
    );
  }

  const f = d.fasting;
  const head = f && isToday ? fastHeadline(f, now) : null;
  const ago = f && isToday ? minsSinceLastMeal(state.meals[day] ?? [], state.meals[addDays(day, -1)] ?? [], now) : null;
  const v = VERDICT[ev.verdict];

  return (
    <View style={{ marginTop: space.lg }}>
      <View style={st.dietRow}>
        <View style={{ flex: 1 }}>
          <Mute style={{ fontSize: 13 }}>Your diet</Mute>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{dietName(state.diet, state.profile)}</Text>
        </View>
        <LinkButton label="Change" onPress={onChange} />
      </View>

      {head ? (
        <Notice tone={head.open ? 'ok' : 'warn'} style={{ marginTop: space.md }}>
          <Text style={[st.fastTitle, { color: toneColor(c, head.open ? 'ok' : 'warn') }]}>{head.title}</Text>
          <Text style={{ color: c.ink, fontSize: 15 }}>{head.detail}</Text>
          {ago != null ? (
            <Text style={{ color: c.mute, fontSize: 14 }}>
              {ago < 1 ? 'Last ate just now' : `Last ate ${fmtDuration(ago)} ago${head.open ? '' : ` · fasted ${fmtDuration(ago)} so far`}`}
            </Text>
          ) : null}
        </Notice>
      ) : null}

      <View style={[st.verdict, { marginTop: space.md }]} accessibilityLiveRegion="polite">
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
            {k.note ? <Text style={{ color: k.tone === 'bad' ? c.bad : c.mute, fontSize: 13 }}>{k.note}</Text> : null}
          </View>
          <Text style={{ color: c.ink, fontSize: 14, textAlign: 'right', flexShrink: 1, maxWidth: '50%', ...tabular }}>{k.value}</Text>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  daynav: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  day: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  nav: { borderWidth: 1, borderRadius: radius.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dietRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fastTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  verdictText: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1 },
  section: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  pair: { flexDirection: 'row', gap: space.md },
  lbl: { fontSize: 13, fontWeight: '600' },
  result: { marginTop: space.md, borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md },
});
