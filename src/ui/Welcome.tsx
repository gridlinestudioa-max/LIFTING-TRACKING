import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND } from '@/brand';

import { useAccount } from './account';
import { Field, Mute } from './components';
import { Button, Notice } from './food/kit';
import { Logo } from './Logo';
import { fonts, space, useColors } from './theme';

function Page({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
        <Logo size={64} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Opened from the confirmation email: the email is confirmed and the person is already signed in. */
export function Welcome({ setUp }: { setUp: boolean }) {
  const c = useColors();
  const { user, dismissArrival } = useAccount();
  return (
    <Page>
      <Text style={[st.h1, { color: c.ink }]}>You’re signed in</Text>
      <Notice tone="ok" style={{ marginTop: space.md }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>Your email is confirmed.</Text>
        {user?.email ? <Mute>{`Signed in as ${user.email}.`}</Mute> : null}
      </Notice>
      <Mute style={{ fontSize: 16, lineHeight: 22, marginTop: space.lg }}>
        {setUp
          ? `Welcome back to ${BRAND.name}. Everything you’ve logged is saved to your account.`
          : `Welcome to ${BRAND.name}. Next, choose what you want to track. It takes about a minute.`}
      </Mute>
      <Button label={setUp ? 'Continue' : 'Set up your profile'} primary onPress={dismissArrival} style={{ marginTop: space.xl }} />
    </Page>
  );
}

/** Opened from the reset-password email: signed in, choose a new password. */
export function NewPassword() {
  const c = useColors();
  const { user, updatePassword, dismissArrival } = useAccount();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async () => {
    setErr(null);
    if (pw.length < 6) return setErr('Use at least 6 characters.');
    if (pw !== again) return setErr('The two passwords don’t match.');
    setBusy(true);
    const e = await updatePassword(pw);
    setBusy(false);
    if (e) setErr(e);
    else setDone(true);
  };

  if (done) {
    return (
      <Page>
        <Text style={[st.h1, { color: c.ink }]}>Password changed</Text>
        <Mute style={{ fontSize: 16, lineHeight: 22, marginTop: space.md }}>You’re signed in. Use your new password next time.</Mute>
        <Button label="Continue" primary onPress={dismissArrival} style={{ marginTop: space.xl }} />
      </Page>
    );
  }
  return (
    <Page>
      <Text style={[st.h1, { color: c.ink }]}>Choose a new password</Text>
      {user?.email ? <Mute style={{ fontSize: 15, marginTop: space.xs }}>{`For ${user.email}`}</Mute> : null}
      <View style={{ gap: space.md, marginTop: space.lg }}>
        <View style={{ gap: 6 }}>
          <Text style={[st.lbl, { color: c.mute }]}>New password</Text>
          <Field value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" accessibilityLabel="New password" />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[st.lbl, { color: c.mute }]}>Type it again</Text>
          <Field
            value={again}
            onChangeText={setAgain}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={save}
            accessibilityLabel="Confirm new password"
          />
        </View>
      </View>
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button label={busy ? 'One moment…' : 'Save new password'} primary onPress={busy ? () => {} : save} style={{ marginTop: space.lg }} />
      <Button label="Skip, keep my old password" onPress={dismissArrival} style={{ marginTop: space.sm }} />
    </Page>
  );
}

const st = StyleSheet.create({
  page: { padding: space.lg, paddingTop: space.xxl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  h1: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, marginTop: space.lg },
  lbl: { fontSize: 13, fontWeight: '600' },
});
