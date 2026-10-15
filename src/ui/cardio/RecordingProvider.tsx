import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CARDIO_LABEL, fmtTime, movingAt } from '@/logic';

import { space, tabular } from '../theme';
import { Recorder, useRecording } from './Recorder';
import { ROUTE } from './RouteMap';

const Ctx = createContext<{ open: () => void } | null>(null);

/** Wall clock, read by timers and as a starting value (not while rendering). */
const clockNow = () => Date.now();

/**
 * The recorder lives above the tabs, so a recording carries on while you use the rest of the app. While
 * it's hidden, a bar at the top shows it's running and opens it again. A recording found on start (the
 * app was closed mid-run) opens straight away.
 */
export function RecordingProvider({ children }: { children: ReactNode }) {
  const sess = useRecording();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  if (sess !== undefined && !checked) {
    setChecked(true);
    if (sess) setOpen(true);
  }
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {sess && !open ? <Banner onPress={() => setOpen(true)} /> : null}
      </View>
      {open ? <Recorder onClose={() => setOpen(false)} /> : null}
    </Ctx.Provider>
  );
}

function Banner({ onPress }: { onPress: () => void }) {
  const sess = useRecording();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    const t = setInterval(() => setNow(clockNow()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!sess) return null;
  const what = sess.phase === 'review' ? 'Finished, not saved' : sess.phase === 'paused' ? 'Paused' : `Recording ${CARDIO_LABEL[sess.type].toLowerCase()}`;
  const secs = Math.round(movingAt(sess, now || sess.since || sess.startedAt));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${what}, ${fmtTime(secs)}. Open`} style={[st.banner, { top: insets.top + 6 }]}>
      <View style={[st.dot, { opacity: sess.phase === 'recording' ? 1 : 0.4 }]} />
      <Text style={st.text}>{what}</Text>
      <Text style={[st.text, tabular]}>{fmtTime(secs)}</Text>
      <Text style={[st.text, { opacity: 0.85 }]}>Open ›</Text>
    </Pressable>
  );
}

export function useRecorder(): { open: () => void } {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRecorder needs RecordingProvider');
  return v;
}

const st = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: ROUTE,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ffffff' },
  text: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
