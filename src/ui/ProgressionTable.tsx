import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BUMP_EVERY, LIFTS, LIFT_GROUPS, PLAN_WEEKS, TYPES, fmt, targetFor, type TrackerState } from '@/logic';

import { CommitNumberField } from './components';
import { useColors } from './theme';

const ROW_H = 38;
const COL_W = 58;
const weeks = Array.from({ length: PLAN_WEEKS }, (_, i) => i);
const isBump = (w: number) => w % BUMP_EVERY === 0;

/** All lifts by 12 weeks. Lift names stay pinned on the left; weeks scroll sideways. */
export function ProgressionTable({
  state,
  currentWeek,
  onBase,
}: {
  state: TrackerState;
  currentWeek: number;
  onBase: (id: string, v: number) => void;
}) {
  const c = useColors();
  const cellBg = (w: number) => (w === currentWeek ? c.accentbg : 'transparent');
  const cellColor = (w: number) => (w === currentWeek ? c.accent : c.ink);
  const cellWeight = (w: number) => (w === currentWeek || isBump(w) ? '700' : '400');

  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      {/* Pinned lift-name column */}
      <View style={{ width: 132, borderRightWidth: 1, borderRightColor: c.line }}>
        <View style={[s.cell, s.left, { borderBottomColor: c.line }]}>
          <Text style={[s.th, { color: c.mute }]}>Lift</Text>
        </View>
        {LIFT_GROUPS.map((g) => [
          <View key={g} style={[s.cell, s.left, { borderBottomColor: c.line, backgroundColor: c.bg }]}>
            <Text style={[s.group, { color: c.mute }]}>{TYPES[g].label}</Text>
          </View>,
          ...LIFTS[g].map((e) => (
            <View key={e.id} style={[s.cell, s.left, { borderBottomColor: c.line }]}>
              <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink }}>
                {e.name} <Text style={{ color: c.mute }}>({e.unit})</Text>
              </Text>
            </View>
          )),
        ])}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
        <View>
          <View style={{ flexDirection: 'row' }}>
            {weeks.map((w) => (
              <View key={w} style={[s.cell, { width: COL_W, borderBottomColor: c.line, backgroundColor: cellBg(w) }]}>
                <Text style={[s.th, { color: w === currentWeek ? c.accent : c.mute }]}>
                  W{w + 1}
                  {isBump(w) ? ' ▲' : ''}
                </Text>
              </View>
            ))}
          </View>
          {LIFT_GROUPS.map((g) => [
            <View key={g} style={[s.cell, { width: COL_W * PLAN_WEEKS, borderBottomColor: c.line, backgroundColor: c.bg }]} />,
            ...LIFTS[g].map((e) => (
              <View key={e.id} style={{ flexDirection: 'row' }}>
                {weeks.map((w) => (
                  <View key={w} style={[s.cell, { width: COL_W, borderBottomColor: c.line, backgroundColor: cellBg(w) }]}>
                    {w === 0 ? (
                      <CommitNumberField
                        value={state.base[e.id]}
                        onCommit={(v) => v != null && onBase(e.id, v)}
                        accessibilityLabel={`${e.name} week 1 weight`}
                        style={{ width: 52, minHeight: 30, paddingVertical: 3, paddingHorizontal: 4, fontSize: 12, textAlign: 'center' }}
                      />
                    ) : (
                      <Text style={{ fontSize: 12, color: cellColor(w), fontWeight: cellWeight(w) }}>
                        {fmt(targetFor(state.base, e.id, w))}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )),
          ])}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  cell: { height: ROW_H, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  left: { alignItems: 'flex-start', paddingHorizontal: 6 },
  th: { fontSize: 11, fontWeight: '700' },
  group: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
