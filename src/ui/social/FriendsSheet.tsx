import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { normalizePhone } from '@/logic';

import { Field, Label, Mute } from '../components';
import { Button, LinkButton, Pill, Sheet } from '../food/kit';
import { space, useColors } from '../theme';
import { acceptFriend, addFriend, findByPhones, removeFriend, type Friend, type FriendStatus, type Match } from './api';
import { contactsAvailable, readContacts } from './contacts';
import { useSocial } from './SocialProvider';

const APP_URL = 'https://lifting-tracking.vercel.app';

/** Requests, finding people by contacts or number, your own number, and your friends list. */
export function FriendsSheet({ friends, onChanged, onClose }: { friends: Friend[]; onChanged: () => void; onClose: () => void }) {
  const c = useColors();
  const social = useSocial();
  const [phone, setPhone] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searched, setSearched] = useState<'contacts' | 'number' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState('');
  const [editMine, setEditMine] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  // Changes made here show right away, before the list reloads.
  const [local, setLocal] = useState<Record<string, FriendStatus | 'gone'>>({});

  const statusOf = (id: string, base: FriendStatus | null) => {
    const l = local[id];
    return l === 'gone' ? null : (l ?? base);
  };
  const list = friends.map((f) => ({ ...f, status: statusOf(f.id, f.status) })).filter((f) => f.status);
  const received = list.filter((f) => f.status === 'received');
  const sent = list.filter((f) => f.status === 'sent');
  const mates = list.filter((f) => f.status === 'friends');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(null);
  };

  const add = (id: string) =>
    run(id, async () => {
      const s = await addFriend(id);
      setLocal((l) => ({ ...l, [id]: s }));
    });
  const accept = (id: string) => run(id, async () => {
    await acceptFriend(id);
    setLocal((l) => ({ ...l, [id]: 'friends' }));
  });
  const drop = (id: string) => run(id, async () => {
    await removeFriend(id);
    setLocal((l) => ({ ...l, [id]: 'gone' }));
    setConfirm(null);
  });

  const fromContacts = () =>
    run('contacts', async () => {
      const cs = await readContacts();
      if (cs === 'denied') throw new Error('Contacts access is off. Turn it on in Settings to find friends this way.');
      const names = new Map<string, string>();
      const nums: string[] = [];
      for (const ct of cs) {
        for (const p of ct.phones) {
          const n = normalizePhone(p);
          if (n) {
            nums.push(n);
            if (ct.name) names.set(n, ct.name);
          }
        }
      }
      setMatches(await findByPhones(nums, names));
      setSearched('contacts');
    });

  const byNumber = () => {
    const n = normalizePhone(phone);
    if (!n) return setErr('That number doesn’t look right. Include the country code if it’s outside the US, like +44 7700 900123.');
    run('number', async () => {
      setMatches(await findByPhones([n]));
      setSearched('number');
    });
  };

  const saveMine = (v: string | null) => {
    const n = v == null ? null : normalizePhone(v);
    if (v != null && !n) return setErr('That number doesn’t look right.');
    run('mine', async () => {
      const e = await social.setPhone(n);
      if (e) throw new Error(e);
      setMine('');
      setEditMine(false);
    });
  };

  const invite = () =>
    Share.share(
      Platform.OS === 'web'
        ? { message: `Track runs, rides, lifts and food with me: ${APP_URL}`, title: 'Training Tracker' }
        : { message: `Track runs, rides, lifts and food with me: ${APP_URL}` },
    ).catch(() => {});

  return (
    <Sheet visible title="Friends" onClose={onClose}>
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginBottom: space.md }}>{err}</Text> : null}

      {received.length ? (
        <>
          <Label style={{ marginTop: 0 }}>Requests</Label>
          {received.map((f, i) => (
            <View key={f.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Text style={[st.name, { color: c.ink }]}>{f.name}</Text>
              <Pill label="Decline" selected={false} onPress={() => busy !== f.id && drop(f.id)} />
              <Pill label="Accept" selected onPress={() => busy !== f.id && accept(f.id)} />
            </View>
          ))}
        </>
      ) : null}

      <Label style={received.length ? undefined : { marginTop: 0 }}>Find friends</Label>
      {contactsAvailable() ? (
        <Button label={busy === 'contacts' ? 'Looking…' : 'Find friends from contacts'} primary onPress={() => !busy && fromContacts()} />
      ) : null}
      <View style={[st.row, { marginTop: space.md, gap: space.sm }]}>
        <Field
          value={phone}
          onChangeText={setPhone}
          placeholder="Friend’s phone number"
          keyboardType="phone-pad"
          onSubmitEditing={byNumber}
          accessibilityLabel="Friend’s phone number"
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button label={busy === 'number' ? '…' : 'Find'} onPress={() => !busy && byNumber()} style={{ width: 90 }} />
      </View>

      {matches ? (
        matches.length ? (
          <View style={{ marginTop: space.md }}>
            {matches.map((m, i) => {
              const s = statusOf(m.id, m.status) ?? list.find((f) => f.id === m.id)?.status ?? null;
              return (
                <View key={m.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{m.contact ?? m.name}</Text>
                    {m.contact && m.contact !== m.name ? <Mute>{`Goes by ${m.name}`}</Mute> : null}
                  </View>
                  {s === 'friends' ? (
                    <Text style={{ color: c.ok, fontWeight: '700' }}>Friends</Text>
                  ) : s === 'sent' ? (
                    <Text style={{ color: c.mute, fontWeight: '700' }}>Requested</Text>
                  ) : s === 'received' ? (
                    <Pill label="Accept" selected onPress={() => busy !== m.id && accept(m.id)} />
                  ) : (
                    <Pill label="Add" selected onPress={() => busy !== m.id && add(m.id)} />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            <Mute>
              {searched === 'contacts'
                ? 'None of those contacts use the app yet, or they haven’t added their number.'
                : 'No one with that number uses the app yet, or they haven’t added their number.'}
            </Mute>
          </View>
        )
      ) : null}
      <View style={{ flexDirection: 'row', marginTop: space.md }}>
        <LinkButton label="Invite someone" onPress={invite} />
      </View>

      <Label>Your number</Label>
      {social.profile?.hasPhone && !editMine ? (
        <View style={st.row}>
          <Text style={{ flex: 1, color: c.ink, fontSize: 15 }}>Added. Friends can find you by it.</Text>
          <LinkButton label="Change" onPress={() => setEditMine(true)} />
          <LinkButton label="Remove" color={c.bad} onPress={() => saveMine(null)} />
        </View>
      ) : (
        <>
          <Mute style={{ marginBottom: space.sm }}>Add it so friends can find you. It’s scrambled (hashed) before it’s stored.</Mute>
          <View style={[st.row, { gap: space.sm }]}>
            <Field value={mine} onChangeText={setMine} placeholder="Your phone number" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="Your phone number" style={{ flex: 1, minWidth: 0 }} />
            <Button label={busy === 'mine' ? '…' : 'Save'} onPress={() => !busy && saveMine(mine)} style={{ width: 90 }} />
          </View>
        </>
      )}

      {sent.length ? (
        <>
          <Label>Waiting on them</Label>
          {sent.map((f, i) => (
            <View key={f.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Text style={[st.name, { color: c.ink }]}>{f.name}</Text>
              <LinkButton label="Cancel" color={c.mute} onPress={() => drop(f.id)} />
            </View>
          ))}
        </>
      ) : null}

      <Label>{`Friends (${mates.length})`}</Label>
      {mates.length ? (
        mates.map((f, i) => (
          <View key={f.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
            <Text style={[st.name, { color: c.ink }]}>{f.name}</Text>
            {confirm === f.id ? (
              <>
                <LinkButton label="Keep" onPress={() => setConfirm(null)} />
                <LinkButton label="Remove" color={c.bad} onPress={() => drop(f.id)} />
              </>
            ) : (
              <LinkButton label="Remove" color={c.mute} onPress={() => setConfirm(f.id)} />
            )}
          </View>
        ))
      ) : (
        <Mute>No friends yet.</Mute>
      )}

      <View style={{ marginTop: space.xxl }}>
        {confirm === 'leave' ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: c.ink, fontSize: 15 }}>Turn off Friends? This removes you from friends’ leaderboards and deletes your friends list and shared stats from the server. Your own data stays.</Text>
            <Button
              label="Turn off Friends"
              danger
              onPress={async () => {
                const e = await social.leave();
                if (e) setErr(e);
                else onClose();
              }}
            />
            <Button label="Cancel" onPress={() => setConfirm(null)} />
          </View>
        ) : (
          <Button label="Turn off Friends" onPress={() => setConfirm('leave')} />
        )}
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
});
