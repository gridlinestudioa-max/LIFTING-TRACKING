import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { fmt, liftSummary, mondayOf, weeklyTotals } from '@/logic';
import { useAccount } from '@/ui/account';
import { Header, Mute } from '@/ui/components';
import { EditProfileSheet } from '@/ui/profile/EditProfileSheet';
import { SettingsSheet } from '@/ui/profile/SettingsSheet';
import { Avatar } from '@/ui/social/Avatar';
import { FriendsArea } from '@/ui/social/FriendsBoard';
import { PersonalBoard } from '@/ui/social/PersonalBoard';
import { useSocial } from '@/ui/social/SocialProvider';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

/** A gear: opens Settings. */
function GearButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} style={({ pressed }) => [st.gear, { backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={3} />
        <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </Svg>
    </Pressable>
  );
}

function WeekStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[st.statVal, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** You: your profile (who you are, your week, your records, your friends). Settings live behind the gear. */
export default function YouScreen() {
  const c = useColors();
  const { mode } = useAccount();
  const { state, today } = useTracker();
  const social = useSocial();
  const [settings, setSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const city = state.settings.city.trim();
  const username = social.status === 'on' ? social.profile?.username : null;
  const on = state.settings.sections;
  const name = state.settings.name.trim();
  const friends = social.friends?.filter((f) => f.status === 'friends').length ?? 0;

  const lift = on.lifting ? liftSummary(state.lifting, today) : null;
  const week = on.cardio ? weeklyTotals(state.cardio, today, 1)[0] : null;
  const monday = mondayOf(today);
  const cardioN = on.cardio ? state.cardio.sessions.filter((x) => x.date >= monday && x.date <= today).length : 0;
  const foodDays = on.food ? Object.entries(state.meals).filter(([d, l]) => d >= monday && d <= today && l.length).length : 0;
  const stats = [
    lift ? { value: String(lift.thisWeek), label: 'Workouts' } : null,
    week ? { value: fmt(Math.round(week.miles * 10) / 10), unit: 'mi', label: 'Cardio' } : null,
    on.cardio && !on.lifting ? { value: String(cardioN), label: 'Activities' } : null,
    on.food ? { value: `${foodDays}`, unit: '/7', label: 'Days logged' } : null,
    lift ? { value: String(lift.streak), unit: 'wk', label: 'Streak' } : null,
  ].filter((x): x is { value: string; unit?: string; label: string } => !!x).slice(0, 4);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Header title="Profile" right={<GearButton onPress={() => setSettings(true)} />} />

        <View style={[st.hero, { backgroundColor: c.card }]}>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Change your profile picture">
            <Avatar name={name || 'You'} uri={state.settings.photo} size={96} />
          </Pressable>
          <Text style={[st.name, { color: c.ink }]}>{name || 'Your name'}</Text>
          {username || city ? (
            <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{[username ? `@${username}` : null, city || null].filter(Boolean).join(' · ')}</Text>
          ) : null}
          <Text style={{ color: c.mute, fontSize: 14 }}>
            {social.status === 'on' ? `${friends} friend${friends === 1 ? '' : 's'}` : mode === 'account' ? 'Signed in' : 'On this device'}
          </Text>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={({ pressed }) => [st.edit, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
            <Text style={{ color: c.ink, fontSize: 14, fontWeight: '700' }}>{name ? 'Edit profile' : 'Add your name, picture and city'}</Text>
          </Pressable>
          {stats.length ? (
            <>
              <View style={[st.divider, { backgroundColor: c.line }]} />
              <Text style={{ color: c.mute, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: space.sm }}>THIS WEEK</Text>
              <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
                {stats.map((x) => (
                  <WeekStat key={x.label} {...x} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        <FriendsArea />
        {on.cardio || on.lifting ? <PersonalBoard /> : null}

        {mode !== 'account' ? <Mute style={{ textAlign: 'center', marginTop: space.sm }}>Settings, your data and sign-in are behind the gear.</Mute> : null}
      </ScrollView>
      {settings ? <SettingsSheet onClose={() => setSettings(false)} /> : null}
      {editing ? <EditProfileSheet onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, marginTop: space.sm },
  edit: { borderWidth: 1, borderRadius: 18, paddingHorizontal: space.lg, paddingVertical: 8, marginTop: space.md },
  divider: { alignSelf: 'stretch', height: 1, marginVertical: space.md },
  statVal: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, ...tabular },
});
