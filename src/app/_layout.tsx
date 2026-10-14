import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { TrackerProvider } from '@/ui/store';
import { useColors, useIsDark } from '@/ui/theme';

// Keep the splash screen up until the display font is ready, so headings never flash in a fallback font.
SplashScreen.preventAutoHideAsync();

function CalendarIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={focused ? 2.5 : 1.75}>
      <Rect x={3} y={5} width={18} height={16} rx={3} />
      <Path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </Svg>
  );
}

function ChartIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={focused ? 2.5 : 1.75} strokeLinecap="round">
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
          tabBarActiveTintColor: c.ink,
          tabBarInactiveTintColor: c.mute,
          tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
          sceneStyle: { backgroundColor: c.bg },
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Calendar', tabBarIcon: ({ color, focused }) => <CalendarIcon color={String(color)} focused={focused} /> }}
        />
        <Tabs.Screen
          name="progress"
          options={{ title: 'Progress', tabBarIcon: ({ color, focused }) => <ChartIcon color={String(color)} focused={focused} /> }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // If the font fails to load, carry on with the system font rather than blocking the app.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <TrackerProvider>
        <AppTabs />
      </TrackerProvider>
    </SafeAreaProvider>
  );
}
