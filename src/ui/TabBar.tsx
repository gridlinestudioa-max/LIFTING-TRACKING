import { useState, type ComponentType } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import type { Sections } from '@/logic';

import { fonts, radius, space, useColors } from './theme';

type IconProps = { color: string; focused: boolean; size?: number };

const icon = (d: string, extra?: (p: IconProps) => React.ReactNode) =>
  function Icon(p: IconProps) {
    const s = p.size ?? 24;
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth={p.focused ? 2.5 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <Path d={d} />
        {extra?.(p)}
      </Svg>
    );
  };

export const FoodIcon = icon('M5 3v6a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-3.5 2.6-3.5 6.5S15 14 17 14');
// A runner's shoe: sole and laces.
export const CardioIcon = icon('M3 17h16a2 2 0 0 0 0-4l-5-1-3-5H7L5 13H3zM3 20h18M10 9l1.5 2M12.5 8.5 14 10.5');
// A dumbbell.
export const LiftIcon = icon('M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12');
const HomeIcon = icon('M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5');
const ChartIcon = icon('M4 20V10M10 20V4M16 20v-7M22 20H2');
const YouIcon = icon('M4 21c.8-4 4-6 8-6s7.2 2 8 6', (p) => <Circle cx={12} cy={8} r={4} stroke={p.color} />);
// A pulse line: activity.
const FeedIcon = icon('M2 12h4l3-8 4 16 3-8h6');
// Three stacked bars: food, cardio and lifting.
const TrackIcon = icon('M4 6h16M4 12h16M4 18h16');

/** The parts of the navigator's tab bar props this bar uses. */
interface BarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

const TRACK: { name: 'food' | 'cardio' | 'lifting'; label: string; hint: string; Icon: ComponentType<IconProps> }[] = [
  { name: 'food', label: 'Food', hint: 'Meals, calories and the Tally', Icon: FoodIcon },
  { name: 'cardio', label: 'Cardio', hint: 'Record and log runs, rides and swims', Icon: CardioIcon },
  { name: 'lifting', label: 'Lifting', hint: 'Workouts, routines and your plan', Icon: LiftIcon },
];

/**
 * Home · Track · Feed · Progress · Profile. Feed sits in the middle. Track opens a small menu with Food,
 * Cardio and Lifting (whichever are switched on); with only one on, it goes straight there.
 */
export function TabBar({ state, navigation, sections }: BarProps & { sections: Sections }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const current = state.routes[state.index]?.name;
  const tracks = TRACK.filter((t) => sections[t.name]);
  const onTrack = tracks.some((t) => t.name === current);
  const trackLabel = onTrack ? (TRACK.find((t) => t.name === current)?.label ?? 'Track') : 'Track';

  const go = (name: string) => {
    setMenu(false);
    navigation.navigate(name);
  };

  const tabs: { key: string; label: string; focused: boolean; Icon: ComponentType<IconProps>; onPress: () => void; center?: boolean }[] = [
    { key: 'index', label: 'Home', focused: current === 'index', Icon: HomeIcon, onPress: () => go('index') },
    ...(tracks.length
      ? [
          {
            key: 'track',
            label: trackLabel,
            focused: onTrack || menu,
            Icon: onTrack ? (TRACK.find((t) => t.name === current)?.Icon ?? TrackIcon) : TrackIcon,
            onPress: () => (tracks.length === 1 ? go(tracks[0].name) : setMenu((m) => !m)),
          },
        ]
      : []),
    { key: 'feed', label: 'Feed', focused: current === 'feed', Icon: FeedIcon, onPress: () => go('feed'), center: true },
    { key: 'progress', label: 'Progress', focused: current === 'progress', Icon: ChartIcon, onPress: () => go('progress') },
    { key: 'you', label: 'Profile', focused: current === 'you', Icon: YouIcon, onPress: () => go('you') },
  ];

  const barH = 56;
  return (
    <>
      <View style={[st.bar, { backgroundColor: c.card, borderTopColor: c.line, paddingBottom: insets.bottom, height: barH + insets.bottom }]} accessibilityRole="tablist">
        {tabs.map((t) => {
          const color = t.focused ? c.ink : c.mute;
          return (
            <Pressable
              key={t.key}
              onPress={t.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: t.focused, expanded: t.key === 'track' && tracks.length > 1 ? menu : undefined }}
              accessibilityLabel={t.key === 'track' && tracks.length > 1 ? `${t.label}: choose Food, Cardio or Lifting` : t.label}
              style={st.tab}>
              {t.center ? (
                <View style={[st.center, { backgroundColor: t.focused ? c.ink : c.soft }]}>
                  <t.Icon color={t.focused ? c.card : c.ink} focused={t.focused} size={22} />
                </View>
              ) : (
                <t.Icon color={color} focused={t.focused} />
              )}
              <Text style={[st.label, { color }]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={st.backdrop} onPress={() => setMenu(false)} accessibilityLabel="Close menu" />
        <View style={[st.menu, { backgroundColor: c.card, bottom: barH + insets.bottom + space.sm, borderColor: c.line }]} accessibilityRole="menu">
          {tracks.map((t, i) => {
            const here = current === t.name;
            return (
              <Pressable
                key={t.name}
                onPress={() => go(t.name)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: here }}
                style={({ pressed }) => [st.item, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { backgroundColor: pressed || here ? c.soft : 'transparent' }]}>
                <View style={[st.itemIcon, { backgroundColor: c.bg }]}>
                  <t.Icon color={c.ink} focused={here} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.itemTitle, { color: c.ink }]}>{t.label}</Text>
                  <Text style={{ color: c.mute, fontSize: 13 }}>{t.hint}</Text>
                </View>
                <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 6 },
  label: { fontSize: 11, fontWeight: '700' },
  center: { width: 40, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', left: space.lg, right: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', maxWidth: 480, alignSelf: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  itemIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: fonts.semi, fontSize: 20, lineHeight: 24 },
});
