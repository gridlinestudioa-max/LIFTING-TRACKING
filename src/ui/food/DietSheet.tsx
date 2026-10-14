import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ACTIVITY,
  FAST_PRESETS,
  FOOD_TAGS,
  GOALS,
  STYLES,
  STYLE_BY_ID,
  activeDiet,
  calorieTarget,
  editOwnLimits,
  fmt,
  fmtClock,
  fmtInt,
  heightText,
  isAdjusted,
  parseClock,
  suggestTargets,
  tdee,
  usesSuggestions,
  windowText,
  withStyle,
  type Limits,
} from '@/logic';

import { CommitNumberField, Field, Mute } from '../components';
import { useTracker } from '../store';
import { fonts, space, useColors } from '../theme';
import { Button, LinkButton, Notice, Pill, Sheet } from './kit';
import { ProfileForm } from './ProfileForm';

/** Pick and adjust the diet. Changes save as they're made. */
export function DietSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, setDiet, setProfile } = useTracker();
  const d = state.diet;
  const profile = state.profile;
  const [editingProfile, setEditingProfile] = useState(false);
  const f = d.fasting;
  const preset = f ? FAST_PRESETS.find((p) => p.eatHours === f.eatHours) : undefined;
  // "Custom" stays selected while typing hours, even if they happen to match a preset.
  const [customFast, setCustomFast] = useState(!!f && !preset);
  const [startText, setStartText] = useState(fmtClock(f?.start ?? 12 * 60));

  const setFast = (eatHours: number | null) =>
    setDiet({ ...d, fasting: eatHours == null ? null : { eatHours, start: f?.start ?? parseClock(startText) ?? 12 * 60 } });
  const setLimit = (k: keyof Limits, v: number | null) => {
    const limits = { ...d.limits };
    if (v == null) delete limits[k];
    else limits[k] = v;
    setDiet({ ...d, limits });
  };

  return (
    <Sheet visible={visible} title="Your diet" onClose={onClose}>
      <Mute>
        Pick an eating window, a food style, or both (for example 16:8 fasting with keto). The Food tab checks everything you log
        against these rules.
      </Mute>

      <Heading>About you</Heading>
      {profile && !editingProfile ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>
            {[
              profile.sex === 'male' ? 'Male' : 'Female',
              `${profile.age} years`,
              heightText(profile.heightIn),
              `${fmt(profile.weightLb)} lb`,
            ].join(' · ')}
          </Text>
          <Mute>
            {ACTIVITY.find((a) => a.id === profile.activity)!.label} activity · {GOALS.find((g) => g.id === profile.goal)!.label}
          </Mute>
          <Mute>
            {`You burn about ${fmtInt(Math.round(tdee(profile) / 10) * 10)} kcal a day. Suggested intake: ${fmtInt(calorieTarget(profile))} kcal.`}
          </Mute>
          <View style={{ flexDirection: 'row', marginTop: space.xs }}>
            <LinkButton label="Edit your stats" onPress={() => setEditingProfile(true)} />
          </View>
        </View>
      ) : (
        <>
          {!profile ? (
            <Mute style={{ marginBottom: space.md }}>
              Add your body stats and the app suggests healthy daily calories, protein, carbs, sugar and fat for your diet.
            </Mute>
          ) : null}
          <ProfileForm
            initial={profile}
            onSave={(p) => {
              setProfile(p);
              setEditingProfile(false);
            }}
            onCancel={profile ? () => setEditingProfile(false) : undefined}
          />
        </>
      )}

      <Heading>Fasting</Heading>
      <View style={st.wrap}>
        <Pill
          label="Off"
          selected={!f}
          onPress={() => {
            setCustomFast(false);
            setFast(null);
          }}
        />
        {FAST_PRESETS.map((p) => (
          <Pill
            key={p.id}
            label={p.id}
            selected={!!f && !customFast && f.eatHours === p.eatHours}
            onPress={() => {
              setCustomFast(false);
              setFast(p.eatHours);
            }}
          />
        ))}
        <Pill
          label="Custom"
          selected={customFast}
          onPress={() => {
            setCustomFast(true);
            if (!f) setFast(8);
          }}
        />
      </View>
      {f ? (
        <View style={{ marginTop: space.md, gap: space.md }}>
          {!customFast && preset ? <Mute>{preset.blurb}</Mute> : null}
          <View style={st.line}>
            {customFast ? (
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[st.lbl, { color: c.mute }]}>Hours to eat</Text>
                <CommitNumberField
                  value={f.eatHours}
                  onCommit={(v) => v != null && v >= 1 && v <= 23 && setFast(Math.round(v))}
                  accessibilityLabel="Hours in the eating window"
                />
              </View>
            ) : null}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[st.lbl, { color: c.mute }]}>Window opens at</Text>
              <Field
                value={startText}
                onChangeText={setStartText}
                onEndEditing={() => {
                  const m = parseClock(startText);
                  if (m == null) return setStartText(fmtClock(f.start));
                  setStartText(fmtClock(m));
                  setDiet({ ...d, fasting: { ...f, start: m } });
                }}
                autoCorrect={false}
                accessibilityLabel="Eating window opens at"
              />
            </View>
          </View>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>
            Eat between {windowText(f)}. Fast the other {24 - f.eatHours} hours.
          </Text>
          <Mute style={{ fontSize: 13 }}>Black coffee, tea and water (under 10 kcal) don’t break a fast.</Mute>
        </View>
      ) : null}

      <Heading>Food style</Heading>
      <View style={st.wrap}>
        {STYLES.map((s) => (
          <Pill key={s.id} label={s.name} selected={d.style === s.id} onPress={() => setDiet(withStyle(d, s.id))} />
        ))}
      </View>
      <Mute style={{ marginTop: space.md }}>
        {STYLE_BY_ID[d.style].blurb}
        {!profile && isAdjusted(d) ? ' You’ve adjusted the limits below.' : ''}
      </Mute>

      <Heading>Daily targets</Heading>
      {usesSuggestions(d, profile) ? (
        <SuggestedTargets
          onEdit={() => setDiet(editOwnLimits(d, profile))}
        />
      ) : (
        <>
          {profile ? (
            <Notice tone="mute" style={{ marginBottom: space.sm }}>
              <Text style={{ color: c.ink, fontSize: 14 }}>You’re using your own numbers. Suggested values are shown under each one.</Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <LinkButton label="Use the suggested numbers" onPress={() => setDiet({ ...d, auto: true })} />
              </View>
            </Notice>
          ) : (
            <Mute>Leave a box empty to turn that rule off. Add your stats above for suggested numbers.</Mute>
          )}
          {LIMIT_ROWS.map((r) => {
            const sug = profile ? suggestTargets(profile, d.style).limits[r.key] : undefined;
            return (
              <LimitRow
                key={r.key}
                label={r.label}
                unit={r.unit}
                note={[r.note, profile ? (sug != null ? `Suggested: ${fmtInt(sug)}${r.unit === '%' ? '%' : ` ${r.unit}`}` : 'Suggested: off') : null]
                  .filter(Boolean)
                  .join(' · ')}
                value={d.limits[r.key]}
                onCommit={(v) => setLimit(r.key, r.key === 'fatPctMax' && v != null && v > 100 ? 100 : v)}
              />
            );
          })}
        </>
      )}

      <Heading>Foods to avoid</Heading>
      <View style={st.wrap}>
        {FOOD_TAGS.map((t) => (
          <Pill
            key={t.id}
            label={t.label}
            selected={d.exclude.includes(t.id)}
            onPress={() =>
              setDiet({ ...d, exclude: d.exclude.includes(t.id) ? d.exclude.filter((x) => x !== t.id) : [...d.exclude, t.id] })
            }
          />
        ))}
      </View>
    </Sheet>
  );
}

const LIMIT_ROWS: { key: keyof Limits; label: string; unit: string; note?: string }[] = [
  { key: 'kcalMax', label: 'Calories, at most', unit: 'kcal' },
  { key: 'proteinMin', label: 'Protein, at least', unit: 'g' },
  { key: 'netCarbsMax', label: 'Net carbs, at most', unit: 'g', note: 'Carbs minus fiber' },
  { key: 'sugarMax', label: 'Sugar, at most', unit: 'g' },
  { key: 'fatPctMax', label: 'Calories from fat, at most', unit: '%' },
];

/** The targets suggested from the profile and food style, with where each number comes from. */
function SuggestedTargets({ onEdit }: { onEdit: () => void }) {
  const c = useColors();
  const { state } = useTracker();
  const t = suggestTargets(state.profile!, state.diet.style);
  const active = activeDiet(state.diet, state.profile).limits;
  return (
    <View>
      <Mute>Suggested for you and your {STYLE_BY_ID[state.diet.style].name.toLowerCase()} diet. These are what the Food tab checks.</Mute>
      {LIMIT_ROWS.map((r) => {
        const v = active[r.key];
        return (
          <View key={r.key} style={[st.limit, { borderTopColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{r.label}</Text>
              <Mute style={{ fontSize: 13 }}>{v != null ? t.why[r.key] : 'Not used on this diet.'}</Mute>
            </View>
            <Text style={{ color: v != null ? c.ink : c.mute, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {v != null ? `${fmtInt(v)}${r.unit === '%' ? '%' : ` ${r.unit}`}` : 'Off'}
            </Text>
          </View>
        );
      })}
      <Notice tone="mute" style={{ marginTop: space.md }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>Want to use different numbers?</Text>
        <Mute style={{ fontSize: 13 }}>You can change any of these. You can always switch back to the suggestions.</Mute>
        <Button label="Edit these numbers" onPress={onEdit} style={{ marginTop: space.sm, minHeight: 44 }} />
      </Notice>
      <Mute style={{ marginTop: space.sm, fontSize: 12.5, lineHeight: 18 }}>
        General guidance for healthy adults, not medical advice. If you’re pregnant, have a medical condition, or are under a
        doctor’s care, check with them first.
      </Mute>
    </View>
  );
}

function Heading({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[st.h, { color: c.ink, borderTopColor: c.line }]}>{children}</Text>;
}

function LimitRow({
  label,
  unit,
  note,
  value,
  onCommit,
}: {
  label: string;
  unit: string;
  note?: string;
  value: number | undefined;
  onCommit: (v: number | null) => void;
}) {
  const c = useColors();
  return (
    <View style={[st.limit, { borderTopColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {note ? <Mute style={{ fontSize: 13 }}>{note}</Mute> : null}
      </View>
      <CommitNumberField value={value ?? null} onCommit={onCommit} placeholder="Off" accessibilityLabel={label} style={{ width: 96, textAlign: 'right' }} />
      <Text style={{ color: c.mute, fontSize: 14, width: 30 }}>{unit}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  h: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26, marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', gap: space.md },
  lbl: { fontSize: 13, fontWeight: '600' },
  limit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, marginTop: space.xs },
});
