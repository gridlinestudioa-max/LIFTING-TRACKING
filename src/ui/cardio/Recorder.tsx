import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  CARDIO_LABEL,
  METERS_PER_MILE,
  compactRoute,
  defaultPlanDay,
  finishSession,
  fmt,
  fmtTime,
  movingAt,
  newId,
  newSession,
  paceText,
  pauseSession,
  resumeSession,
  splitsOf,
  type CardioSession,
  type CardioType,
  type LatLng,
  type RecSession,
} from '@/logic';

import { Field } from '../components';
import { Button, LinkButton } from '../food/kit';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { backgroundCapable, startBackground, stopBackground } from './bgLocation';
import { watchGps, type GpsProblem } from './gpsWatch';
import { addFixes, getSession, subscribe, updateSession } from './recStore';
import { RouteMap } from './RouteMap';

/** Sports worth tracking with GPS. */
const GPS_TYPES: CardioType[] = ['run', 'walk', 'hike', 'bike'];

const PROBLEM: Record<GpsProblem, string> = {
  denied: 'Location access is off. Turn it on for this app (or this site) in your settings to record a route.',
  unavailable: 'Your location isn’t available right now. Check that location is on, then try again.',
  insecure: 'Recording needs a secure (https) connection.',
};

const KEEP_AWAKE = 'recording';

/** Wall clock, for handlers and callbacks (never read while rendering). */
const clockNow = () => Date.now();

/** The live recording, kept in step with the saved one. Undefined until it's been read. */
export function useRecording(): RecSession | null | undefined {
  const [s, setS] = useState<RecSession | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getSession().then((x) => live && setS(x));
    const off = subscribe((x) => setS(x));
    return () => {
      live = false;
      off();
    };
  }, []);
  return s;
}

/**
 * Full-screen recorder: follows GPS, shows time, distance and pace live on a map, then saves a session.
 * The recording is saved as it goes. In the app it keeps recording with the screen locked or another app
 * open (a background location task); in a browser it carries on when the page comes back. Closing this
 * screen while recording just hides it.
 */
export function Recorder({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const sess = useRecording();
  const [type, setType] = useState<CardioType>('run');
  const [here, setHere] = useState<{ p: LatLng; acc: number | null } | null>(null);
  const [problem, setProblem] = useState<GpsProblem | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'discard' | null>(null);
  const [now, setNow] = useState(clockNow);
  const phase = sess ? sess.phase : 'ready';
  const recording = phase === 'recording';
  const shownType = sess?.type ?? type;

  // The GPS callback outlives renders, so it reads this.
  const recRef = useRef(false);
  useEffect(() => {
    recRef.current = recording;
  }, [recording]);

  // In the app, a running recording is fed by the background task; make sure it's on (after a restart too).
  useEffect(() => {
    if (backgroundCapable && recording) startBackground();
  }, [recording]);

  // Follow GPS on screen: for the "you are here" dot, and in a browser for the recording itself.
  const watchHere = !backgroundCapable || !recording;
  useEffect(() => {
    if (!watchHere) return;
    let stop: (() => void) | null = null;
    let live = true;
    watchGps(
      (f) => {
        if (!live) return;
        setProblem(null);
        setHere({ p: [f.lat, f.lng], acc: f.acc ?? null });
        if (!backgroundCapable && recRef.current) addFixes([f]);
      },
      (p) => live && setProblem(p),
    ).then((s) => {
      if (live) stop = s;
      else s();
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [watchHere]);

  useEffect(() => {
    const t = setInterval(() => setNow(clockNow()), 1000);
    return () => clearInterval(t);
  }, []);

  // A browser stops when the screen sleeps: keep it awake while recording there.
  useEffect(() => {
    if (Platform.OS !== 'web' || !recording) return;
    activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
    };
  }, [recording]);

  const start = async () => {
    const t = clockNow();
    setNow(t);
    await updateSession(() => newSession(type, t));
    if (backgroundCapable && !(await startBackground())) {
      await updateSession(() => null);
      setProblem('denied');
    }
  };
  const pause = () => {
    updateSession((s) => (s ? pauseSession(s, clockNow()) : s));
    stopBackground();
  };
  const resume = () => {
    setNow(clockNow());
    updateSession((s) => (s ? resumeSession(s, clockNow()) : s));
  };
  const finish = () => {
    updateSession((s) => (s ? finishSession(s, clockNow()) : s));
    stopBackground();
  };
  const discard = async () => {
    await stopBackground();
    await updateSession(() => null);
    setNote('');
    setConfirm(null);
    onClose();
  };

  if (sess === undefined) return null;
  const track = sess?.track;
  const secs = sess ? Math.round(movingAt(sess, now || sess.since || sess.startedAt)) : 0;
  const miles = (track?.meters ?? 0) / METERS_PER_MILE;
  const speedish = shownType === 'bike' ? (secs > 0 && miles > 0 ? `${fmt(+(miles / (secs / 3600)).toFixed(1))}` : '–') : paceText(miles, secs).replace(' /mi', '') || '–';
  const speedUnit = shownType === 'bike' ? 'mph' : '/mi';
  // In the app the latest recorded point is where you are.
  const last = track?.last;
  const dot: LatLng | null = phase === 'review' ? null : backgroundCapable && recording && last ? [last.lat, last.lng] : (here?.p ?? null);

  const save = async () => {
    if (!sess || !track) return;
    const x: CardioSession = { id: newId('c'), date: today, type: sess.type };
    if (miles >= 0.01) x.miles = Math.round(miles * 1000) / 1000;
    if (secs > 0) x.secs = secs;
    const ft = Math.round(track.climbM * 3.28084);
    if (ft > 0) x.elevFt = ft;
    if (track.pts.length >= 2) x.route = compactRoute(track.pts);
    if (track.miles.length) x.splits = splitsOf(track.miles);
    if (note.trim()) x.note = note.trim();
    const pd = defaultPlanDay(state.cardio, today, sess.type);
    if (pd) x.planDay = pd;
    update((s) => ({ ...s, cardio: { ...s.cardio, sessions: [...s.cardio.sessions, x].sort((a, b) => a.date.localeCompare(b.date)) } }));
    await stopBackground();
    await updateSession(() => null);
    setNote('');
    onClose();
  };

  const gpsLine = problem
    ? PROBLEM[problem]
    : !here
      ? 'Finding your location…'
      : here.acc != null && here.acc > 40
        ? `Weak GPS signal (±${Math.round(here.acc)} m). It improves outdoors with a clear view of the sky.`
        : 'GPS ready';
  const gpsOk = !problem && here && (here.acc == null || here.acc <= 40);
  const gapNote =
    sess && sess.gaps > 0
      ? backgroundCapable
        ? `GPS dropped out ${sess.gaps === 1 ? 'once' : `${sess.gaps} times`} (longest ${Math.round(sess.longestGap / 60)} min). Those stretches are drawn as straight lines.`
        : `The browser paused GPS while the screen was off or you were in another app (longest ${Math.max(1, Math.round(sess.longestGap / 60))} min). Time kept counting; those stretches are straight lines. The installed app keeps tracking with the screen locked.`
      : null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={[st.bar, { borderBottomColor: c.line }]}>
            <Text style={[st.title, { color: c.ink }]}>
              {phase === 'ready' ? 'Record' : phase === 'review' ? 'Save activity' : phase === 'paused' ? 'Paused' : `Recording ${CARDIO_LABEL[shownType].toLowerCase()}`}
            </Text>
            <LinkButton label={phase === 'ready' ? 'Close' : 'Hide'} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <RouteMap route={track?.pts ?? []} here={dot} height={phase === 'review' ? 240 : 300} maxZoom={phase === 'review' ? 17 : 16} />

            {phase === 'ready' ? (
              <>
                <View style={st.gps}>
                  <View style={[st.dot, { backgroundColor: gpsOk ? c.ok : problem ? c.bad : c.warn }]} />
                  <Text style={{ color: problem ? c.bad : c.ink, fontSize: 15, flex: 1 }}>{gpsLine}</Text>
                </View>
                <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Activity</Text>
                <Select label="Activity" value={type} options={GPS_TYPES.map((t) => ({ value: t, label: CARDIO_LABEL[t] }))} onChange={setType} />
                {backgroundCapable ? (
                  <Text style={{ color: c.mute, fontSize: 13, marginTop: space.md }}>Recording keeps going with the screen locked or another app open. A notification shows while it runs.</Text>
                ) : (
                  <Text style={{ color: c.mute, fontSize: 13, marginTop: space.md }}>
                    In a browser, keep this page open: browsers stop GPS when the screen locks or you switch apps. The recording is saved as you go and picks up when you come back. The installed app records with the screen locked.
                  </Text>
                )}
                <Button label="Start" primary onPress={start} style={{ marginTop: space.xl, opacity: problem ? 0.4 : 1 }} />
              </>
            ) : (
              <>
                <View style={[st.big, { borderColor: c.line }]}>
                  <BigStat label="Time" value={fmtTime(secs)} />
                  <BigStat label="Miles" value={fmt(+miles.toFixed(2))} />
                  <BigStat label={shownType === 'bike' ? 'Speed' : 'Pace'} value={speedish} unit={speedUnit} />
                </View>
                {track && track.climbM >= 1 ? (
                  <Text style={{ color: c.mute, fontSize: 14, marginTop: space.sm, textAlign: 'center', ...tabular }}>{`Climb ${Math.round(track.climbM * 3.28084)} ft`}</Text>
                ) : null}
                {problem && phase !== 'review' ? <Text style={{ color: c.bad, marginTop: space.md }}>{PROBLEM[problem]}</Text> : null}
                {gapNote ? <Text style={{ color: c.mute, fontSize: 13, marginTop: space.md }}>{gapNote}</Text> : null}

                {confirm === 'discard' ? (
                  <View style={{ gap: space.sm, marginTop: space.xl }}>
                    <Text style={{ color: c.ink, fontSize: 15 }}>Discard this activity? It won’t be saved.</Text>
                    <Button label="Discard" danger onPress={discard} />
                    <Button label="Keep it" onPress={() => setConfirm(null)} />
                  </View>
                ) : phase === 'review' ? (
                  <>
                    {track?.miles.length ? <Splits marks={track.miles} /> : null}
                    <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Notes</Text>
                    <Field value={note} onChangeText={setNote} placeholder="How it felt" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
                    <Button label="Save" primary onPress={save} style={{ marginTop: space.xl }} />
                    <Button label="Resume" onPress={resume} style={{ marginTop: space.md }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg }}>
                      <LinkButton label="Discard activity" color={c.bad} onPress={() => setConfirm('discard')} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[st.controls, { marginTop: space.xl }]}>
                      {recording ? <Button label="Pause" onPress={pause} style={{ flex: 1 }} /> : <Button label="Resume" primary onPress={resume} style={{ flex: 1 }} />}
                      <Button label="Finish" primary={recording} onPress={finish} style={{ flex: 1 }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg }}>
                      <LinkButton label="Discard activity" color={c.bad} onPress={() => setConfirm('discard')} />
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[st.bigValue, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: c.mute }}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Mile splits as a list with bars: the faster the mile, the longer the bar; the fastest is highlighted. */
export function Splits({ marks, splits }: { marks?: number[]; splits?: number[] }) {
  const c = useColors();
  const list = splits ?? splitsOf(marks ?? []);
  if (!list.length) return null;
  const max = Math.max(...list);
  const min = Math.min(...list);
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[st.lbl, { color: c.mute, marginBottom: space.xs }]}>Splits</Text>
      {list.map((s, i) => (
        <View key={i} style={st.split}>
          <Text style={{ color: c.mute, width: 28, fontSize: 14, ...tabular }}>{i + 1}</Text>
          <Text style={{ color: c.ink, width: 56, fontSize: 15, fontWeight: '700', ...tabular }}>{fmtTime(s)}</Text>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.soft }}>
            <View style={{ width: `${max > min ? 45 + (55 * (max - s)) / (max - min) : 100}%`, height: 10, borderRadius: 5, backgroundColor: s === min && list.length > 1 ? '#fc4c02' : c.ink, opacity: s === min && list.length > 1 ? 1 : 0.55 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  big: { flexDirection: 'row', marginTop: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderRadius: radius.sm },
  bigValue: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, ...tabular },
  controls: { flexDirection: 'row', gap: space.md },
  split: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
});
