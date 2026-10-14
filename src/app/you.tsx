import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Sections } from '@/logic';
import { useAccount } from '@/ui/account';
import { CommitNumberField, Field, Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton } from '@/ui/food/kit';
import { ProfileForm } from '@/ui/food/ProfileForm';
import { ProfileLines } from '@/ui/food/ProfileLines';
import { SECTION_INFO } from '@/ui/Onboarding';
import { PlanPicker } from '@/ui/cardio/PlanPicker';
import { useTracker } from '@/ui/store';
import { space, useColors } from '@/ui/theme';

export default function YouScreen() {
  const c = useColors();
  const { mode, user, cloud, signOut } = useAccount();
  const { state, today, update, setSettings, setProfile, setGoal } = useTracker();
  const [editStats, setEditStats] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const on = state.settings.sections;
  const p = state.profile;

  const toggle = (k: keyof Sections) => {
    const next = { ...on, [k]: !on[k] };
    if (!next.food && !next.cardio && !next.lifting) return setErr('Keep at least one turned on.');
    setErr(null);
    setSettings({ sections: next });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Header title={state.settings.name ? state.settings.name : 'You'} />

        <Section title="Account">
          {mode === 'account' ? (
            <>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{user?.email}</Text>
              <Mute>Synced to your account</Mute>
              <Button label="Sign out" onPress={signOut} style={{ marginTop: space.md }} />
            </>
          ) : (
            <>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>Saved on this device only</Text>
              {cloud ? <Button label="Sign in to sync" primary onPress={signOut} style={{ marginTop: space.md }} /> : null}
            </>
          )}
        </Section>

        <Section title="Profile" action={p && !editStats ? <LinkButton label="Edit" onPress={() => setEditStats(true)} /> : undefined}>
          <Text style={[st.lbl, { color: c.mute }]}>Name</Text>
          <Field
            value={state.settings.name}
            onChangeText={(name) => setSettings({ name })}
            placeholder="First name"
            autoCapitalize="words"
            accessibilityLabel="Your name"
          />
          <View style={{ marginTop: space.lg }}>
            {p && !editStats ? (
              <ProfileLines profile={p} />
            ) : (
              <ProfileForm
                initial={p}
                onSave={(np) => {
                  setProfile(np);
                  setEditStats(false);
                }}
                onCancel={p ? () => setEditStats(false) : undefined}
              />
            )}
          </View>
        </Section>

        <Section title="Tabs">
          {SECTION_INFO.map((x, i) => (
            <View key={x.id} style={[st.switchRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: '600' }}>{x.title}</Text>
              <Switch
                value={on[x.id]}
                onValueChange={() => toggle(x.id)}
                accessibilityLabel={`Show the ${x.title} tab`}
                trackColor={{ true: c.ok, false: c.line }}
                thumbColor="#ffffff"
                {...({ activeThumbColor: '#ffffff' } as object)}
              />
            </View>
          ))}
          {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.sm }}>{err}</Text> : null}
        </Section>

        {on.cardio ? (
          <Section title="Cardio plan">
            <PlanPicker plan={state.cardio.plan} today={today} onChange={(plan) => update((s) => ({ ...s, cardio: { ...s.cardio, plan } }))} />
          </Section>
        ) : null}

        {on.food ? (
          <Section title="Deficit goal">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <CommitNumberField value={state.goal} onCommit={setGoal} accessibilityLabel="Daily deficit goal" placeholder="None" style={{ width: 120, textAlign: 'right' }} />
              <Text style={{ color: c.mute, fontSize: 15 }}>kcal a day</Text>
            </View>
          </Section>
        ) : null}

        <Text style={{ color: c.mute, fontSize: 12, lineHeight: 17, marginTop: space.sm, paddingHorizontal: space.xs }}>
          Food data: USDA FoodData Central and Open Food Facts (ODbL). Exercises: free-exercise-db. Targets are general guidance, not medical advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm + 2 },
});
