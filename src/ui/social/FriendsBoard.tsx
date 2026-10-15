import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  BEST_LABEL,
  BOARD_METRICS,
  fmt,
  fmtTime,
  USERNAME_RULE,
  normalizePhone,
  normalizeUsername,
  rankBoard,
  shareSummary,
  todayString,
  type BoardMetric,
  type BoardSport,
  type Sharing,
} from '@/logic';

import { Field, Mute, Section } from '../components';
import { Button, LinkButton, Pill } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { FriendsSheet } from './FriendsSheet';
import { removeFriend } from './api';
import { Avatar } from './Avatar';
import { FriendProfile } from './FriendProfile';
import { Rank, SportPills } from './PersonalBoard';
import { useSocial } from './SocialProvider';

function metricText(sport: BoardSport, m: BoardMetric, v: number): string {
  if (m === 'best') {
    if (sport === 'bike') return `${fmt(v)} mph`;
    return sport === 'swim' ? `${fmtTime(v)} /100 m` : fmtTime(v);
  }
  return sport === 'swim' ? `${Math.round(v * 1609.344).toLocaleString('en-US')} m` : `${fmt(Math.round(v * 10) / 10)} mi`;
}

/**
 * Friends on the profile: a row of friends to tap into, then the leaderboard. Handles every state:
 * signed out, not set up on the server, Friends off (join), and on.
 */
export function FriendsArea() {
  const c = useColors();
  const social = useSocial();
  const [sheet, setSheet] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  if (social.status === 'signedOut') {
    return (
      <Section title="Friends">
        <Mute>Sign in to add friends, see their stats and compete on runs, rides and swims.</Mute>
      </Section>
    );
  }
  if (social.status === 'loading') {
    return (
      <Section title="Friends">
        <Mute>Loading…</Mute>
      </Section>
    );
  }
  if (social.status === 'setup' || social.status === 'error') {
    return (
      <Section title="Friends">
        <Text style={{ color: c.ink, fontSize: 15 }}>{social.error}</Text>
        {social.status === 'error' ? <Button label="Try again" onPress={social.reload} style={{ marginTop: space.md }} /> : null}
      </Section>
    );
  }
  if (social.status === 'off') return <JoinCard />;

  const friends = social.friends ?? [];
  const mates = friends.filter((f) => f.status === 'friends');
  const requests = friends.filter((f) => f.status === 'received').length;
  const person = viewing ? social.board?.find((p) => p.id === viewing) : null;
  const viewingFriend = friends.find((f) => f.id === viewing);
  const viewingName = person?.name ?? viewingFriend?.name ?? '';

  return (
    <>
      <Section
        title={`Friends${mates.length ? ` (${mates.length})` : ''}`}
        action={<LinkButton label={requests ? `Requests (${requests})` : 'Add friends'} onPress={() => setSheet(true)} />}>
        {social.listError ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: c.bad }}>{social.listError}</Text>
            <Button label="Try again" onPress={social.refresh} />
          </View>
        ) : !social.friends ? (
          <Mute>Loading…</Mute>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingVertical: space.xs }}>
            {mates.map((f) => (
              <Pressable key={f.id} onPress={() => setViewing(f.id)} accessibilityRole="button" accessibilityLabel={`${f.name}'s profile`} style={({ pressed }) => [st.friend, { opacity: pressed ? 0.6 : 1 }]}>
                <Avatar name={f.name} uri={f.photo} size={56} />
                <Text style={{ color: c.ink, fontSize: 13, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>
                  {f.name.split(/\s+/)[0]}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Add friends" style={({ pressed }) => [st.friend, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[st.add, { borderColor: c.line }]}>
                <Text style={{ color: c.mute, fontSize: 26, lineHeight: 30 }}>+</Text>
              </View>
              <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600', marginTop: 4 }}>Add</Text>
            </Pressable>
          </ScrollView>
        )}
      </Section>

      <Leaderboard />

      {sheet ? (
        <FriendsSheet
          friends={friends}
          onChanged={social.refresh}
          onClose={() => {
            setSheet(false);
            social.refresh();
          }}
        />
      ) : null}
      {viewing ? (
        <FriendProfile
          name={viewingName}
          summary={person?.summary ?? null}
          photo={viewingFriend?.photo ?? person?.photo}
          city={viewingFriend?.city ?? person?.city}
          username={viewingFriend?.username ?? person?.username}
          onClose={() => setViewing(null)}
          onRemove={async () => {
            await removeFriend(viewing).catch(() => {});
            setViewing(null);
            social.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/** You and your friends, ranked for a sport and a measure. */
function Leaderboard() {
  const c = useColors();
  const { today } = useTracker();
  const social = useSocial();
  const [sport, setSport] = useState<BoardSport>('run');
  const [metric, setMetric] = useState<BoardMetric>('week');
  const people = social.board;
  const rows = people ? rankBoard(people, sport, metric, today) : [];
  if (!people || people.length < 2) return null;
  return (
    <Section title="Leaderboard">
      <SportPills value={sport} onChange={setSport} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
        {BOARD_METRICS.map((m) => (
          <Pill key={m.id} label={m.label} selected={metric === m.id} onPress={() => setMetric(m.id)} style={{ paddingHorizontal: space.md, minHeight: 34, paddingVertical: 5 }} />
        ))}
      </View>
      {metric === 'best' ? <Mute style={{ marginTop: space.sm }}>{BEST_LABEL[sport]}</Mute> : null}
      <View style={{ marginTop: space.md }}>
        {rows.map((r, i) => (
          <View key={r.p.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, r.p.me && { backgroundColor: c.soft, borderRadius: radius.sm }]}>
            {r.rank != null ? <Rank n={r.rank} /> : <View style={{ width: 26 }} />}
            <Avatar name={r.p.name} uri={r.p.photo} size={28} />
            <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: r.p.me ? '800' : '600' }} numberOfLines={1}>
              {r.p.me ? `${r.p.name} (you)` : r.p.name}
            </Text>
            <Text style={[st.value, { color: r.value != null ? c.ink : c.mute }]}>{r.value != null ? metricText(sport, metric, r.value) : '–'}</Text>
          </View>
        ))}
      </View>
      <Mute style={{ fontSize: 12.5, marginTop: space.sm }}>Friends who don’t share cardio show a dash.</Mute>
    </Section>
  );
}

/** What friends can see: cardio, lifting and food, each on or off. */
export function SharingSection() {
  const c = useColors();
  const { state, setSettings } = useTracker();
  const social = useSocial();
  const [preview, setPreview] = useState(false);
  const share = state.settings.share;
  if (social.status !== 'on') return null;
  const rows: { k: keyof Sharing; title: string; what: string }[] = [
    { k: 'cardio', title: 'Cardio', what: 'Distance this week, month and year, longest and fastest by sport. Also puts you on the leaderboard.' },
    { k: 'lifting', title: 'Lifting', what: 'Workouts this week and month, your streak and your top 5 lifts.' },
    { k: 'food', title: 'Food', what: 'Last 7 days: days logged and average calories, protein and deficit. Never what you ate.' },
  ];
  const all = share.cardio && share.lifting && share.food;
  return (
    <Section title="What friends see" action={<LinkButton label={all ? 'Share less' : 'Share all'} onPress={() => setSettings({ share: all ? { cardio: false, lifting: false, food: false } : { cardio: true, lifting: true, food: true } })} />}>
      {rows.map((r, i) => (
        <View key={r.k} style={[st.share, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{r.title}</Text>
            <Text style={{ color: c.mute, fontSize: 13, lineHeight: 18 }}>{r.what}</Text>
          </View>
          <Switch
            value={share[r.k]}
            onValueChange={(v) => setSettings({ share: { ...share, [r.k]: v } })}
            accessibilityLabel={`Share ${r.title.toLowerCase()} with friends`}
            trackColor={{ true: c.ok, false: c.line }}
            thumbColor="#ffffff"
            {...({ activeThumbColor: '#ffffff' } as object)}
          />
        </View>
      ))}
      <Mute style={{ fontSize: 12.5, marginTop: space.sm }}>Only your friends can see these. Your name, picture, city and username show to friends and to people who find you by username or number.</Mute>
      <View style={{ flexDirection: 'row', marginTop: space.sm }}>
        <LinkButton label="Preview your profile as a friend" onPress={() => setPreview(true)} />
      </View>
      {preview ? (
        <FriendProfile
          name={state.settings.name || 'You'}
          summary={shareSummary(state, todayString(), share)}
          photo={state.settings.photo}
          city={state.settings.city}
          username={social.profile?.username}
          onClose={() => setPreview(false)}
        />
      ) : null}
    </Section>
  );
}

/** Turning on Friends: your name, and your number so friends can find you. */
function JoinCard() {
  const c = useColors();
  const { state, setSettings } = useTracker();
  const social = useSocial();
  const [name, setName] = useState(state.settings.name);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    const nm = name.trim();
    if (!nm) return setErr('Add the name friends will see.');
    const u = username.trim() ? normalizeUsername(username) : null;
    if (username.trim() && !u) return setErr(`Usernames are ${USERNAME_RULE}, like sam_runs.`);
    const num = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !num) return setErr('That number doesn’t look right. Include the country code if you’re outside the US, like +44 7700 900123.');
    setBusy(true);
    if (nm !== state.settings.name) setSettings({ name: nm });
    const e = await social.join(nm, num, u);
    setBusy(false);
    setErr(e);
  };

  return (
    <Section title="Friends leaderboard">
      <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>Compete with friends on running, riding and swimming: weekly distance, longest and fastest.</Text>
      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Name friends see</Text>
      <Field value={name} onChangeText={setName} placeholder="First name" autoCapitalize="words" maxLength={40} accessibilityLabel="Name friends see" />
      <Text style={[st.lbl, { color: c.mute, marginTop: space.md }]}>Username (so friends can search for you)</Text>
      <Field value={username} onChangeText={setUsername} placeholder="e.g. sam_runs" autoCapitalize="none" autoCorrect={false} maxLength={21} accessibilityLabel="Username" />
      <Text style={[st.lbl, { color: c.mute, marginTop: space.md }]}>Your phone number (so contacts can find you)</Text>
      <Field value={phone} onChangeText={setPhone} placeholder="e.g. (555) 123-4567" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="Your phone number" />
      <Text style={{ color: c.mute, fontSize: 13, lineHeight: 18, marginTop: space.sm }}>
        Friends see your name and what you choose to share: cardio (on to start), lifting and food summaries. Never your routes, what you ate, your weight or notes. Your number is scrambled (hashed) before it’s stored.
      </Text>
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button label={busy ? 'Turning on…' : 'Turn on Friends'} primary onPress={() => !busy && go()} style={{ marginTop: space.lg }} />
    </Section>
  );
}

const st = StyleSheet.create({
  friend: { width: 64, alignItems: 'center' },
  add: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.xs },
  value: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, ...tabular },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
