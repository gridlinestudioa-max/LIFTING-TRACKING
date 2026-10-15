import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { EMPTY_CARDIO, EMPTY_LIFTING, type Sections } from '@/logic';

import { useAccount } from '../account';
import { PlanPicker } from '../cardio/PlanPicker';
import { CommitNumberField, Field, Mute, Section } from '../components';
import { DataSection, DeleteSection, PrivacySection } from '../data/DataSection';
import { Button, LinkButton, Sheet } from '../food/kit';
import { ProfileForm } from '../food/ProfileForm';
import { ProfileLines } from '../food/ProfileLines';
import { SECTION_INFO } from '../Onboarding';
import { useTracker } from '../store';
import { space, useColors } from '../theme';

/** Everything that isn't the profile itself: account, your details, tabs, plans, goals and your data. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { mode, user, cloud, signOut } = useAccount();
  const { state, today, update, setSettings, setProfile, setGoal } = useTracker();
  const [editStats, setEditStats] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Training starts fresh; food, profile and diet are kept. Setup runs again to pick new plans.
  const startOver = () => {
    update((s) => ({
      ...s,
      cardio: { ...EMPTY_CARDIO, sessions: [], skips: [] },
      lifting: { ...EMPTY_LIFTING, exercises: [], routines: [], schedule: [...EMPTY_LIFTING.schedule], workouts: [] },
      settings: { ...s.settings, onboarded: false },
    }));
    setConfirmReset(false);
    onClose();
  };
  const on = state.settings.sections;
  const p = state.profile;

  const toggle = (k: keyof Sections) => {
    const next = { ...on, [k]: !on[k] };
    if (!next.food && !next.cardio && !next.lifting) return setErr('Keep at least one turned on.');
    setErr(null);
    setSettings({ sections: next });
  };

  return (
    <Sheet visible title="Settings" onClose={onClose}>
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

      <Section title="Your details" action={p && !editStats ? <LinkButton label="Edit" onPress={() => setEditStats(true)} /> : undefined}>
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

      <Section title="Start a new plan">
        {confirmReset ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: c.ink, fontSize: 15 }}>
              This clears your cardio plan and sessions, and your lifting routines and workouts, then walks you through setup again. Food, your profile and your diet stay.
            </Text>
            <Button label="Clear training and start over" danger onPress={startOver} />
            <Button label="Cancel" onPress={() => setConfirmReset(false)} />
          </View>
        ) : (
          <Button label="Start a new plan" onPress={() => setConfirmReset(true)} />
        )}
      </Section>

      <DataSection />
      <PrivacySection />
      <DeleteSection />

      <Text style={{ color: c.mute, fontSize: 12, lineHeight: 17, marginTop: space.sm, paddingHorizontal: space.xs }}>
        Food data: USDA FoodData Central and Open Food Facts (ODbL). Exercises: free-exercise-db. Targets are general guidance, not medical advice.
      </Text>
    </Sheet>
  );
}

const st = StyleSheet.create({
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm + 2 },
});
