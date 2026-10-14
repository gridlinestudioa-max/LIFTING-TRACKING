import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from './account';
import { Field, Mute } from './components';
import { Button, LinkButton, Notice } from './food/kit';
import { fonts, space, useColors } from './theme';

type Mode = 'signIn' | 'signUp' | 'reset';

/** Sign in, create an account, reset a password, or use the app on this device only. */
export function SignIn() {
  const c = useColors();
  const { cloud, signIn, signUp, resetPassword, useWithoutAccount } = useAccount();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter your email address.');
    if (mode !== 'reset' && pw.length < 6) return setErr('Passwords are at least 6 characters.');
    setBusy(true);
    try {
      if (mode === 'signIn') {
        const e = await signIn(email, pw);
        if (e) setErr(e);
      } else if (mode === 'signUp') {
        const r = await signUp(email, pw);
        if (r.error) setErr(r.error);
        else if (r.confirm) {
          setInfo(`We sent a link to ${email.trim()}. Open it to confirm your email, then sign in here.`);
          setMode('signIn');
        }
      } else {
        const e = await resetPassword(email);
        if (e) setErr(e);
        else setInfo(`If there’s an account for ${email.trim()}, we sent it a link to set a new password.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
          <Text style={[st.brand, { color: c.ink }]}>Training</Text>
          <Mute style={{ fontSize: 16, lineHeight: 22 }}>Track food, cardio and lifting. Use one, two or all three.</Mute>

          {cloud ? (
            <View style={{ marginTop: space.xl }}>
              <Text style={[st.h, { color: c.ink }]}>
                {mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create an account' : 'Reset your password'}
              </Text>
              <View style={{ gap: space.md, marginTop: space.md }}>
                <View style={{ gap: 6 }}>
                  <Text style={[st.lbl, { color: c.mute }]}>Email</Text>
                  <Field
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    accessibilityLabel="Email"
                  />
                </View>
                {mode !== 'reset' ? (
                  <View style={{ gap: 6 }}>
                    <Text style={[st.lbl, { color: c.mute }]}>Password</Text>
                    <Field
                      value={pw}
                      onChangeText={setPw}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                      textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                      onSubmitEditing={go}
                      accessibilityLabel="Password"
                    />
                  </View>
                ) : null}
              </View>
              {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
              {info ? (
                <Notice tone="ok" style={{ marginTop: space.md }}>
                  <Text style={{ color: c.ink, fontSize: 15 }}>{info}</Text>
                </Notice>
              ) : null}
              <Button
                label={busy ? 'One moment…' : mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : 'Send reset link'}
                primary
                onPress={busy ? () => {} : go}
                style={{ marginTop: space.lg }}
              />
              <View style={st.links}>
                {mode === 'signIn' ? (
                  <>
                    <LinkButton label="Create an account" onPress={() => setMode('signUp')} />
                    <LinkButton label="Forgot password?" onPress={() => setMode('reset')} />
                  </>
                ) : (
                  <LinkButton label="Back to sign in" onPress={() => setMode('signIn')} />
                )}
              </View>
            </View>
          ) : (
            <Notice tone="mute" style={{ marginTop: space.xl }}>
              <Text style={{ color: c.ink, fontSize: 15 }}>Accounts aren’t switched on for this app yet. You can use it on this device now.</Text>
            </Notice>
          )}

          <View style={[st.local, { borderTopColor: c.line }]}>
            <Button label="Use without an account" onPress={useWithoutAccount} />
            <Mute style={{ marginTop: space.sm, fontSize: 13 }}>
              Your data stays on this device only. You can create an account later and bring it with you.
            </Mute>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: space.lg, paddingTop: space.xxl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56 },
  h: { fontFamily: fonts.semi, fontSize: 26, lineHeight: 30 },
  lbl: { fontSize: 13, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  local: { marginTop: space.xxl, paddingTop: space.xl, borderTopWidth: 1 },
});
