import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toD } from '@/logic';
import { CalendarGrid } from '@/ui/CalendarGrid';
import { Card, Header } from '@/ui/components';
import { DayDetail } from '@/ui/DayDetail';
import { useTracker } from '@/ui/store';
import { useColors } from '@/ui/theme';

export default function CalendarScreen() {
  const c = useColors();
  const { state, today, selected, select } = useTracker();
  const [view, setView] = useState(() => {
    const d = toD(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const scroll = useRef<ScrollView>(null);
  const detailY = useRef(0);

  const shift = (n: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <Header />
        <Card style={{ paddingHorizontal: 8 }}>
          <CalendarGrid
            state={state}
            today={today}
            selected={selected}
            year={view.y}
            month={view.m}
            onSelect={(s) => {
              select(s);
              // Bring the day detail into view below the grid.
              scroll.current?.scrollTo({ y: Math.max(detailY.current - 220, 0), animated: true });
            }}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
          />
        </Card>
        <View onLayout={(e) => (detailY.current = e.nativeEvent.layout.y)}>
          <Card>
            <DayDetail />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
