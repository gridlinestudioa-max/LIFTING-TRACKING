import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  FAST_PRESETS,
  FOOD_TAGS,
  STYLES,
  STYLE_BY_ID,
  fmtClock,
  isAdjusted,
  parseClock,
  windowText,
  withStyle,
  type Limits,
} from '@/logic';

import { CommitNumberField, Field, Mute } from '../components';
import { useTracker } from '../store';
import { fonts, space, useColors } from '../theme';
import { Pill, Sheet } from './kit';

/** Pick and adjust the diet. Changes save as they're made. */
export function DietSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, setDiet } = useTracker();
  const d = state.diet;
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
        {isAdjusted(d) ? ' You’ve adjusted the limits below.' : ''}
      </Mute>

      <Heading>Daily limits</Heading>
      <Mute>Leave a box empty to turn that rule off.</Mute>
      <LimitRow label="Calories, at most" unit="kcal" value={d.limits.kcalMax} onCommit={(v) => setLimit('kcalMax', v)} />
      <LimitRow label="Net carbs, at most" unit="g" note="Carbs minus fiber" value={d.limits.netCarbsMax} onCommit={(v) => setLimit('netCarbsMax', v)} />
      <LimitRow label="Sugar, at most" unit="g" value={d.limits.sugarMax} onCommit={(v) => setLimit('sugarMax', v)} />
      <LimitRow label="Protein, at least" unit="g" value={d.limits.proteinMin} onCommit={(v) => setLimit('proteinMin', v)} />
      <LimitRow
        label="Calories from fat, at most"
        unit="%"
        value={d.limits.fatPctMax}
        onCommit={(v) => setLimit('fatPctMax', v != null && v > 100 ? 100 : v)}
      />

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
