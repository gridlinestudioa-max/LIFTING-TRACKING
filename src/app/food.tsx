import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addDays,
  amountText,
  byTime,
  dietName,
  evaluateDay,
  fastHeadline,
  fmt,
  fmtClock,
  fmtDuration,
  fmtInt,
  hasRules,
  minsSinceLastMeal,
  shortDayLabel,
  entryTotals,
  type DayEval,
  type FoodEntry,
  type Verdict,
} from '@/logic';
import { Header, Mute } from '@/ui/components';
import { AddFoodSheet, NutritionSummary } from '@/ui/food/AddFoodSheet';
import { DietSheet } from '@/ui/food/DietSheet';
import { Button, Dot, LinkButton, Notice, Pill, useClock } from '@/ui/food/kit';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, toneColor, useColors } from '@/ui/theme';

const VERDICT: Record<Verdict, { text: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  none: { text: 'Nothing logged yet', tone: 'mute' },
  on: { text: 'On track', tone: 'ok' },
  close: { text: 'On track, close to a limit', tone: 'warn' },
  off: { text: 'Off track', tone: 'bad' },
};

export default function FoodScreen() {
  const c = useColors();
  const { state, today } = useTracker();
  const now = useClock();
  const [day, setDay] = useState(today);
  // Add/edit sheet. `n` remounts it fresh on every open.
  const [sheet, setSheet] = useState<{ n: number; open: boolean; editing: FoodEntry | null }>({ n: 0, open: false, editing: null });
  const [dietOpen, setDietOpen] = useState(false);

  const isToday = day === today;
  const entries = byTime(state.meals[day] ?? []);
  // Calories typed on the Calendar for this day, outside the food log.
  const typed = state.logs[day]?.cin ?? null;
  const ev = evaluateDay(state.diet, entries, day < today, typed ?? 0);
  const openSheet = (editing: FoodEntry | null) => setSheet((s) => ({ n: s.n + 1, open: true, editing }));

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
            {state.diet.limits.kcalMax ? (
              <Text style={{ color: c.mute, fontSize: 14, ...tabular }}>Limit {fmtInt(state.diet.limits.kcalMax)} kcal</Text>
            ) : null}
          </View>
          <NutritionSummary t={ev.totals} />
          {typed ? (
            <Mute style={{ marginTop: space.sm }}>
              {`Plus ${fmtInt(typed)} kcal entered on the Calendar = ${fmtInt(ev.totals.kcal + typed)} kcal in.`}
            </Mute>
          ) : null}
          <Button label="Add food" primary onPress={() => openSheet(null)} style={{ marginTop: space.lg }} />

          {entries.length ? (
            <View style={{ marginTop: space.md }}>
              {entries.map((e, i) => (
                <EntryRow key={e.id} e={e} flags={ev.flags[e.id]} first={i === 0} onPress={() => openSheet(e)} />
              ))}
            </View>
          ) : (
            <Mute style={{ marginTop: space.md }}>
              Nothing logged for this day. Calories you log here count as calories in on the Calendar.
            </Mute>
          )}
        </View>
      </ScrollView>

      <AddFoodSheet
        key={sheet.n}
        visible={sheet.open}
        day={day}
        isToday={isToday}
        now={now}
        editing={sheet.editing}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
      <DietSheet visible={dietOpen} onClose={() => setDietOpen(false)} />
    </SafeAreaView>
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
  const d = state.diet;

  if (!hasRules(d)) {
    return (
      <View style={[st.dietRow, { marginTop: space.lg }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>No diet set</Text>
          <Mute style={{ fontSize: 13 }}>Pick fasting, keto, vegan and more. Food you log is checked against it.</Mute>
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
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{dietName(d)}</Text>
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

function EntryRow({ e, flags, first, onPress }: { e: FoodEntry; flags?: string[]; first: boolean; onPress: () => void }) {
  const c = useColors();
  const t = entryTotals(e);
  const off = !!flags?.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${e.name}, ${fmtClock(e.at)}, ${fmtInt(t.kcal)} calories${off ? ', off track' : ''}. Edit`}
      style={({ pressed }) => [st.entry, !first && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ width: 72, color: c.mute, fontSize: 13, paddingTop: 2, ...tabular }}>{fmtClock(e.at)}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {off ? <Dot tone="bad" size={8} /> : null}
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{e.name}</Text>
        </View>
        <Text style={{ color: c.mute, fontSize: 13, ...tabular }}>
          {amountText(e)} · P {fmt(Math.round(t.protein))} · C {fmt(Math.round(t.netCarbs))} net · F {fmt(Math.round(t.fat))}
        </Text>
        {off ? <Text style={{ color: c.bad, fontSize: 13, marginTop: 2 }}>{flags!.join(' · ')}</Text> : null}
      </View>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', ...tabular }}>{fmtInt(t.kcal)}</Text>
    </Pressable>
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
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md },
});
