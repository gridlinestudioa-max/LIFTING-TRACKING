import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { raceDay, shortDayLabel, toD, toS } from '@/logic';

import { Field, Mute } from './components';
import { useColors } from './theme';

/** Plan start date. Any chosen date snaps back to that week's Monday (done in the store). */
export function StartPicker({ start, onChange }: { start: string; onChange: (s: string) => void }) {
  const c = useColors();
  const [text, setText] = useState(start);
  const [prev, setPrev] = useState(start);
  if (prev !== start) {
    setPrev(start);
    setText(start);
  }

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
    picker = (
      <Field
        value={text}
        onChangeText={setText}
        placeholder="YYYY-MM-DD"
        style={{ width: 130 }}
        onEndEditing={() => (/^\d{4}-\d{2}-\d{2}$/.test(text) ? onChange(text) : setText(start))}
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      {picker}
      <Mute>Race day: {shortDayLabel(raceDay(start))}</Mute>
    </View>
  );
}
