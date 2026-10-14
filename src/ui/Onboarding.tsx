import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DAY_NAMES, TEMPLATES, applyTemplate, mondayOf, newId, type Sections } from '@/logic';

import { Field, Mute } from './components';
import { Button, LinkButton } from './food/kit';
import { ProfileForm } from './food/ProfileForm';
import { StartPicker } from './StartPicker';
import { useTracker } from './store';
import { fonts, radius, space, useColors } from './theme';

type Step = 'sections' | 'body' | 'cardio' | 'lifting';

export const SECTION_INFO: { id: keyof Sections; title: string; blurb: string }[] = [
  { id: 'food', title: 'Food', blurb: 'Log meals from 12,900 USDA foods and branded products. Calories, macros, fasting and diets like keto.' },
  { id: 'cardio', title: 'Cardio', blurb: 'Log runs, rides, swims and more. Optional 12-week half-marathon plan.' },
  { id: 'lifting', title: 'Lifting', blurb: 'Build routines from 700+ exercises. The app raises your weights as you get stronger.' },
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
  const [planOn, setPlanOn] = useState(!!state.cardio.plan);
  const [planStart, setPlanStart] = useState(state.cardio.plan?.start ?? mondayOf(today));
  const hasRoutines = state.lifting.routines.length > 0;
  const [template, setTemplate] = useState<string | null>(hasRoutines ? 'keep' : null);

  const order: Step[] = ['sections', ...(sections.food ? (['body'] as Step[]) : []), ...(sections.cardio ? (['cardio'] as Step[]) : []), ...(sections.lifting ? (['lifting'] as Step[]) : [])];
  const at = order.indexOf(step);
  const finish = () => {
    update((s) => {
      let lifting = s.lifting;
      if (sections.lifting && template && template !== 'keep' && template !== 'own') {
        const t = TEMPLATES.find((x) => x.id === template)!;
        lifting = applyTemplate(lifting, t, () => newId('r'));
      }
      return {
        ...s,
        settings: { ...s.settings, name: name.trim(), sections, onboarded: true },
        cardio: sections.cardio ? { ...s.cardio, plan: planOn ? { start: mondayOf(planStart) } : null } : s.cardio,
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
            <Mute style={{ fontSize: 15, marginBottom: space.lg }}>
              Used to suggest daily calories, protein, carbs, sugar and fat. Optional; you can add it later.
            </Mute>
            <ProfileForm
              initial={state.profile}
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
            <Mute style={{ fontSize: 15 }}>Log any run, ride, swim or walk. Want a plan too?</Mute>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <SectionToggle
                title="12-week half-marathon plan"
                blurb="Tempo run Tuesday, easy run Friday, long run Sunday, building to 13.1 miles on race day."
                on={planOn}
                onPress={() => setPlanOn(!planOn)}
              />
            </View>
            {planOn ? (
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <Text style={[st.lbl, { color: c.mute }]}>Plan starts (a Monday)</Text>
                <StartPicker start={planStart} onChange={(s) => setPlanStart(mondayOf(s))} />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 'lifting' ? (
          <>
            <Text style={[st.h1, { color: c.ink }]}>Lifting</Text>
            <Mute style={{ fontSize: 15 }}>
              Start from a routine and change anything later. Each exercise has a rep range; when you hit the top on every set,
              the weight goes up.
            </Mute>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {hasRoutines ? (
                <SectionToggle
                  title="Keep my routines"
                  blurb={state.lifting.routines
                    .map((r) => {
                      const days = state.lifting.schedule.map((id, i) => (id === r.id ? DAY_NAMES[i] : null)).filter(Boolean);
                      return days.length ? `${r.name} (${days.join(', ')})` : r.name;
                    })
                    .join(' · ')}
                  on={template === 'keep'}
                  onPress={() => setTemplate('keep')}
                />
              ) : null}
              {TEMPLATES.map((t) => (
                <SectionToggle key={t.id} title={t.name} blurb={`${t.blurb} ${t.routines.map((r) => r.name).join(', ')}.`} on={template === t.id} onPress={() => setTemplate(t.id)} />
              ))}
              <SectionToggle title="Build my own" blurb="Start empty and add routines from the exercise library." on={template === 'own'} onPress={() => setTemplate('own')} />
            </View>
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
