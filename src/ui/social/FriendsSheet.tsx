import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { normalizePhone } from '@/logic';

import { Field, Label, Mute } from '../components';
import { Button, LinkButton, Pill, Sheet } from '../food/kit';
import { space, useColors } from '../theme';
import { acceptFriend, addFriend, findByPhones, findByUsername, removeFriend, type Friend, type FriendStatus, type Match } from './api';
import { Avatar } from './Avatar';
import { contactsAvailable, readContacts } from './contacts';
import { useSocial } from './SocialProvider';

const APP_URL = 'https://lifting-tracking.vercel.app';

/** Requests, finding people by contacts or number, your own number, and your friends list. */
export function FriendsSheet({ friends, onChanged, onClose }: { friends: Friend[]; onChanged: () => void; onClose: () => void }) {
  const c = useColors();
  const social = useSocial();
  const [phone, setPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searched, setSearched] = useState<'number' | null>(null);
  const [contacts, setContacts] = useState<Match[] | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; list: Match[] } | null>(null);
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
      setContacts(await findByPhones(nums, names));
    });

  // Search usernames as you type, a moment after you stop.
  useEffect(() => {
    const term = q.trim().replace(/^@/, '').toLowerCase();
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      findByUsername(term)
        .then((list) => live && setFound({ q: term, list }))
        .catch((e) => live && setErr(e instanceof Error ? e.message : 'Couldn’t search.'));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const term = q.trim().replace(/^@/, '').toLowerCase();
  const results = term.length >= 2 && found?.q === term ? found.list : null;

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
              <Avatar name={f.name} uri={f.photo} size={36} />
              <Text style={[st.name, { color: c.ink }]}>{f.name}</Text>
              <Pill label="Decline" selected={false} onPress={() => busy !== f.id && drop(f.id)} />
              <Pill label="Accept" selected onPress={() => busy !== f.id && accept(f.id)} />
            </View>
          ))}
        </>
      ) : null}

      <Label style={received.length ? undefined : { marginTop: 0 }}>Find by username</Label>
      <Field
        value={q}
        onChangeText={setQ}
        placeholder="Search usernames, like sam_runs"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search usernames"
      />
      {results ? (
        results.length ? (
          <People list={results} statusOf={(m) => statusOf(m.id, m.status) ?? list.find((f) => f.id === m.id)?.status ?? null} onAdd={add} onAccept={accept} />
        ) : (
          <Mute style={{ marginTop: space.sm }}>No one with a username starting “{term}”.</Mute>
        )
      ) : null}

      <Label>Connect contacts</Label>
      {contactsAvailable() ? (
        <>
          <Mute style={{ marginBottom: space.sm }}>See which of your contacts use the app and have added their phone number. Numbers are scrambled (hashed) on your phone before they’re checked, and your contacts aren’t stored.</Mute>
          <Button label={busy === 'contacts' ? 'Looking…' : contacts ? 'Check contacts again' : 'Connect contacts'} primary={!contacts} onPress={() => !busy && fromContacts()} />
          {contacts ? (
            contacts.length ? (
              <>
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', marginTop: space.md }}>{`${contacts.length} ${contacts.length === 1 ? 'contact uses' : 'contacts use'} Training Tracker`}</Text>
                <People list={contacts} statusOf={(m) => statusOf(m.id, m.status) ?? list.find((f) => f.id === m.id)?.status ?? null} onAdd={add} onAccept={accept} />
              </>
            ) : (
              <Mute style={{ marginTop: space.sm }}>None of your contacts use the app yet, or they haven’t added their number. Invite them below.</Mute>
            )
          ) : null}
        </>
      ) : (
        <Mute>Connecting contacts works in the phone app. Here, search by username or phone number.</Mute>
      )}

      <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.md }}>
        <LinkButton label={showPhone ? 'Hide number search' : 'Search by phone number'} onPress={() => setShowPhone(!showPhone)} />
        <LinkButton label="Invite someone" onPress={invite} />
      </View>
      {showPhone ? (
        <>
          <View style={[st.row, { marginTop: space.sm, gap: space.sm }]}>
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
          {matches && searched ? (
            matches.length ? (
              <People list={matches} statusOf={(m) => statusOf(m.id, m.status) ?? list.find((f) => f.id === m.id)?.status ?? null} onAdd={add} onAccept={accept} />
            ) : (
              <Mute style={{ marginTop: space.sm }}>No one with that number uses the app yet, or they haven’t added their number.</Mute>
            )
          ) : null}
        </>
      ) : null}

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
            <Avatar name={f.name} uri={f.photo} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{f.name}</Text>
              {f.username || f.city ? <Mute style={{ fontSize: 13 }}>{[f.username ? `@${f.username}` : null, f.city || null].filter(Boolean).join(' · ')}</Mute> : null}
            </View>
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

/** People found by username, contacts or number, each with Add, Accept or where you stand. */
function People({ list, statusOf, onAdd, onAccept }: { list: Match[]; statusOf: (m: Match) => FriendStatus | null; onAdd: (id: string) => void; onAccept: (id: string) => void }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.sm }}>
      {list.map((m, i) => {
        const s = statusOf(m);
        const sub = [m.contact && m.contact !== m.name ? `Goes by ${m.name}` : null, m.username ? `@${m.username}` : null, m.city || null].filter(Boolean).join(' · ');
        return (
          <View key={m.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
            <Avatar name={m.name} uri={m.photo} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{m.contact ?? m.name}</Text>
              {sub ? <Mute style={{ fontSize: 13 }}>{sub}</Mute> : null}
            </View>
            {s === 'friends' ? (
              <Text style={{ color: c.ok, fontWeight: '700' }}>Friends</Text>
            ) : s === 'sent' ? (
              <Text style={{ color: c.mute, fontWeight: '700' }}>Requested</Text>
            ) : s === 'received' ? (
              <Pill label="Accept" selected onPress={() => onAccept(m.id)} />
            ) : (
              <Pill label="Add" selected onPress={() => onAdd(m.id)} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
});
