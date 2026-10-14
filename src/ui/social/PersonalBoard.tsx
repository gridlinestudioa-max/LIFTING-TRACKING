import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BOARD_SPORTS, personalBoard, type BoardSport } from '@/logic';

import { Mute, Section } from '../components';
import { Pill } from '../food/kit';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';
import { dateText, recordText } from './format';

/** Gold, silver, bronze. */
export const MEDAL = ['#d4a017', '#9aa4ad', '#b8733a'];

/** Rank badge: a colored disc for the top 3, a plain number after. */
export function Rank({ n }: { n: number }) {
  const c = useColors();
  const medal = MEDAL[n - 1];
  return (
    <View style={[st.rank, medal ? { backgroundColor: medal } : { borderWidth: 1.5, borderColor: c.line }]}>
      <Text style={{ color: medal ? '#ffffff' : c.mute, fontSize: 13, fontWeight: '800', ...tabular }}>{n}</Text>
    </View>
  );
}

export function SportPills({ value, onChange }: { value: BoardSport; onChange: (s: BoardSport) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      {BOARD_SPORTS.map((s) => (
        <Pill key={s.id} label={s.label} selected={value === s.id} onPress={() => onChange(s.id)} />
      ))}
    </View>
  );
}

/** Your own leaderboard: top 5 efforts in each category, best first. Tap a category to see all five. */
export function PersonalBoard() {
  const c = useColors();
  const { state, today } = useTracker();
  const [sport, setSport] = useState<BoardSport>('run');
  const [open, setOpen] = useState<string | null>(null);
  const boards = personalBoard(state.cardio, sport, today);

  return (
    <Section title="Personal records">
      <SportPills value={sport} onChange={(s) => { setSport(s); setOpen(null); }} />
      {!boards.length ? (
        <Mute style={{ marginTop: space.md }}>{`Log or record a ${sport === 'run' ? 'run' : sport === 'bike' ? 'ride' : 'swim'} to start your records.`}</Mute>
      ) : (
        <View style={{ marginTop: space.md }}>
          {boards.map((b, i) => {
            const isOpen = open === b.id;
            const best = b.top[0];
            return (
              <View key={b.id} style={[i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Pressable
                  onPress={() => setOpen(isOpen ? null : b.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${b.label}: ${recordText(b.kind, best.value, sport)}, ${dateText(best.date)}. ${isOpen ? 'Hide' : 'Show'} top ${b.top.length}`}
                  style={({ pressed }) => [st.row, { opacity: pressed ? 0.6 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{b.label}</Text>
                    <Text style={{ color: c.mute, fontSize: 13 }}>{dateText(best.date)}</Text>
                  </View>
                  <Text style={[st.value, { color: c.ink }]}>{recordText(b.kind, best.value, sport)}</Text>
                  <Text style={{ color: c.mute, fontSize: 18, width: 16, textAlign: 'right' }}>{isOpen ? '−' : '+'}</Text>
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingBottom: space.md, gap: 6 }}>
                    {b.top.map((e, k) => (
                      <View key={e.sessionId} style={st.entry}>
                        <Rank n={k + 1} />
                        <Text style={{ flex: 1, color: c.mute, fontSize: 14 }}>{dateText(e.date)}</Text>
                        <Text style={{ color: c.ink, fontSize: 15, fontWeight: k === 0 ? '800' : '600', ...tabular }}>{recordText(b.kind, e.value, sport)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Section>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  value: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
