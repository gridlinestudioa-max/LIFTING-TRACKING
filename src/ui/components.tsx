import { createContext, useContext, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { useTracker, type SyncStatus } from './store';
import { fonts, radius, space, tabular, useColors } from './theme';

/** A card with no title. Same surface as `Section`. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.panel, { backgroundColor: c.card }, style]}>{children}</View>;
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
 * A page section: a card with a title, an optional action at the top right, and its content.
 * Cards sit on the page background with a clear gap between them, so each section reads as one block.
 */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  /** A small control on the title row, e.g. Edit. */
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Kept so older call sites compile; sections no longer carry notes or a first-section style. */
  note?: string;
  first?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: c.card }, style]}>
      {title || action ? (
        <View style={styles.panelHead}>
          {title ? <Text style={[styles.section, { color: c.ink }]}>{title}</Text> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** One segment per plan week. Past weeks are filled, this week is taller and solid. */
export function WeekBar({ current, weeks }: { current: number; weeks: number }) {
  const c = useColors();
  const label = current < 0 ? 'Plan has not started' : current >= weeks ? 'Plan complete' : `Week ${current + 1} of ${weeks}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.weekbar}>
      {Array.from({ length: weeks }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: i === current ? 10 : 6,
            borderRadius: 3,
            backgroundColor: i <= current ? c.ink : c.line,
            opacity: i < current ? 0.35 : 1,
          }}
        />
      ))}
    </View>
  );
}

const SYNC_TEXT: Record<SyncStatus, string> = {
  device: 'Saved on this device',
  syncing: 'Saving…',
  synced: 'Saved to your account',
  offline: 'Offline: saved on this device',
};

/** Screen header: the title, and the save state only when it needs attention (saving or offline). */
export function Header({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  const c = useColors();
  const { loaded, sync } = useTracker();
  const status = !loaded ? 'Loading…' : sync === 'syncing' || sync === 'offline' ? SYNC_TEXT[sync] : null;
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={styles.titlerow}>
        <Text style={[styles.h1, { color: c.ink }]}>{title}</Text>
        {right ?? (status ? <Text style={{ color: sync === 'offline' ? c.warn : c.mute, fontSize: 12 }}>{status}</Text> : null)}
      </View>
      {children}
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
    <View style={[styles.stat, { width: columns === 3 ? '33.333%' : '50%' }]}>
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
        // react-native-web never fires onEndEditing; leaving the field is the end of editing there.
        if (Platform.OS === 'web') props.onEndEditing?.(e as unknown as Parameters<NonNullable<TextInputProps['onEndEditing']>>[0]);
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
  section: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  panel: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, minHeight: 28 },
  lbl: { fontSize: 13, fontWeight: '600', marginTop: space.md, marginBottom: space.xs },
  titlerow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm },
  weekbar: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 12 },
  weekline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md, marginTop: space.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, marginBottom: space.md },
  stat: { paddingRight: space.sm },
  statValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, ...tabular },
  statSub: { fontFamily: fonts.semi, fontSize: 20 },
  input: {
    fontSize: 17, borderWidth: 1.5, borderRadius: radius.md - 2, paddingHorizontal: space.md, paddingVertical: space.sm,
    minHeight: 46, ...tabular,
  },
});
