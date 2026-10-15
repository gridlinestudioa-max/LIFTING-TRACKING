import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { feedDay, feedItems, fmt, mondayOf, shortDayLabel, type CardioSession, type FeedItem } from '@/logic';
import { LogSheet } from '@/ui/cardio/LogSheet';
import { RouteMap } from '@/ui/cardio/RouteMap';
import { Header, Mute, Section } from '@/ui/components';
import { MedalBadge, MedalList } from '@/ui/Medal';
import { ActivityDetail } from '@/ui/feed/ActivityDetail';
import { Button } from '@/ui/food/kit';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { Avatar } from '@/ui/social/Avatar';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

const PAGE = 20;

type Open = { kind: 'view'; item: FeedItem } | { kind: 'cardio'; session: CardioSession; n: number } | { kind: 'lift'; id: string; n: number } | null;

/** Every finished run, ride, swim and workout, newest first, like an activity feed. */
export default function FeedScreen() {
  const c = useColors();
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Open>(null);
  // A fresh key each time, so the sheet starts clean.
  const [n, setN] = useState(0);
  const items = useMemo(() => feedItems(state, today), [state, today]);
  const name = state.settings.name.trim() || 'You';

  const week = useMemo(() => {
    const all = feedItems(state, today).filter((i) => i.date >= mondayOf(today));
    const miles = all.reduce((t, i) => t + (i.kind === 'cardio' && i.session.type !== 'swim' ? (i.session.miles ?? 0) : 0), 0);
    return { cardio: all.filter((i) => i.kind === 'cardio').length, lifts: all.filter((i) => i.kind === 'lift').length, miles, prs: all.reduce((t, i) => t + i.medals.filter((m) => m.rank === 1).length, 0) };
  }, [state, today]);

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
            photo={state.settings.photo}
            city={state.settings.city.trim()}
            today={today}
            onPress={() => setOpen({ kind: 'view', item: it })}
          />
        ))}
        {items.length > shown ? <Button label="Load more" onPress={() => setShown((n) => n + PAGE)} /> : null}
      </ScrollView>

      {open?.kind === 'view' ? (
        <ActivityDetail
          item={open.item}
          onClose={() => setOpen(null)}
          onEdit={() => {
            const it = open.item;
            setN(n + 1);
            setOpen(it.kind === 'cardio' ? { kind: 'cardio', session: it.session, n: n + 1 } : { kind: 'lift', id: it.id, n: n + 1 });
          }}
        />
      ) : null}
      {open?.kind === 'cardio' ? <LogSheet key={open.n} visible day={open.session.date} editing={open.session} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'lift' ? <WorkoutSheet key={open.n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
    </SafeAreaView>
  );
}

/** One activity in the feed. */
function Post({ it, name, photo, city, today, onPress }: { it: FeedItem; name: string; photo: string; city: string; today: string; onPress: () => void }) {
  const c = useColors();
  const kind = it.kind === 'cardio' ? 'Cardio' : 'Lifting';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${it.title}, ${feedDay(it.date, today, shortDayLabel)}. Show details`} style={({ pressed }) => [st.post, { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={st.who}>
        <Avatar name={name} uri={photo} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: c.mute, fontSize: 13 }}>{[feedDay(it.date, today, shortDayLabel), kind, city || null].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <View style={st.titleRow}>
        <Text style={[st.title, { color: c.ink, flexShrink: 1 }]}>{it.title}</Text>
        <MedalBadge medals={it.medals} />
      </View>
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
      <MedalList medals={it.medals} max={4} />
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
  post: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  title: { fontFamily: fonts.semi, fontSize: 24, lineHeight: 28 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.sm, marginTop: space.md },
  stat: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
