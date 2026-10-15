import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { METERS_PER_MILE, fmt, fmtInt, fmtTime, mondayOf, sgn, type BoardSummary, type SportSummary } from '@/logic';

import { Card, Mute } from '../components';
import { Button, Sheet } from '../food/kit';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';
import { Avatar } from './Avatar';
import { dateText } from './format';

const SPORTS: { id: 'run' | 'bike' | 'swim'; label: string }[] = [
  { id: 'run', label: 'Running' },
  { id: 'bike', label: 'Riding' },
  { id: 'swim', label: 'Swimming' },
];

function Stat({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ width: '33.33%', paddingVertical: space.xs }}>
      <Text style={[st.val, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: c.mute, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Card>
      <Text style={[st.h, { color: c.ink }]}>{title}</Text>
      {children}
    </Card>
  );
}

/** What one person shares, laid out as a profile: cardio, lifting and food. Also used to preview your own. */
export function SharedStats({ s }: { s: BoardSummary | null }) {
  const c = useColors();
  const { today } = useTracker();
  if (!s) return <Mute>Nothing shared yet.</Mute>;
  const thisWeek = s.week === mondayOf(today);
  const thisMonth = s.month === today.slice(0, 7);
  const thisYear = s.year === today.slice(0, 4);
  const dist = (sport: 'run' | 'bike' | 'swim', mi: number) =>
    sport === 'swim' ? `${fmtInt(mi * METERS_PER_MILE)} m` : `${fmt(Math.round(mi * 10) / 10)} mi`;
  const best = (sport: 'run' | 'bike' | 'swim', x: SportSummary) =>
    x.best == null ? '–' : sport === 'bike' ? `${fmt(x.best)} mph` : fmtTime(x.best);
  const bestLabel = { run: 'Best 5K', bike: 'Fastest ride', swim: 'Per 100 m' };
  const sports = SPORTS.filter((x) => s[x.id] && (s[x.id]!.yearMi > 0 || s[x.id]!.longest > 0));
  const cardioShared = !!(s.run || s.bike || s.swim);

  return (
    <View>
      {cardioShared ? (
        sports.length ? (
          sports.map(({ id, label }) => {
            const x = s[id]!;
            return (
              <Block key={id} title={label}>
                <View style={st.grid}>
                  <Stat value={dist(id, thisWeek ? x.weekMi : 0)} label="This week" />
                  <Stat value={dist(id, thisMonth ? x.monthMi : 0)} label="This month" />
                  <Stat value={dist(id, thisYear ? x.yearMi : 0)} label="This year" />
                  <Stat value={String(thisWeek ? x.weekN : 0)} label="Activities this week" />
                  <Stat value={dist(id, x.longest)} label="Longest" />
                  <Stat value={best(id, x)} label={bestLabel[id]} />
                </View>
              </Block>
            );
          })
        ) : (
          <Block title="Cardio">
            <Mute>No runs, rides or swims yet.</Mute>
          </Block>
        )
      ) : (
        <Block title="Cardio">
          <Mute>Not shared</Mute>
        </Block>
      )}

      <Block title="Lifting">
        {s.lifting ? (
          <>
            <View style={st.grid}>
              <Stat value={String(thisWeek ? s.lifting.weekN : 0)} label="This week" />
              <Stat value={String(thisMonth ? s.lifting.monthN : 0)} label="This month" />
              <Stat value={String(s.lifting.total)} label="All time" />
              <Stat value={`${s.lifting.streak} wk`} label="Streak" />
            </View>
            {s.lifting.top.length ? (
              <View style={{ marginTop: space.sm }}>
                <Text style={{ color: c.mute, fontSize: 12.5, fontWeight: '600', marginBottom: 2 }}>Top lifts (estimated max)</Text>
                {s.lifting.top.map((t, i) => (
                  <View key={`${t.name}${i}`} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                    <Text style={{ flex: 1, color: c.ink, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', ...tabular }}>{`${fmtInt(t.e1rm)} ${t.unit === 'plates' ? 'pl' : 'lb'}`}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Mute>Not shared</Mute>
        )}
      </Block>

      <Block title="Food">
        {s.food ? (
          <>
            <View style={st.grid}>
              <Stat value={`${s.food.days}/7`} label="Days logged" />
              <Stat value={s.food.kcal != null ? fmtInt(s.food.kcal) : '–'} label="Avg kcal" />
              <Stat value={s.food.protein != null ? `${fmtInt(s.food.protein)} g` : '–'} label="Avg protein" />
              <Stat value={s.food.deficit != null ? sgn(s.food.deficit) : '–'} label="Avg deficit" />
            </View>
            <Mute style={{ fontSize: 12.5 }}>{thisWeek ? 'Last 7 days' : `Last 7 days, as of the week of ${dateText(s.week)}`}</Mute>
          </>
        ) : (
          <Mute>Not shared</Mute>
        )}
      </Block>
    </View>
  );
}

/** A friend's profile: who they are and what they share. */
export function FriendProfile({ name, summary, onClose, onRemove }: { name: string; summary: BoardSummary | null; onClose: () => void; onRemove?: () => void }) {
  const c = useColors();
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet visible title={name} onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: space.lg }}>
        <Avatar name={name} size={84} />
        <Text style={[st.name, { color: c.ink }]}>{name}</Text>
        <Mute>Friend</Mute>
      </View>
      <SharedStats s={summary} />
      {onRemove ? (
        confirm ? (
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <Text style={{ color: c.ink, fontSize: 15 }}>{`Remove ${name}? You’ll stop seeing each other’s stats.`}</Text>
            <Button label="Remove friend" danger onPress={onRemove} />
            <Button label="Keep" onPress={() => setConfirm(false)} />
          </View>
        ) : (
          <Button label="Remove friend" onPress={() => setConfirm(true)} style={{ marginTop: space.lg }} />
        )
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  h: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  val: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, ...tabular },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, marginTop: space.sm },
});
