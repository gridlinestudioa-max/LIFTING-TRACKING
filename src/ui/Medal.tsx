import { StyleSheet, Text, View } from 'react-native';

import { ORDINAL, type Medal } from '@/logic';

import { radius, space, tabular, useColors } from './theme';

/** Gold, silver, bronze. */
export const MEDAL = ['#d4a017', '#9aa4ad', '#b8733a'];

/** Rank badge: a colored disc for the top 3, a plain number after. */
export function Rank({ n, size = 26 }: { n: number; size?: number }) {
  const c = useColors();
  const medal = MEDAL[n - 1];
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, medal ? { backgroundColor: medal } : { borderWidth: 1.5, borderColor: c.line }]}>
      <Text style={{ color: medal ? '#ffffff' : c.mute, fontSize: size * 0.5, fontWeight: '800', ...tabular }}>{n}</Text>
    </View>
  );
}

/** "1st" in a gold pill: the best place an activity holds, shown next to its name. */
export function MedalBadge({ medals }: { medals: Medal[] }) {
  const best = medals[0];
  if (!best) return null;
  return (
    <View
      style={[st.badge, { backgroundColor: MEDAL[best.rank - 1] }]}
      accessibilityLabel={`${ORDINAL[best.rank - 1]} place, ${best.label}`}>
      <Text style={st.badgeText}>{ORDINAL[best.rank - 1]}</Text>
    </View>
  );
}

/** Every place an activity holds: a numbered medal and the category for each. */
export function MedalList({ medals, max = 6 }: { medals: Medal[]; max?: number }) {
  const c = useColors();
  if (!medals.length) return null;
  const shown = medals.slice(0, max);
  return (
    <View style={[st.list, { backgroundColor: c.soft }]}>
      {shown.map((m) => (
        <View key={`${m.rank}${m.label}`} style={st.item} accessibilityLabel={`${ORDINAL[m.rank - 1]} place, ${m.label}`}>
          <Rank n={m.rank} size={20} />
          <Text style={{ color: c.ink, fontSize: 13.5, fontWeight: '600' }}>{m.label}</Text>
        </View>
      ))}
      {medals.length > max ? <Text style={{ color: c.mute, fontSize: 13 }}>{`+${medals.length - max} more`}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: '#ffffff', fontSize: 12.5, fontWeight: '800', ...tabular },
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 6, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
