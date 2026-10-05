import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { headline } from '@/logic';

import { useTracker } from './store';
import { useColors } from './theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.h2, { color: c.ink }]}>{children}</Text>;
}

/** Small uppercase section label. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[styles.lbl, { color: c.mute }, style]}>{children}</Text>;
}

export function Mute({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[{ color: c.mute, fontSize: 13 }, style]}>{children}</Text>;
}

/** Screen header: app title, plan week line, save status. */
export function Header() {
  const c = useColors();
  const { state, today, loaded } = useTracker();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.h1, { color: c.ink }]}>Mini Marathon + Lifting</Text>
      <Text style={{ color: c.mute, fontSize: 13 }}>{headline(state, today)}</Text>
      <Text style={{ color: c.mute, fontSize: 11, marginTop: 2 }}>{loaded ? 'Saved on this device' : 'Loading…'}</Text>
    </View>
  );
}

export function StatTile({ value, sub, label, color }: { value: string; sub?: string; label: string; color?: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.card, borderColor: c.line }]}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: color ?? c.ink }}>
        {value}
        {sub ? <Text style={{ fontSize: 14, color: c.mute, fontWeight: '600' }}>{sub}</Text> : null}
      </Text>
      <Text style={{ fontSize: 12, color: c.mute }}>{label}</Text>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.stats}>{children}</View>;
}

export function Field(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.mute}
      {...props}
      style={[styles.input, { color: c.ink, backgroundColor: c.bg, borderColor: c.line }, props.style]}
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

export const styles = StyleSheet.create({
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  h2: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 10, marginBottom: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 12 },
  stat: { width: '48.8%', borderWidth: 1, borderRadius: 12, padding: 10 },
  input: { fontSize: 15, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, minHeight: 38 },
});
