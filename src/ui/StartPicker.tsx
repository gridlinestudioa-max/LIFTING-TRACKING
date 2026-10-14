import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { planEnd, raceDay, shortDayLabel, toD, toS, type CardioPlan } from '@/logic';

import { Mute } from './components';
import { useColors, useIsDark } from './theme';

/** Plan start date. Any chosen date snaps back to that week's Monday (done by the caller). */
export function StartPicker({ plan, onChange }: { plan: CardioPlan; onChange: (s: string) => void }) {
  const start = plan.start;
  const race = raceDay(plan);
  const end = planEnd(plan);
  const c = useColors();
  const isDark = useIsDark();

  let picker: React.ReactNode;
  if (Platform.OS === 'ios') {
    picker = (
      <DateTimePicker
        value={toD(start)}
        mode="date"
        display="compact"
        accentColor={c.accent}
        onChange={(_, d) => d && onChange(toS(d))}
      />
    );
  } else if (Platform.OS === 'android') {
    picker = (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          DateTimePickerAndroid.open({
            value: toD(start),
            mode: 'date',
            onChange: (e, d) => e.type === 'set' && d && onChange(toS(d)),
          })
        }
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}>
        <Text style={{ color: c.ink, fontSize: 15 }}>{start}</Text>
      </Pressable>
    );
  } else {
    // Web: the browser's native date input (opens the phone's date wheel).
    picker = createElement('input', {
      type: 'date',
      value: start,
      'aria-label': 'Plan start date',
      onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
      style: {
        font: 'inherit', fontSize: 16, color: c.ink, backgroundColor: c.card, border: `1.5px solid ${c.line}`,
        borderRadius: 10, padding: '9px 10px', colorScheme: isDark ? 'dark' : 'light',
      },
    });
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      {picker}
      <Mute>{race ? `Race day: ${shortDayLabel(race)}` : end ? `Ends ${shortDayLabel(end)}` : 'No end date: repeats every week'}</Mute>
    </View>
  );
}
