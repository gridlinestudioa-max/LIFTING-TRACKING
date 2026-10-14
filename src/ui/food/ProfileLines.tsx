import { Text } from 'react-native';

import { ACTIVITY, GOALS, profileSummary, type Profile } from '@/logic';

import { Mute } from '../components';
import { useColors } from '../theme';

/** Saved body stats in two lines, showing only what's filled in. */
export function ProfileLines({ profile }: { profile: Profile }) {
  const c = useColors();
  const main = profileSummary(profile);
  const more = [
    profile.activity ? `${ACTIVITY.find((a) => a.id === profile.activity)!.label} activity` : null,
    profile.goal ? GOALS.find((g) => g.id === profile.goal)!.label : null,
  ].filter(Boolean);
  return (
    <>
      <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{main || 'No stats added yet'}</Text>
      {more.length ? <Mute>{more.join(' · ')}</Mute> : null}
    </>
  );
}
