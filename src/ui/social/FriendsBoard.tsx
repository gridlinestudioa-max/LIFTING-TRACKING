import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BEST_LABEL,
  BOARD_METRICS,
  fmt,
  fmtTime,
  normalizePhone,
  rankBoard,
  type BoardMetric,
  type BoardPerson,
  type BoardSport,
} from '@/logic';

import { Field, Mute, Section } from '../components';
import { Button, LinkButton, Pill } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { FriendsSheet } from './FriendsSheet';
import { friendBoard, myFriends, type Friend } from './api';
import { Rank, SportPills } from './PersonalBoard';
import { useSocial } from './SocialProvider';

function metricText(sport: BoardSport, m: BoardMetric, v: number): string {
  if (m === 'best') {
    if (sport === 'bike') return `${fmt(v)} mph`;
    return sport === 'swim' ? `${fmtTime(v)} /100 m` : fmtTime(v);
  }
  return sport === 'swim' ? `${Math.round(v * 1609.344).toLocaleString('en-US')} m` : `${fmt(Math.round(v * 10) / 10)} mi`;
}

/** You and your friends, ranked for a sport. Lives on the You tab. */
export function FriendsBoard() {
  const c = useColors();
  const { today } = useTracker();
  const social = useSocial();
  const [sport, setSport] = useState<BoardSport>('run');
  const [metric, setMetric] = useState<BoardMetric>('week');
  const [people, setPeople] = useState<BoardPerson[] | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((v) => v + 1), []);

  const on = social.status === 'on';
  const me = social.userId;
  useEffect(() => {
    if (!on || !me) return;
    let live = true;
    Promise.all([friendBoard(me), myFriends()])
      .then(([b, f]) => {
        if (!live) return;
        setPeople(b);
        setFriends(f);
        setErr(null);
      })
      .catch((e) => live && setErr(e instanceof Error ? e.message : 'Couldn’t load the leaderboard.'));
    return () => {
      live = false;
    };
  }, [on, me, n, social.published]);

  if (social.status === 'signedOut') {
    return (
      <Section title="Friends leaderboard">
        <Mute>Sign in to add friends and compete on runs, rides and swims.</Mute>
      </Section>
    );
  }
  if (social.status === 'loading') {
    return (
      <Section title="Friends leaderboard">
        <Mute>Loading…</Mute>
      </Section>
    );
  }
  if (social.status === 'setup' || social.status === 'error') {
    return (
      <Section title="Friends leaderboard">
        <Text style={{ color: c.ink, fontSize: 15 }}>{social.error}</Text>
        {social.status === 'error' ? <Button label="Try again" onPress={social.reload} style={{ marginTop: space.md }} /> : null}
      </Section>
    );
  }
  if (social.status === 'off') return <JoinCard />;

  const rows = people ? rankBoard(people, sport, metric, today) : [];
  const requests = friends.filter((f) => f.status === 'received').length;
  const count = friends.filter((f) => f.status === 'friends').length;

  return (
    <Section title="Friends leaderboard" action={<LinkButton label={requests ? `Requests (${requests})` : 'Friends'} onPress={() => setSheet(true)} />}>
      <SportPills value={sport} onChange={setSport} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
        {BOARD_METRICS.map((m) => (
          <Pill key={m.id} label={m.label} selected={metric === m.id} onPress={() => setMetric(m.id)} style={{ paddingHorizontal: space.md, minHeight: 34, paddingVertical: 5 }} />
        ))}
      </View>
      {metric === 'best' ? <Mute style={{ marginTop: space.sm }}>{BEST_LABEL[sport]}</Mute> : null}

      {err ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Text style={{ color: c.bad }}>{err}</Text>
          <Button label="Try again" onPress={refresh} />
        </View>
      ) : !people ? (
        <Mute style={{ marginTop: space.md }}>Loading…</Mute>
      ) : (
        <View style={{ marginTop: space.md }}>
          {rows.map((r, i) => (
            <View key={r.p.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, r.p.me && { backgroundColor: c.soft, borderRadius: radius.sm }]}>
              {r.rank != null ? <Rank n={r.rank} /> : <View style={{ width: 26 }} />}
              <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: r.p.me ? '800' : '600' }} numberOfLines={1}>
                {r.p.me ? `${r.p.name} (you)` : r.p.name}
              </Text>
              <Text style={[st.value, { color: r.value != null ? c.ink : c.mute }]}>{r.value != null ? metricText(sport, metric, r.value) : '–'}</Text>
            </View>
          ))}
          {count === 0 ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Mute>Add friends to see how you stack up.</Mute>
              <Button label="Add friends" primary onPress={() => setSheet(true)} />
            </View>
          ) : null}
        </View>
      )}
      {sheet ? (
        <FriendsSheet
          friends={friends}
          onChanged={refresh}
          onClose={() => {
            setSheet(false);
            refresh();
          }}
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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    const nm = name.trim();
    if (!nm) return setErr('Add the name friends will see.');
    const num = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !num) return setErr('That number doesn’t look right. Include the country code if you’re outside the US, like +44 7700 900123.');
    setBusy(true);
    if (nm !== state.settings.name) setSettings({ name: nm });
    const e = await social.join(nm, num);
    setBusy(false);
    setErr(e);
  };

  return (
    <Section title="Friends leaderboard">
      <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>Compete with friends on running, riding and swimming: weekly distance, longest and fastest.</Text>
      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Name friends see</Text>
      <Field value={name} onChangeText={setName} placeholder="First name" autoCapitalize="words" maxLength={40} accessibilityLabel="Name friends see" />
      <Text style={[st.lbl, { color: c.mute, marginTop: space.md }]}>Your phone number (so friends can find you)</Text>
      <Field value={phone} onChangeText={setPhone} placeholder="e.g. (555) 123-4567" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="Your phone number" />
      <Text style={{ color: c.mute, fontSize: 13, lineHeight: 18, marginTop: space.sm }}>
        Friends see your name and your cardio totals and bests. Never your routes, food or anything else. Your number is scrambled (hashed) before it’s stored.
      </Text>
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button label={busy ? 'Turning on…' : 'Turn on Friends'} primary onPress={() => !busy && go()} style={{ marginTop: space.lg }} />
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.xs },
  value: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, ...tabular },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
