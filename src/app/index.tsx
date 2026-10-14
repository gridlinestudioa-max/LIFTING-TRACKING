import { Redirect } from 'expo-router';

import { useTracker } from '@/ui/store';

/** Opens the first section that's turned on. */
export default function Home() {
  const { state } = useTracker();
  const on = state.settings.sections;
  return <Redirect href={on.lifting ? '/lifting' : on.cardio ? '/cardio' : on.food ? '/food' : '/progress'} />;
}
