import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { raceDay, shortDayLabel, toD, toS } from '@/logic';

import { Mute } from './components';
import { useColors, useIsDark } from './theme';

/** Plan start date. Any chosen date snaps back to that week's Monday (done in the store). */
export function StartPicker({ start, onChange }: { start: string; onChange: (s: string) => void }) {
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
        style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }}>
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
        font: 'inherit', fontSize: 16, color: c.ink, backgroundColor: c.bg, border: `1px solid ${c.line}`,
        borderRadius: 8, padding: '7px 8px', colorScheme: isDark ? 'dark' : 'light',
      },
    });
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      {picker}
      <Mute>Race day: {shortDayLabel(raceDay(start))}</Mute>
    </View>
  );
}
