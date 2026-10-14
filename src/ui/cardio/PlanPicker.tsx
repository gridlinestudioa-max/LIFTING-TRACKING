import { Text, View } from 'react-native';

import { PLAN_BY_ID, PLAN_FAMILIES, defaultPlanStart, mondayOf, plansFor, type CardioPlan, type PlanFamily } from '@/logic';

import { Mute } from '../components';
import { Select } from '../Select';
import { StartPicker } from '../StartPicker';
import { space, useColors } from '../theme';

/** Choose a cardio plan: the sport, the goal, and the start date. `null` = no plan (just log freely). */
export function PlanPicker({ plan, today, onChange }: { plan: CardioPlan | null; today: string; onChange: (p: CardioPlan | null) => void }) {
  const c = useColors();
  const def = plan ? PLAN_BY_ID[plan.id] : null;
  const family = def?.family ?? null;
  const start = plan?.start ?? defaultPlanStart(today);
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Plan for</Text>
        <Select<PlanFamily | 'none'>
          label="Plan for"
          value={family ?? 'none'}
          options={[{ value: 'none', label: 'No plan', hint: 'Just log what you do.' }, ...PLAN_FAMILIES.map((f) => ({ value: f.id, label: f.label }))]}
          onChange={(f) => {
            if (f === 'none') return onChange(null);
            if (f === family) return;
            // Start with the maintenance plan (or, for triathlon, the shortest race).
            onChange({ id: plansFor(f)[0].id, start });
          }}
        />
      </View>
      {family && def ? (
        <>
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Goal</Text>
            <Select
              label="Goal"
              value={def.id}
              options={plansFor(family).map((p) => ({ value: p.id, label: p.weeks == null ? 'Maintenance' : p.name, hint: p.blurb }))}
              onChange={(id) => onChange({ id, start })}
            />
            <Mute style={{ fontSize: 13 }}>{def.blurb}</Mute>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Starts (a Monday)</Text>
            <StartPicker plan={{ id: def.id, start }} onChange={(s) => onChange({ id: def.id, start: mondayOf(s) })} />
          </View>
        </>
      ) : null}
    </View>
  );
}
