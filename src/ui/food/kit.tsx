import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { minutesOf, type Tone } from '@/logic';

import { fonts, radius, space, toneBg, toneColor, useColors } from '../theme';

/** Current time as minutes after midnight. Ticks every 30 s and when the app comes back to the foreground. */
export function useClock(): number {
  const [now, setNow] = useState(() => minutesOf(new Date()));
  useEffect(() => {
    const tick = () => setNow(minutesOf(new Date()));
    const id = setInterval(tick, 30_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return now;
}

/** A choice chip. Filled with ink when selected. */
export function Pill({ label, selected, onPress, style }: { label: string; selected: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        s.pill,
        { borderColor: selected ? c.accent : c.line, backgroundColor: selected ? c.accent : c.card, opacity: pressed ? 0.7 : 1 },
        style,
      ]}>
      <Text style={{ color: selected ? c.onAccent : c.ink, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Full-width button. `primary` is filled; otherwise outlined. `danger` uses the bad color. */
export function Button({
  label,
  onPress,
  primary,
  danger,
  style,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const fg = primary ? c.onAccent : danger ? c.bad : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.button,
        primary ? { backgroundColor: c.accent } : { borderWidth: 1.5, borderColor: danger ? c.bad : c.line, backgroundColor: c.card },
        { opacity: pressed ? 0.75 : 1 },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Small text button. */
export function LinkButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10}>
      {({ pressed }) => <Text style={{ color: color ?? c.ink, fontWeight: '700', fontSize: 15, opacity: pressed ? 0.6 : 1, textDecorationLine: 'underline' }}>{label}</Text>}
    </Pressable>
  );
}

/** A colored status dot. */
export function Dot({ tone, size = 10 }: { tone: Tone; size?: number }) {
  const c = useColors();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: toneColor(c, tone) }} />;
}

/** A tinted message box. */
export function Notice({ tone, children, style }: { tone: Tone; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[s.notice, { backgroundColor: toneBg(c, tone) }, style]}>{children}</View>;
}

/** Slide-up sheet with a title bar and a close button. Content scrolls. */
export function Sheet({
  visible,
  title,
  onClose,
  left,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Optional control at the top left (e.g. Back). */
  left?: ReactNode;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* A Modal is its own native root, so it needs its own safe-area provider. */}
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={[s.bar, { borderBottomColor: c.line }]}>
            <View style={s.barSide}>{left}</View>
            <Text style={[s.barTitle, { color: c.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[s.barSide, { alignItems: 'flex-end' }]}>
              <LinkButton label="Done" onPress={onClose} />
            </View>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets>
            {children}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  pill: { borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: space.lg, minHeight: 40, justifyContent: 'center' },
  button: { minHeight: 52, borderRadius: radius.md + 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  notice: { borderRadius: radius.md - 2, paddingVertical: space.md, paddingHorizontal: space.md, gap: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1 },
  barSide: { width: 72 },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semi, fontSize: 21, lineHeight: 26 },
});
