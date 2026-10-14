import { Text, View } from 'react-native';

import { DAY_COUNTS, DAY_NAMES, SPLITS, liftingPlan, type DayCount, type SplitId } from '@/logic';

import { Mute } from '../components';
import { Select } from '../Select';
import { space, useColors } from '../theme';

export interface LiftChoice {
  split: SplitId;
  days: DayCount;
}

/** Choose a split and how many days a week, and see the week it makes. */
export function LiftPlanPicker({ value, onChange }: { value: LiftChoice; onChange: (v: LiftChoice) => void }) {
  const c = useColors();
  const t = liftingPlan(value.split, value.days);
  const split = SPLITS.find((s) => s.id === value.split)!;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Split</Text>
        <Select
          label="Split"
          value={value.split}
          options={SPLITS.map((s) => ({ value: s.id, label: s.name, hint: s.blurb }))}
          onChange={(split) => onChange({ ...value, split })}
        />
        <Mute style={{ fontSize: 13 }}>{split.blurb}</Mute>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Days a week</Text>
        <Select
          label="Days a week"
          value={value.days}
          options={DAY_COUNTS.map((d) => ({ value: d, label: `${d} days`, hint: liftingPlan(value.split, d).schedule.map((x, i) => (x ? DAY_NAMES[i] : null)).filter(Boolean).join(', ') }))}
          onChange={(days) => onChange({ ...value, days })}
        />
      </View>
      <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.card }}>
        {t.schedule.map((id, i) => {
          const r = id ? t.routines.find((x) => x.id === id)! : null;
          return (
            <View key={i} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 9, paddingHorizontal: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text style={{ width: 36, color: c.mute, fontWeight: '700' }}>{DAY_NAMES[i]}</Text>
              <Text style={{ flex: 1, color: r ? c.ink : c.mute, fontWeight: r ? '600' : '400' }}>{r ? r.name : 'Rest'}</Text>
              {r && r.items.length ? <Text style={{ color: c.mute, fontSize: 13 }}>{r.items.length} exercises</Text> : null}
            </View>
          );
        })}
      </View>
      <Mute style={{ fontSize: 13 }}>
        {value.split === 'custom'
          ? 'You’ll add exercises to each day on the Lifting tab. You can rename the days too.'
          : 'You can change exercises, sets and rep ranges any time. When you hit the top of the rep range on every set, the weight goes up.'}
      </Mute>
    </View>
  );
}
