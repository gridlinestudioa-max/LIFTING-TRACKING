import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DAY_NAMES, applyTemplate, liftingPlan, newId, type CardioPlan, type Sections } from '@/logic';

import { PlanPicker } from './cardio/PlanPicker';
import { Field, Mute } from './components';
import { Button, LinkButton } from './food/kit';
import { ProfileForm } from './food/ProfileForm';
import { LiftPlanPicker, type LiftChoice } from './lifting/LiftPlanPicker';
import { Logo } from './Logo';
import { useTracker } from './store';
import { fonts, radius, space, useColors } from './theme';

type Step = 'sections' | 'body' | 'cardio' | 'lifting';

export const SECTION_INFO: { id: keyof Sections; title: string; blurb: string }[] = [
  { id: 'food', title: 'Food', blurb: 'Log meals from 12,900 USDA foods and branded products. Calories, macros, fasting and diets like keto.' },
  { id: 'cardio', title: 'Cardio', blurb: 'Log runs, rides, swims and more. Optional plans from 5K to Ironman.' },
  { id: 'lifting', title: 'Lifting', blurb: 'Plans for 3 to 7 days a week and 700+ exercises. The app raises your weights as you get stronger.' },
];

/** A card that turns a section on or off. */
export function SectionToggle({ title, blurb, on, onPress }: { title: string; blurb: string; on: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={title}
      style={({ pressed }) => [st.card, { borderColor: on ? c.ink : c.line, backgroundColor: c.card, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[st.box, { borderColor: on ? c.ink : c.mute, backgroundColor: on ? c.ink : 'transparent' }]}>
        {on ? <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 15, lineHeight: 18 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.cardTitle, { color: c.ink }]}>{title}</Text>
        <Mute style={{ fontSize: 14 }}>{blurb}</Mute>
      </View>
    </Pressable>
  );
}

/** First-time setup: name and sections, then body stats, cardio plan and a lifting starter if those are on. */
export function Onboarding() {
  const c = useColors();
  const { state, today, update, setSettings, setProfile } = useTracker();
  const [step, setStep] = useState<Step>('sections');
  const [name, setName] = useState(state.settings.name);
  const [sections, setSections] = useState<Sections>(state.settings.sections);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<CardioPlan | null>(state.cardio.plan);
  const hasRoutines = state.lifting.routines.length > 0;
  const [keep, setKeep] = useState(hasRoutines);
  const [lift, setLift] = useState<LiftChoice>({ split: 'ppl', days: 3 });

  const order: Step[] = ['sections', ...(sections.food ? (['body'] as Step[]) : []), ...(sections.cardio ? (['cardio'] as Step[]) : []), ...(sections.lifting ? (['lifting'] as Step[]) : [])];
  const at = order.indexOf(step);
  const finish = () => {
    update((s) => {
      const lifting = sections.lifting && !keep ? applyTemplate(s.lifting, liftingPlan(lift.split, lift.days), () => newId('r')) : s.lifting;
      return {
        ...s,
        settings: { ...s.settings, name: name.trim(), sections, onboarded: true },
        cardio: sections.cardio ? { ...s.cardio, plan } : s.cardio,
        lifting,
      };
    });
  };
  const next = () => {
    setErr(null);
    if (step === 'sections') {
      if (!sections.food && !sections.cardio && !sections.lifting) return setErr('Pick at least one.');
      setSettings({ name: name.trim(), sections });
    }
    const n = order[at + 1];
    if (n) setStep(n);
    else finish();
  };
  const back = at > 0 ? () => setStep(order[at - 1]) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={st.progress}>
          {order.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= at ? c.ink : c.line }} />
          ))}
        </View>
        {back ? (
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            <LinkButton label="Back" onPress={back} />
          </View>
        ) : null}

        {step === 'sections' ? (
          <>
            <View style={{ marginBottom: space.md }}>
              <Logo size={48} />
            </View>
            <Text style={[st.h1, { color: c.ink }]}>Set up your profile</Text>
            <Mute style={{ fontSize: 15 }}>You can change all of this later on the You tab.</Mute>
            <Text style={[st.lbl, { color: c.mute, marginTop: space.xl }]}>Your name (optional)</Text>
            <Field value={name} onChangeText={setName} placeholder="First name" autoCapitalize="words" accessibilityLabel="Your name" />
            <Text style={[st.h2, { color: c.ink }]}>What do you want to track?</Text>
            <View style={{ gap: space.sm }}>
              {SECTION_INFO.map((x) => (
                <SectionToggle key={x.id} title={x.title} blurb={x.blurb} on={sections[x.id]} onPress={() => setSections({ ...sections, [x.id]: !sections[x.id] })} />
              ))}
            </View>
          </>
        ) : null}

        {step === 'body' ? (
          <>
            <Text style={[st.h1, { color: c.ink }]}>About you</Text>
            <Mute style={{ fontSize: 15, marginBottom: space.md }}>
              Used to suggest daily calories, protein, carbs, sugar and fat. You can add or change it later on the You tab.
            </Mute>
            <ProfileForm
              initial={state.profile}
              saveLabel="Next"
              onSave={(p) => {
                setProfile(p);
                next();
              }}
            />
          </>
        ) : null}

        {step === 'cardio' ? (
          <>
            <Text style={[st.h1, { color: c.ink }]}>Cardio</Text>
            <Mute style={{ fontSize: 15, marginBottom: space.lg }}>
              Log any run, ride, swim or walk. Want a plan too? It puts workouts on your calendar and tracks what you finish.
            </Mute>
            <PlanPicker plan={plan} today={today} onChange={setPlan} />
          </>
        ) : null}

        {step === 'lifting' ? (
          <>
            <Text style={[st.h1, { color: c.ink }]}>Lifting</Text>
            <Mute style={{ fontSize: 15, marginBottom: space.lg }}>Choose a plan to start from. You can change anything later.</Mute>
            {hasRoutines ? (
              <View style={{ gap: space.sm, marginBottom: space.lg }}>
                <SectionToggle
                  title="Keep my routines"
                  blurb={state.lifting.routines
                    .map((r) => {
                      const days = state.lifting.schedule.map((id, i) => (id === r.id ? DAY_NAMES[i] : null)).filter(Boolean);
                      return days.length ? `${r.name} (${days.join(', ')})` : r.name;
                    })
                    .join(' · ')}
                  on={keep}
                  onPress={() => setKeep(true)}
                />
                <SectionToggle title="Start a new plan" blurb="Choose a split and days below." on={!keep} onPress={() => setKeep(false)} />
              </View>
            ) : null}
            {!keep ? <LiftPlanPicker value={lift} onChange={setLift} /> : null}
          </>
        ) : null}

        {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
        {step !== 'body' ? (
          <Button label={at === order.length - 1 ? 'Done' : 'Next'} primary onPress={next} style={{ marginTop: space.xl }} />
        ) : (
          <Button label="Skip for now" onPress={next} style={{ marginTop: space.sm }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 4, marginBottom: space.lg },
  h1: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42 },
  h2: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26, marginTop: space.xl, marginBottom: space.sm },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  card: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', borderWidth: 1.5, borderRadius: radius.md, padding: space.md },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
});
