import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Sections } from '@/logic';
import { useAccount } from '@/ui/account';
import { CommitNumberField, Field, Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton } from '@/ui/food/kit';
import { ProfileForm } from '@/ui/food/ProfileForm';
import { ProfileLines } from '@/ui/food/ProfileLines';
import { SECTION_INFO, SectionToggle } from '@/ui/Onboarding';
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

        <Section title="Account" first>
          {mode === 'account' ? (
            <>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{user?.email}</Text>
              <Mute>Saved to your account, so it’s on every phone and browser you sign in on.</Mute>
              <Button label="Sign out" onPress={signOut} style={{ marginTop: space.md }} />
            </>
          ) : (
            <>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>Using this device only</Text>
              <Mute>
                {cloud
                  ? 'Create an account or sign in to save your data online and use it on other devices. What’s on this device comes with you.'
                  : 'Your data is saved in this browser or phone.'}
              </Mute>
              {cloud ? <Button label="Sign in or create an account" primary onPress={signOut} style={{ marginTop: space.md }} /> : null}
            </>
          )}
        </Section>

        <Section title="Your name">
          <Field
            value={state.settings.name}
            onChangeText={(name) => setSettings({ name })}
            placeholder="First name"
            autoCapitalize="words"
            accessibilityLabel="Your name"
          />
        </Section>

        <Section title="What you track" note="Each one is a tab. Turning one off hides it; nothing you logged is deleted.">
          <View style={{ gap: space.sm }}>
            {SECTION_INFO.map((x) => (
              <SectionToggle key={x.id} title={x.title} blurb={x.blurb} on={on[x.id]} onPress={() => toggle(x.id)} />
            ))}
          </View>
          {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.sm }}>{err}</Text> : null}
        </Section>

        <Section title="Body stats" note="Optional. Used for suggested calories and macros on the Food tab.">
          {p && !editStats ? (
            <View style={{ gap: 4 }}>
              <ProfileLines profile={p} />
              <View style={{ flexDirection: 'row', marginTop: space.xs }}>
                <LinkButton label="Edit" onPress={() => setEditStats(true)} />
              </View>
            </View>
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
        </Section>

        {on.cardio ? (
          <Section title="Cardio plan" note="Planned workouts show on the Cardio tab. Changing plans keeps everything you logged.">
            <PlanPicker plan={state.cardio.plan} today={today} onChange={(plan) => update((s) => ({ ...s, cardio: { ...s.cardio, plan } }))} />
          </Section>
        ) : null}

        {on.food ? (
          <Section title="Daily deficit goal" note="Optional. Progress shows how many days you reach it.">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <CommitNumberField value={state.goal} onCommit={setGoal} accessibilityLabel="Daily deficit goal" style={{ width: 120, textAlign: 'right' }} />
              <Text style={{ color: c.mute, fontSize: 14 }}>kcal a day</Text>
            </View>
          </Section>
        ) : null}

        <Section title="About the data">
          <Mute>
            Foods: USDA FoodData Central (public domain) and Open Food Facts (Open Database License). Exercises: free-exercise-db
            (public domain). Suggested targets are general guidance for healthy adults, not medical advice.
          </Mute>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

