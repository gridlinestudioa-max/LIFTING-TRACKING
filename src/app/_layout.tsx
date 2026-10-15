import {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AccountProvider, useAccount } from '@/ui/account';
import { remoteStore } from '@/ui/cloud';
import { Onboarding } from '@/ui/Onboarding';
import { SignIn } from '@/ui/SignIn';
import { RecordingProvider } from '@/ui/cardio/RecordingProvider';
import { SocialProvider } from '@/ui/social/SocialProvider';
import '@/ui/cardio/bgLocation';
import { TrackerProvider, useTracker } from '@/ui/store';
import { NewPassword, Welcome } from '@/ui/Welcome';
import { useColors, useIsDark } from '@/ui/theme';

// Keep the splash screen up until the display font is ready, so headings never flash in a fallback font.
SplashScreen.preventAutoHideAsync();

type IconProps = { color: string; focused: boolean };

const icon = (d: string, extra?: (p: IconProps) => React.ReactNode) =>
  function Icon(p: IconProps) {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth={p.focused ? 2.5 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <Path d={d} />
        {extra?.(p)}
      </Svg>
    );
  };

const FoodIcon = icon('M5 3v6a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-3.5 2.6-3.5 6.5S15 14 17 14');
// A runner's shoe: sole and laces.
const CardioIcon = icon('M3 17h16a2 2 0 0 0 0-4l-5-1-3-5H7L5 13H3zM3 20h18M10 9l1.5 2M12.5 8.5 14 10.5');
// A dumbbell.
const LiftIcon = icon('M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12');
const HomeIcon = icon('M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5');
const ChartIcon = icon('M4 20V10M10 20V4M16 20v-7M22 20H2');
const YouIcon = icon('M4 21c.8-4 4-6 8-6s7.2 2 8 6', (p) => <Circle cx={12} cy={8} r={4} stroke={p.color} />);

function AppTabs() {
  const c = useColors();
  const { state } = useTracker();
  const on = state.settings.sections;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.mute,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: (p) => <HomeIcon color={String(p.color)} focused={p.focused} /> }} />
      <Tabs.Screen name="food" options={{ href: on.food ? undefined : null, title: 'Food', tabBarIcon: (p) => <FoodIcon color={String(p.color)} focused={p.focused} /> }} />
      <Tabs.Screen name="cardio" options={{ href: on.cardio ? undefined : null, title: 'Cardio', tabBarIcon: (p) => <CardioIcon color={String(p.color)} focused={p.focused} /> }} />
      <Tabs.Screen name="lifting" options={{ href: on.lifting ? undefined : null, title: 'Lifting', tabBarIcon: (p) => <LiftIcon color={String(p.color)} focused={p.focused} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: (p) => <ChartIcon color={String(p.color)} focused={p.focused} /> }} />
      <Tabs.Screen name="you" options={{ title: 'Profile', tabBarIcon: (p) => <YouIcon color={String(p.color)} focused={p.focused} /> }} />
    </Tabs>
  );
}

/** Signed in (or on this device only): load that person's data, set up if needed, then the tabs. */
function Signed() {
  const { state, loaded } = useTracker();
  const { arrival } = useAccount();
  const c = useColors();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  // Opened from an email link: say so first (or set a new password), instead of dropping into the app.
  if (arrival === 'recovery') return <NewPassword />;
  if (arrival === 'confirmed') return <Welcome setUp={state.settings.onboarded} />;
  if (!state.settings.onboarded) return <Onboarding />;
  return (
    <SocialProvider>
      <RecordingProvider>
        <AppTabs />
      </RecordingProvider>
    </SocialProvider>
  );
}

function Gate() {
  const { mode, user } = useAccount();
  const c = useColors();
  const remote = useMemo(() => (mode === 'account' && user ? remoteStore(user.id) : null), [mode, user]);
  if (mode === 'loading') return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (mode === 'signedOut') return <SignIn />;
  const key = mode === 'account' && user ? user.id : 'local';
  return (
    // A different person gets a fresh store.
    <TrackerProvider key={key} user={key} remote={remote}>
      <Signed />
    </TrackerProvider>
  );
}

export default function RootLayout() {
  const dark = useIsDark();
  const [loaded, error] = useFonts({ BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // If the font fails to load, carry on with the system font rather than blocking the app.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AccountProvider>
        <Gate />
      </AccountProvider>
    </SafeAreaProvider>
  );
}
