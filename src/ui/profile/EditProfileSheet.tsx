import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { USERNAME_RULE, normalizeUsername } from '@/logic';

import { useAccount } from '../account';
import { Field, Mute } from '../components';
import { Button, LinkButton, Sheet } from '../food/kit';
import { removePhotos, uploadPhoto } from '../social/api';
import { Avatar } from '../social/Avatar';
import { useSocial } from '../social/SocialProvider';
import { useTracker } from '../store';
import { space, useColors } from '../theme';
import { pickPhoto } from './pickPhoto';

/** Your picture, name, city and username. */
export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { mode, user } = useAccount();
  const { state, setSettings } = useTracker();
  const social = useSocial();
  const [name, setName] = useState(state.settings.name);
  const [city, setCity] = useState(state.settings.city);
  const [username, setUsername] = useState(social.profile?.username ?? '');
  const [photo, setPhoto] = useState(state.settings.photo);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const signedIn = mode === 'account' && !!user;

  const choose = async () => {
    if (!user) return;
    setErr(null);
    setBusy('photo');
    try {
      const r = await pickPhoto();
      if (r === 'denied') setErr('Photo access is off. Turn it on in your phone’s Settings to pick a picture.');
      else if (r !== 'canceled') {
        const url = await uploadPhoto(user.id, r.jpeg);
        setPhoto(url);
        setSettings({ photo: url });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t add that picture.');
    }
    setBusy(null);
  };

  const removePic = async () => {
    if (!user) return;
    setPhoto('');
    setSettings({ photo: '' });
    await removePhotos(user.id).catch(() => {});
  };

  const save = async () => {
    setErr(null);
    const nm = name.trim();
    const typed = username.trim();
    const u = typed ? normalizeUsername(typed) : null;
    if (typed && !u) return setErr(`Usernames are ${USERNAME_RULE}, like sam_runs.`);
    setBusy('save');
    setSettings({ name: nm, city: city.trim().slice(0, 60) });
    // A username is how friends find you, so setting one turns on Friends.
    if (signedIn && u !== (social.profile?.username ?? null)) {
      const e =
        social.status === 'on'
          ? await social.setUsername(u)
          : u
            ? nm
              ? await social.join(nm, null, u)
              : 'Add your name first: friends see it next to your username.'
            : null;
      if (e) {
        setBusy(null);
        return setErr(e);
      }
    }
    setBusy(null);
    onClose();
  };

  return (
    <Sheet visible title="Edit profile" onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: space.lg }}>
        <Avatar name={name || 'You'} uri={photo} size={104} />
        {signedIn ? (
          <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.md }}>
            <LinkButton label={busy === 'photo' ? 'Adding…' : photo ? 'Change picture' : 'Add a picture'} onPress={() => !busy && choose()} />
            {photo ? <LinkButton label="Remove" color={c.mute} onPress={removePic} /> : null}
          </View>
        ) : (
          <Mute style={{ marginTop: space.sm, textAlign: 'center' }}>Sign in to add a profile picture.</Mute>
        )}
      </View>

      <Text style={[st.lbl, { color: c.mute }]}>Name</Text>
      <Field value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" maxLength={40} accessibilityLabel="Your name" />

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>City</Text>
      <Field value={city} onChangeText={setCity} placeholder="e.g. Austin, TX" autoCapitalize="words" maxLength={60} autoComplete="address-line2" accessibilityLabel="Your city" />
      <Mute style={{ fontSize: 13, marginTop: 4 }}>Shown on your profile, so friends know where you represent.</Mute>

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Username</Text>
      {signedIn ? (
        <>
          <Field
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. sam_runs"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={21}
            accessibilityLabel="Your username"
          />
          <Mute style={{ fontSize: 13, marginTop: 4 }}>
            {`People can search for it to add you as a friend. ${USERNAME_RULE[0].toUpperCase()}${USERNAME_RULE.slice(1)}.${social.status !== 'on' ? ' Adding one turns on Friends.' : ''}`}
          </Mute>
        </>
      ) : (
        <Mute>Sign in to pick a username friends can find you by.</Mute>
      )}

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button label={busy === 'save' ? 'Saving…' : 'Save'} primary onPress={() => !busy && save()} style={{ marginTop: space.xl }} />
    </Sheet>
  );
}

const st = StyleSheet.create({
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
