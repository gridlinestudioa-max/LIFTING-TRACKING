import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { TrackerProvider } from '@/ui/store';
import { useColors, useIsDark } from '@/ui/theme';

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </Svg>
  );
}

function ChartIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}

function AppTabs() {
  const c = useColors();
  const dark = useIsDark();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.mute,
          tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          sceneStyle: { backgroundColor: c.bg },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Calendar', tabBarIcon: ({ color }) => <CalendarIcon color={String(color)} /> }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <ChartIcon color={String(color)} /> }} />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TrackerProvider>
        <AppTabs />
      </TrackerProvider>
    </SafeAreaProvider>
  );
}
