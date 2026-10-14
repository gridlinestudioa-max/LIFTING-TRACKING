import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  FAST_PRESETS,
  FOOD_TAGS,
  STYLES,
  STYLE_BY_ID,
  activeDiet,
  calorieTarget,
  editOwnLimits,
  fmtClock,
  fmtInt,
  isAdjusted,
  missingForSuggestions,
  parseClock,
  statsOf,
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
import { MultiSelect, Select } from '../Select';
import { Button, LinkButton, Notice, Sheet } from './kit';
import { ProfileLines } from './ProfileLines';
import { ProfileForm } from './ProfileForm';

/** Pick and adjust the diet. Changes save as they're made. */
export function DietSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, setDiet, setProfile } = useTracker();
  const d = state.diet;
  const profile = state.profile;
  const stats = statsOf(profile);
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
      <Heading>About you</Heading>
      {profile && !editingProfile ? (
        <View style={{ gap: 4 }}>
          <ProfileLines profile={profile} />
          {stats ? (
            <Mute>
              {`Burn about ${fmtInt(Math.round(tdee(stats) / 10) * 10)} kcal a day · suggested ${fmtInt(calorieTarget(stats))} kcal`}
            </Mute>
          ) : (
            <Mute>{`For suggested targets, add your ${missingForSuggestions(profile)}.`}</Mute>
          )}
          <View style={{ flexDirection: 'row', marginTop: space.xs }}>
            <LinkButton label="Edit your stats" onPress={() => setEditingProfile(true)} />
          </View>
        </View>
      ) : (
        <ProfileForm
          initial={profile}
          onSave={(p) => {
            setProfile(p);
            setEditingProfile(false);
          }}
          onCancel={profile ? () => setEditingProfile(false) : undefined}
        />
      )}

      <Heading>Fasting</Heading>
      <Select
        label="Fasting"
        value={!f ? 'off' : customFast || !preset ? 'custom' : preset.id}
        options={[
          { value: 'off', label: 'Off', hint: 'Eat any time.' },
          ...FAST_PRESETS.map((p) => ({ value: p.id, label: p.id, hint: p.blurb })),
          { value: 'custom', label: 'Custom', hint: 'Choose how many hours you eat.' },
        ]}
        onChange={(v) => {
          if (v === 'off') {
            setCustomFast(false);
            setFast(null);
          } else if (v === 'custom') {
            setCustomFast(true);
            if (!f) setFast(8);
          } else {
            setCustomFast(false);
            setFast(FAST_PRESETS.find((p) => p.id === v)!.eatHours);
          }
        }}
      />
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
        </View>
      ) : null}

      <Heading>Food style</Heading>
      <Select label="Food style" value={d.style} options={STYLES.map((s) => ({ value: s.id, label: s.name, hint: s.blurb }))} onChange={(v) => setDiet(withStyle(d, v))} />
      <Mute style={{ marginTop: space.md }}>
        {STYLE_BY_ID[d.style].blurb}
        {!stats && isAdjusted(d) ? ' You’ve adjusted the limits below.' : ''}
      </Mute>

      <Heading>Daily targets</Heading>
      {usesSuggestions(d, profile) ? (
        <SuggestedTargets
          onEdit={() => setDiet(editOwnLimits(d, profile))}
        />
      ) : (
        <>
          {stats ? (
            <Notice tone="mute" style={{ marginBottom: space.sm }}>
              <Text style={{ color: c.ink, fontSize: 14 }}>You’re using your own numbers. Suggested values are shown under each one.</Text>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <LinkButton label="Use the suggested numbers" onPress={() => setDiet({ ...d, auto: true })} />
              </View>
            </Notice>
          ) : (
            <Mute>Leave a box empty to turn it off.</Mute>
          )}
          {LIMIT_ROWS.map((r) => {
            const sug = stats ? suggestTargets(stats, d.style).limits[r.key] : undefined;
            return (
              <LimitRow
                key={r.key}
                label={r.label}
                unit={r.unit}
                note={[r.note, stats ? (sug != null ? `Suggested: ${fmtInt(sug)}${r.unit === '%' ? '%' : ` ${r.unit}`}` : 'Suggested: off') : null]
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
      <MultiSelect
        label="Foods to avoid"
        values={d.exclude}
        options={FOOD_TAGS.map((t) => ({ value: t.id, label: t.label }))}
        onChange={(exclude) => setDiet({ ...d, exclude })}
      />
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
  const t = suggestTargets(statsOf(state.profile)!, state.diet.style);
  const active = activeDiet(state.diet, state.profile).limits;
  return (
    <View>
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
        <Button label="Edit these numbers" onPress={onEdit} style={{ marginTop: space.sm, minHeight: 44 }} />
      </Notice>
      <Mute style={{ marginTop: space.sm, fontSize: 12.5, lineHeight: 18 }}>
        General guidance for healthy adults, not medical advice.
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
  line: { flexDirection: 'row', gap: space.md },
  lbl: { fontSize: 13, fontWeight: '600' },
  limit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, marginTop: space.xs },
});
