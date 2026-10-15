import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BOARD_SPORTS, fmt, fmtInt, liftBoards, personalBoard, type BoardSport } from '@/logic';

import { Mute, Section } from '../components';
import { Pill } from '../food/kit';
import { Rank } from '../Medal';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';
import { dateText, recordText } from './format';

export function SportPills({ value, onChange }: { value: BoardSport; onChange: (s: BoardSport) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      {BOARD_SPORTS.map((s) => (
        <Pill key={s.id} label={s.label} selected={value === s.id} onPress={() => onChange(s.id)} />
      ))}
    </View>
  );
}

type Board = BoardSport | 'lift';

/**
 * Your own leaderboard: top 5 efforts in each category, best first, for running, riding, swimming and
 * each lift. Tap a category to see all five.
 */
export function PersonalBoard() {
  const c = useColors();
  const { state, today } = useTracker();
  const on = state.settings.sections;
  const choices: { value: Board; label: string }[] = [
    ...(on.cardio ? BOARD_SPORTS.map((s) => ({ value: s.id as Board, label: s.label })) : []),
    ...(on.lifting ? [{ value: 'lift' as Board, label: 'Lifting' }] : []),
  ];
  const [pick, setPick] = useState<Board | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const board = pick && choices.some((x) => x.value === pick) ? pick : (choices[0]?.value ?? null);
  if (!board) return null;

  const rows: Row[] =
    board === 'lift'
      ? liftBoards(state.lifting, today).map((b) => {
          const u = b.unit === 'plates' ? 'pl' : 'lb';
          return {
            id: b.exId,
            label: b.name,
            top: b.top.slice(0, 5).map((e) => ({ key: e.workoutId, date: e.date, value: `${fmtInt(Math.round(e.e1rm))} ${u}`, sub: `${fmt(e.w)} × ${e.reps}` })),
          };
        })
      : personalBoard(state.cardio, board, today).map((b) => ({
          id: b.id,
          label: b.label,
          top: b.top.map((e) => ({ key: e.sessionId, date: e.date, value: recordText(b.kind, e.value, board) })),
        }));

  return (
    <Section title="Personal records">
      <Select label="Records for" value={board} options={choices} onChange={(v) => { setPick(v); setOpen(null); }} />
      {!rows.length ? (
        <Mute style={{ marginTop: space.md }}>
          {board === 'lift' ? 'Finish a workout with weights to start your records.' : `Log or record a ${board === 'run' ? 'run' : board === 'bike' ? 'ride' : 'swim'} to start your records.`}
        </Mute>
      ) : (
        <View style={{ marginTop: space.sm }}>
          {board === 'lift' ? <Mute style={{ fontSize: 12.5, marginBottom: space.xs }}>Estimated one-rep max from your best set each workout.</Mute> : null}
          {rows.map((b, i) => {
            const isOpen = open === b.id;
            const best = b.top[0];
            return (
              <View key={b.id} style={[i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Pressable
                  onPress={() => setOpen(isOpen ? null : b.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${b.label}: ${best.value}, ${dateText(best.date)}. ${isOpen ? 'Hide' : 'Show'} top ${b.top.length}`}
                  style={({ pressed }) => [st.row, { opacity: pressed ? 0.6 : 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{b.label}</Text>
                    <Text style={{ color: c.mute, fontSize: 13 }}>{best.sub ? `${best.sub} · ${dateText(best.date)}` : dateText(best.date)}</Text>
                  </View>
                  <Text style={[st.value, { color: c.ink }]}>{best.value}</Text>
                  <Text style={{ color: c.mute, fontSize: 18, width: 16, textAlign: 'right' }}>{isOpen ? '−' : '+'}</Text>
                </Pressable>
                {isOpen ? (
                  <View style={{ paddingBottom: space.md, gap: 6 }}>
                    {b.top.map((e, k) => (
                      <View key={e.key} style={st.entry}>
                        <Rank n={k + 1} />
                        <Text style={{ flex: 1, color: c.mute, fontSize: 14 }}>{e.sub ? `${dateText(e.date)} · ${e.sub}` : dateText(e.date)}</Text>
                        <Text style={{ color: c.ink, fontSize: 15, fontWeight: k === 0 ? '800' : '600', ...tabular }}>{e.value}</Text>
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

interface Row {
  id: string;
  label: string;
  top: { key: string; date: string; value: string; sub?: string }[];
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  value: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
