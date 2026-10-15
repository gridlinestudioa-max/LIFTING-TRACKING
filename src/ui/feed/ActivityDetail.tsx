import { StyleSheet, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  baseInputs,
  distText,
  e1rm,
  feedDay,
  fmt,
  fmtInt,
  fmtTime,
  muscleLoad,
  paceText,
  repsDone,
  sessionBurn,
  setsDone,
  shortDayLabel,
  volume,
  workoutBurn,
  type CardioSession,
  type FeedItem,
  type Workout,
} from '@/logic';

import { RouteMap } from '../cardio/RouteMap';
import { Card, Mute } from '../components';
import { LinkButton, Sheet } from '../food/kit';
import { MuscleMap } from '../lifting/MuscleMap';
import { useLibrary } from '../lifting/library';
import { MedalBadge, MedalList } from '../Medal';
import { Avatar } from '../social/Avatar';
import { useTracker } from '../store';
import { fonts, space, tabular, useColors } from '../theme';

/** Everything about one activity from the feed, read-only. Edit opens the usual edit screen. */
export function ActivityDetail({ item, onClose, onEdit }: { item: FeedItem; onClose: () => void; onEdit: () => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const name = state.settings.name.trim() || 'You';
  const city = state.settings.city.trim();
  return (
    <Sheet visible title={item.title} onClose={onClose}>
      <View style={st.who}>
        <Avatar name={name} uri={state.settings.photo} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: c.mute, fontSize: 13 }}>{[feedDay(item.date, today, shortDayLabel), city || null].filter(Boolean).join(' · ')}</Text>
        </View>
        <LinkButton label="Edit" onPress={onEdit} />
      </View>
      <View style={st.titleRow}>
        <Text style={[st.title, { color: c.ink, flexShrink: 1 }]}>{item.title}</Text>
        <MedalBadge medals={item.medals} />
      </View>
      {item.note ? <Text style={{ color: c.ink, fontSize: 16, lineHeight: 22, marginTop: space.xs }}>{item.note}</Text> : null}

      <MedalList medals={item.medals} max={20} />

      {item.kind === 'cardio' ? <CardioDetail x={item.session} /> : <LiftDetail w={item.workout} />}
    </Sheet>
  );
}

function Grid({ items }: { items: { label: string; value: string }[] }) {
  const c = useColors();
  return (
    <View style={st.grid}>
      {items.map((s) => (
        <View key={s.label} style={st.cell}>
          <Text style={{ color: c.mute, fontSize: 12.5 }}>{s.label}</Text>
          <Text style={[st.val, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CardioDetail({ x }: { x: CardioSession }) {
  const c = useColors();
  const { state, today } = useTracker();
  const foot = x.type === 'run' || x.type === 'walk' || x.type === 'hike';
  const b = baseInputs(state.profile, today);
  const kcal = x.kcal ?? (b ? sessionBurn(x, b) : null);
  const stats = [
    { label: 'Sport', value: CARDIO_LABEL[x.type] },
    x.miles ? { label: 'Distance', value: distText(x.type, x.miles) } : null,
    x.secs ? { label: 'Moving time', value: fmtTime(x.secs) } : null,
    foot && x.miles && x.secs ? { label: 'Avg pace', value: paceText(x.miles, x.secs) } : null,
    x.type === 'bike' && x.miles && x.secs ? { label: 'Avg speed', value: `${fmt(Math.round((x.miles / (x.secs / 3600)) * 10) / 10)} mph` } : null,
    x.type === 'swim' && x.miles && x.secs ? { label: 'Per 100 m', value: fmtTime(Math.round((x.secs / (x.miles * 1609.344)) * 100)) } : null,
    x.elevFt ? { label: 'Climb', value: `${fmtInt(x.elevFt)} ft` } : null,
    x.hr ? { label: 'Avg heart rate', value: `${x.hr} bpm` } : null,
    x.maxHr ? { label: 'Max heart rate', value: `${x.maxHr} bpm` } : null,
    kcal ? { label: x.kcal ? 'Calories' : 'Calories (est.)', value: `${fmtInt(kcal)} kcal` } : null,
    x.rpe ? { label: 'How hard it felt', value: `${x.rpe}/10` } : null,
  ].filter((s): s is { label: string; value: string } => !!s);
  const splits = x.splits ?? [];
  const fastest = splits.length ? Math.min(...splits) : 0;
  const slowest = splits.length ? Math.max(...splits) : 0;
  return (
    <>
      <Card style={{ marginTop: space.lg }}>
        <Grid items={stats} />
      </Card>
      {x.route ? <RouteMap route={x.route} height={260} style={{ marginBottom: space.lg }} /> : null}
      {splits.length ? (
        <Card>
          <Text style={[st.h, { color: c.ink }]}>Splits</Text>
          {splits.map((sec, i) => (
            <View key={i} style={st.split}>
              <Text style={{ width: 34, color: c.mute, fontSize: 14, ...tabular }}>{i + 1}</Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.soft, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(12, (fastest / sec) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: sec === fastest ? c.ok : c.ink, opacity: sec === slowest && splits.length > 1 ? 0.5 : 1 }} />
              </View>
              <Text style={{ width: 64, textAlign: 'right', color: c.ink, fontSize: 14, fontWeight: '700', ...tabular }}>{fmtTime(sec)}</Text>
            </View>
          ))}
          <Mute style={{ fontSize: 12.5, marginTop: space.xs }}>Time for each full mile. Green is your fastest.</Mute>
        </Card>
      ) : null}
    </>
  );
}

function LiftDetail({ w }: { w: Workout }) {
  const c = useColors();
  const { state, today } = useTracker();
  const { byId } = useLibrary();
  const mins = w.start && w.end && w.end > w.start ? Math.round((w.end - w.start) / 60000) : null;
  const v = volume(w);
  const b = baseInputs(state.profile, today);
  const kcal = b ? workoutBurn(w, b.weightLb) : null;
  const load = muscleLoad(w, byId);
  const stats = [
    mins ? { label: 'Time', value: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m` } : null,
    { label: 'Exercises', value: String(w.exercises.filter((e) => e.sets.some((s) => s.done)).length) },
    { label: 'Sets', value: String(setsDone(w)) },
    { label: 'Reps', value: fmtInt(repsDone(w)) },
    v ? { label: 'Volume', value: `${fmtInt(Math.round(v))} lb` } : null,
    kcal ? { label: 'Calories (est.)', value: `${fmtInt(kcal)} kcal` } : null,
  ].filter((s): s is { label: string; value: string } => !!s);
  return (
    <>
      <Card style={{ marginTop: space.lg }}>
        <Grid items={stats} />
      </Card>
      {Object.keys(load).length ? (
        <Card>
          <Text style={[st.h, { color: c.ink }]}>Muscles worked</Text>
          <MuscleMap load={load} />
        </Card>
      ) : null}
      {w.exercises.map((e, i) => {
        const done = e.sets.filter((s) => s.done);
        const u = e.unit === 'plates' ? 'pl' : e.unit === 'lb' ? 'lb' : '';
        const best = done.reduce<{ w: number; reps: number; est: number } | null>((m, s) => {
          if (!s.w || !s.reps || s.reps > 12) return m;
          const est = e1rm(s.w, s.reps);
          return !m || est > m.est ? { w: s.w, reps: s.reps, est } : m;
        }, null);
        return (
          <Card key={`${e.exId}${i}`}>
            <Text style={[st.h, { color: c.ink }]}>{e.name}</Text>
            {e.sets.map((s, j) => (
              <View key={j} style={[st.set, j > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <Text style={{ width: 52, color: c.mute, fontSize: 14 }}>{`Set ${j + 1}`}</Text>
                <Text style={{ flex: 1, color: s.done ? c.ink : c.mute, fontSize: 15, fontWeight: '600', ...tabular }}>
                  {s.w != null ? `${fmt(s.w)} ${u}` : 'Bodyweight'}
                  {s.reps != null ? ` × ${s.reps}` : ''}
                </Text>
                <Text style={{ color: s.done ? c.ok : c.mute, fontSize: 13, fontWeight: '700' }}>{s.done ? 'Done' : 'Skipped'}</Text>
              </View>
            ))}
            {best && u ? <Mute style={{ fontSize: 13, marginTop: space.xs }}>{`Best set ${fmt(best.w)} × ${best.reps} · estimated max ${fmtInt(best.est)} ${u}`}</Mute> : null}
          </Card>
        );
      })}
    </>
  );
}

const st = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '50%', paddingRight: space.sm },
  val: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, ...tabular },
  h: { fontFamily: fonts.semi, fontSize: 20, lineHeight: 24, marginBottom: space.xs },
  split: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 },
  set: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
