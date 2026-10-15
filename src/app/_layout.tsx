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

import { AccountProvider, useAccount } from '@/ui/account';
import { remoteStore } from '@/ui/cloud';
import { Onboarding } from '@/ui/Onboarding';
import { SignIn } from '@/ui/SignIn';
import { TabBar } from '@/ui/TabBar';
import { RecordingProvider } from '@/ui/cardio/RecordingProvider';
import { SocialProvider } from '@/ui/social/SocialProvider';
import '@/ui/cardio/bgLocation';
import { TrackerProvider, useTracker } from '@/ui/store';
import { NewPassword, Welcome } from '@/ui/Welcome';
import { useColors, useIsDark } from '@/ui/theme';

// Keep the splash screen up until the display font is ready, so headings never flash in a fallback font.
SplashScreen.preventAutoHideAsync();

function AppTabs() {
  const c = useColors();
  const { state } = useTracker();
  const on = state.settings.sections;
  return (
    <Tabs
      tabBar={(props) => <TabBar state={props.state} navigation={props.navigation} sections={on} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="food" options={{ title: 'Food' }} />
      <Tabs.Screen name="cardio" options={{ title: 'Cardio' }} />
      <Tabs.Screen name="lifting" options={{ title: 'Lifting' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="you" options={{ title: 'Profile' }} />
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
