import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feedDay, feedItems, fmt, mondayOf, shortDayLabel, type CardioSession, type FeedFilter, type FeedItem } from '@/logic';
import { LogSheet } from '@/ui/cardio/LogSheet';
import { RouteMap } from '@/ui/cardio/RouteMap';
import { Header, Mute, Section } from '@/ui/components';
import { Button, Pill } from '@/ui/food/kit';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { Avatar } from '@/ui/social/Avatar';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

const PAGE = 20;

type Open = { kind: 'cardio'; session: CardioSession; n: number } | { kind: 'lift'; id: string; n: number } | null;

/** Every finished run, ride, swim and workout, newest first, like an activity feed. */
export default function FeedScreen() {
  const c = useColors();
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Open>(null);
  // A fresh key each time, so the sheet starts clean.
  const [n, setN] = useState(0);
  const items = useMemo(() => feedItems(state, today, filter), [state, today, filter]);
  const name = state.settings.name.trim() || 'You';

  const week = useMemo(() => {
    const all = feedItems(state, today).filter((i) => i.date >= mondayOf(today));
    const miles = all.reduce((t, i) => t + (i.kind === 'cardio' && i.session.type !== 'swim' ? (i.session.miles ?? 0) : 0), 0);
    return { cardio: all.filter((i) => i.kind === 'cardio').length, lifts: all.filter((i) => i.kind === 'lift').length, miles, prs: all.reduce((t, i) => t + i.prs.length, 0) };
  }, [state, today]);

  const both = on.cardio && on.lifting;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Feed" />

        <Section title="This week">
          <View style={{ flexDirection: 'row' }}>
            {on.cardio ? <Big value={String(week.cardio)} label={week.cardio === 1 ? 'Activity' : 'Activities'} /> : null}
            {on.cardio ? <Big value={fmt(Math.round(week.miles * 10) / 10)} unit="mi" label="Distance" /> : null}
            {on.lifting ? <Big value={String(week.lifts)} label={week.lifts === 1 ? 'Workout' : 'Workouts'} /> : null}
            <Big value={String(week.prs)} label={week.prs === 1 ? 'Record' : 'Records'} />
          </View>
        </Section>

        {both ? (
          <View style={st.pills}>
            {(
              [
                ['all', 'All'],
                ['cardio', 'Cardio'],
                ['lift', 'Lifting'],
              ] as const
            ).map(([id, label]) => (
              <Pill
                key={id}
                label={label}
                selected={filter === id}
                onPress={() => {
                  setFilter(id);
                  setShown(PAGE);
                }}
              />
            ))}
          </View>
        ) : null}

        {!items.length ? (
          <Section>
            <Text style={[st.title, { color: c.ink }]}>Nothing here yet</Text>
            <Mute style={{ marginTop: space.xs }}>Finish a run, ride, swim or lifting workout and it shows up here, with your stats, route and any records you set.</Mute>
            <View style={{ gap: space.sm, marginTop: space.md }}>
              {on.cardio ? <Button label="Record an activity" primary onPress={() => router.navigate('/cardio')} /> : null}
              {on.lifting ? <Button label="Record a workout" onPress={() => router.navigate('/lifting')} /> : null}
            </View>
          </Section>
        ) : null}

        {items.slice(0, shown).map((it) => (
          <Post
            key={`${it.kind}-${it.id}`}
            it={it}
            name={name}
            today={today}
            onPress={() => {
              setN(n + 1);
              setOpen(it.kind === 'cardio' ? { kind: 'cardio', session: it.session, n: n + 1 } : { kind: 'lift', id: it.id, n: n + 1 });
            }}
          />
        ))}
        {items.length > shown ? <Button label="Load more" onPress={() => setShown((n) => n + PAGE)} /> : null}
      </ScrollView>

      {open?.kind === 'cardio' ? <LogSheet key={open.n} visible day={open.session.date} editing={open.session} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'lift' ? <WorkoutSheet key={open.n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
    </SafeAreaView>
  );
}

/** One activity in the feed. */
function Post({ it, name, today, onPress }: { it: FeedItem; name: string; today: string; onPress: () => void }) {
  const c = useColors();
  const kind = it.kind === 'cardio' ? 'Cardio' : 'Lifting';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${it.title}, ${feedDay(it.date, today, shortDayLabel)}. Open`} style={({ pressed }) => [st.post, { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={st.who}>
        <Avatar name={name} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: c.mute, fontSize: 13 }}>{`${feedDay(it.date, today, shortDayLabel)} · ${kind}`}</Text>
        </View>
      </View>
      <Text style={[st.title, { color: c.ink }]}>{it.title}</Text>
      {it.note ? <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21, marginTop: 2 }}>{it.note}</Text> : null}
      <View style={st.stats}>
        {it.stats.map((s) => (
          <View key={s.label} style={{ minWidth: 70 }}>
            <Text style={{ color: c.mute, fontSize: 12 }}>{s.label}</Text>
            <Text style={[st.stat, { color: c.ink }]}>{s.value}</Text>
          </View>
        ))}
      </View>
      {it.kind === 'cardio' && it.session.route ? <RouteMap route={it.session.route} height={170} style={{ marginTop: space.md }} /> : null}
      {it.prs.length ? (
        <View style={[st.pr, { backgroundColor: c.soft }]}>
          <Text style={{ color: '#b8860b', fontSize: 13.5, fontWeight: '800' }}>{it.prs.length === 1 ? 'Personal record' : `${it.prs.length} personal records`}</Text>
          <Text style={{ color: c.ink, fontSize: 13.5, flex: 1 }} numberOfLines={2}>
            {it.prs.join(', ')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Big({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 28, lineHeight: 32, ...tabular }}>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  pills: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  post: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  title: { fontFamily: fonts.semi, fontSize: 24, lineHeight: 28 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.sm, marginTop: space.md },
  stat: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular },
  pr: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
});
