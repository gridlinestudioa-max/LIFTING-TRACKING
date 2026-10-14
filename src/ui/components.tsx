import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { LONG, PLAN_WEEKS, fmt, headline, planFor } from '@/logic';

import { useTracker } from './store';
import { fonts, radius, space, tabular, useColors } from './theme';

/** A raised panel. Used sparingly: the day detail and nothing that can sit open on the page. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

/** Sub-heading inside a section (a chart or a table title). */
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[styles.h2, { color: c.ink }, style]}>{children}</Text>;
}

/** Field or group label. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[styles.lbl, { color: c.mute }, style]}>{children}</Text>;
}

export function Mute({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[{ color: c.mute, fontSize: 14, lineHeight: 20 }, style]}>{children}</Text>;
}

/**
 * A page section on the Progress tab: a big heading, optional one-line note, and content that
 * sits directly on the page. A hairline separates it from the section above.
 */
export function Section({ title, note, first, children }: { title: string; note?: string; first?: boolean; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={first ? undefined : { marginTop: space.xxl, paddingTop: space.xl, borderTopWidth: 1, borderTopColor: c.line }}>
      <Text style={[styles.section, { color: c.ink }]}>{title}</Text>
      {note ? <Mute style={{ marginTop: 2 }}>{note}</Mute> : null}
      <View style={{ marginTop: space.md }}>{children}</View>
    </View>
  );
}

/** Twelve segments, one per plan week. Past weeks are filled, this week is taller and solid. */
function WeekBar({ current }: { current: number }) {
  const c = useColors();
  const label = current < 0 ? 'Plan has not started' : current >= PLAN_WEEKS ? 'Plan complete' : `Week ${current + 1} of ${PLAN_WEEKS}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.weekbar}>
      {Array.from({ length: PLAN_WEEKS }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: i === current ? 10 : 6,
            borderRadius: 3,
            backgroundColor: i < current ? c.ink : i === current ? c.ink : c.line,
            opacity: i < current ? 0.35 : 1,
          }}
        />
      ))}
    </View>
  );
}

/** Screen header: title, plan position, save status. */
export function Header({ title = 'Training' }: { title?: string }) {
  const c = useColors();
  const { state, today, loaded } = useTracker();
  const p = planFor(state.start, today);
  const current = p ? p.w : today < state.start ? -1 : PLAN_WEEKS;
  return (
    <View style={{ marginBottom: space.xl }}>
      <View style={styles.titlerow}>
        <Text style={[styles.h1, { color: c.ink }]}>{title}</Text>
        <Text style={{ color: c.mute, fontSize: 12 }}>{loaded ? 'Saved on this device' : 'Loading…'}</Text>
      </View>
      <WeekBar current={current} />
      {p ? (
        <View style={styles.weekline}>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>
            Week {p.w + 1} of {PLAN_WEEKS}
          </Text>
          <Text style={{ color: c.mute, fontSize: 14 }}>Long run this week: {fmt(LONG[p.w])} mi</Text>
        </View>
      ) : (
        <Mute style={{ marginTop: space.sm }}>{headline(state, today)}</Mute>
      )}
    </View>
  );
}

const Columns = createContext(2);

/** A ruled grid of numbers. Cells are separated by hairlines, not boxes. */
export function StatGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <Columns.Provider value={columns}>
      <View style={styles.stats}>{children}</View>
    </Columns.Provider>
  );
}

export function StatTile({ value, sub, label, color }: { value: string; sub?: string; label: string; color?: string }) {
  const c = useColors();
  const columns = useContext(Columns);
  return (
    <View style={[styles.stat, { width: columns === 3 ? '33.333%' : '50%', borderTopColor: c.line }]}>
      <Text style={[styles.statValue, { color: color ?? c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {sub ? <Text style={[styles.statSub, { color: c.mute }]}>{sub}</Text> : null}
      </Text>
      <Text style={{ fontSize: 12.5, lineHeight: 16, color: c.mute, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export function Field(props: TextInputProps) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.mute}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, { color: c.ink, backgroundColor: c.card, borderColor: focused ? c.ink : c.line }, props.style]}
    />
  );
}

/**
 * Number field that only commits when editing ends (like the prototype's "change" event).
 * Invalid input reverts to the current value.
 */
export function CommitNumberField({
  value,
  onCommit,
  style,
  ...rest
}: { value: number | null; onCommit: (v: number | null) => void } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const [text, setText] = useState(value != null ? String(value) : '');
  // Re-sync the text when the saved value changes.
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value != null ? String(value) : '');
  }
  return (
    <Field
      {...rest}
      style={style}
      value={text}
      onChangeText={setText}
      keyboardType="decimal-pad"
      returnKeyType="done"
      onEndEditing={() => {
        const v = parseFloat(text);
        if (Number.isFinite(v) && v > 0) onCommit(v);
        else {
          setText(value != null ? String(value) : '');
          onCommit(null);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.semi, fontSize: 21, lineHeight: 26, marginBottom: space.xs },
  section: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  lbl: { fontSize: 13, fontWeight: '600', marginTop: space.md, marginBottom: space.xs },
  card: { borderWidth: 1, borderRadius: radius.lg + 2, padding: space.lg + 2, marginBottom: space.md },
  titlerow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm },
  weekbar: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 12 },
  weekline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md, marginTop: space.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  stat: { borderTopWidth: 1, paddingTop: space.md, paddingBottom: space.md, paddingRight: space.sm },
  statValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, ...tabular },
  statSub: { fontFamily: fonts.semi, fontSize: 20 },
  input: {
    fontSize: 17, borderWidth: 1.5, borderRadius: radius.md - 2, paddingHorizontal: space.md, paddingVertical: space.sm,
    minHeight: 46, ...tabular,
  },
});
