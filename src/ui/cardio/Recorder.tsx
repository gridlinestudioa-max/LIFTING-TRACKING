import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  CARDIO_LABEL,
  EMPTY_TRACK,
  METERS_PER_MILE,
  addFix,
  compactRoute,
  defaultPlanDay,
  fmt,
  fmtTime,
  newId,
  paceText,
  splitsOf,
  type CardioSession,
  type CardioType,
  type LatLng,
  type Track,
} from '@/logic';

import { Field } from '../components';
import { Button, LinkButton } from '../food/kit';
import { Select } from '../Select';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { watchGps, type GpsProblem } from './gpsWatch';
import { RouteMap } from './RouteMap';

/** Sports worth tracking with GPS. */
const GPS_TYPES: CardioType[] = ['run', 'walk', 'hike', 'bike'];

type Phase = 'ready' | 'recording' | 'paused' | 'review';

const PROBLEM: Record<GpsProblem, string> = {
  denied: 'Location access is off. Turn it on for this app (or this site) in your settings to record a route.',
  unavailable: 'Your location isn’t available right now. Check that location is on, then try again.',
  insecure: 'Recording needs a secure (https) connection.',
};

const KEEP_AWAKE = 'recording';

/** Wall clock, for handlers and callbacks (never read while rendering). */
const clockNow = () => Date.now();

/** Full-screen recorder: follows GPS, shows time, distance and pace live on a map, then saves a session. */
export function Recorder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const [type, setType] = useState<CardioType>('run');
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [track, setTrack] = useState<Track>(EMPTY_TRACK);
  const [here, setHere] = useState<{ p: LatLng; acc: number | null } | null>(null);
  const [problem, setProblem] = useState<GpsProblem | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'discard' | null>(null);
  const [clock, setClock] = useState({ banked: 0, since: 0 });
  const [now, setNow] = useState(0);

  // The GPS callback outlives renders, so it reads these.
  const phaseRef = useRef<Phase>('ready');
  const trackRef = useRef<Track>(EMPTY_TRACK);
  const resumeRef = useRef(false);
  const clockRef = useRef({ banked: 0, since: 0 });

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const setTimer = (v: { banked: number; since: number }) => {
    clockRef.current = v;
    setClock(v);
  };
  /** Seconds recorded at time `t` (pauses left out). For handlers and the GPS callback. */
  const movingAt = (t: number) => clockRef.current.banked + (phaseRef.current === 'recording' ? (t - clockRef.current.since) / 1000 : 0);

  useEffect(() => {
    if (!visible) return;
    let stop: (() => void) | null = null;
    let live = true;
    watchGps(
      (f) => {
        if (!live) return;
        setProblem(null);
        setHere({ p: [f.lat, f.lng], acc: f.acc ?? null });
        if (phaseRef.current !== 'recording') return;
        const next = addFix(trackRef.current, f, movingAt(clockNow()), resumeRef.current);
        resumeRef.current = false;
        if (next !== trackRef.current) {
          trackRef.current = next;
          setTrack(next);
        }
      },
      (p) => live && setProblem(p),
    ).then((s) => {
      if (live) stop = s;
      else s();
    });
    const t = setInterval(() => setNow(clockNow()), 1000);
    return () => {
      live = false;
      stop?.();
      clearInterval(t);
      deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
    };
  }, [visible]);

  const start = () => {
    const t = clockNow();
    setTimer({ banked: 0, since: t });
    setNow(t);
    trackRef.current = EMPTY_TRACK;
    setTrack(EMPTY_TRACK);
    setPhase('recording');
    activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
  };
  const pause = () => {
    setTimer({ banked: movingAt(clockNow()), since: 0 });
    setPhase('paused');
  };
  const resume = () => {
    const t = clockNow();
    setTimer({ banked: clockRef.current.banked, since: t });
    setNow(t);
    resumeRef.current = true;
    setPhase('recording');
  };
  const finish = () => {
    if (phaseRef.current === 'recording') pause();
    setPhase('review');
    deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
  };
  const reset = () => {
    trackRef.current = EMPTY_TRACK;
    setTrack(EMPTY_TRACK);
    setTimer({ banked: 0, since: 0 });
    setNote('');
    setConfirm(null);
    setPhase('ready');
    deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
  };
  const close = () => {
    if (phase === 'recording' || phase === 'paused' || phase === 'review') return setConfirm('discard');
    reset();
    onClose();
  };

  const secs = Math.round(clock.banked + (phase === 'recording' ? Math.max(0, now - clock.since) / 1000 : 0));
  const miles = track.meters / METERS_PER_MILE;
  const speedish = type === 'bike' ? (secs > 0 && miles > 0 ? `${fmt(+(miles / (secs / 3600)).toFixed(1))}` : '–') : paceText(miles, secs).replace(' /mi', '') || '–';
  const speedUnit = type === 'bike' ? 'mph' : '/mi';

  const save = () => {
    const x: CardioSession = { id: newId('c'), date: today, type };
    if (miles >= 0.01) x.miles = Math.round(miles * 1000) / 1000;
    if (secs > 0) x.secs = secs;
    const ft = Math.round(track.climbM * 3.28084);
    if (ft > 0) x.elevFt = ft;
    if (track.pts.length >= 2) x.route = compactRoute(track.pts);
    if (track.miles.length) x.splits = splitsOf(track.miles);
    if (note.trim()) x.note = note.trim();
    const pd = defaultPlanDay(state.cardio, today, type);
    if (pd) x.planDay = pd;
    update((s) => ({ ...s, cardio: { ...s.cardio, sessions: [...s.cardio.sessions, x].sort((a, b) => a.date.localeCompare(b.date)) } }));
    reset();
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={[st.bar, { borderBottomColor: c.line }]}>
            <Text style={[st.title, { color: c.ink }]}>
              {phase === 'ready' ? 'Record' : phase === 'review' ? 'Save activity' : phase === 'paused' ? 'Paused' : `Recording ${CARDIO_LABEL[type].toLowerCase()}`}
            </Text>
            <LinkButton label={phase === 'ready' ? 'Close' : 'Discard'} onPress={close} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <RouteMap route={track.pts} here={phase === 'review' ? null : (here?.p ?? null)} height={phase === 'review' ? 240 : 300} maxZoom={phase === 'review' ? 17 : 16} />

            {phase === 'ready' ? (
              <>
                <View style={st.gps}>
                  <View style={[st.dot, { backgroundColor: gpsOk ? c.ok : problem ? c.bad : c.warn }]} />
                  <Text style={{ color: problem ? c.bad : c.ink, fontSize: 15, flex: 1 }}>{gpsLine}</Text>
                </View>
                <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Activity</Text>
                <Select label="Activity" value={type} options={GPS_TYPES.map((t) => ({ value: t, label: CARDIO_LABEL[t] }))} onChange={setType} />
                {Platform.OS === 'web' ? (
                  <Text style={{ color: c.mute, fontSize: 13, marginTop: space.md }}>Keep this page open while you record. Browsers stop tracking when the screen locks or you switch apps.</Text>
                ) : (
                  <Text style={{ color: c.mute, fontSize: 13, marginTop: space.md }}>Keep the app open while you record. The screen stays on.</Text>
                )}
                <Button label="Start" primary onPress={start} style={{ marginTop: space.xl, opacity: problem ? 0.4 : 1 }} />
              </>
            ) : (
              <>
                <View style={[st.big, { borderColor: c.line }]}>
                  <BigStat label="Time" value={fmtTime(secs)} />
                  <BigStat label="Miles" value={fmt(+miles.toFixed(2))} />
                  <BigStat label={type === 'bike' ? 'Speed' : 'Pace'} value={speedish} unit={speedUnit} />
                </View>
                {track.climbM >= 1 ? (
                  <Text style={{ color: c.mute, fontSize: 14, marginTop: space.sm, textAlign: 'center', ...tabular }}>{`Climb ${Math.round(track.climbM * 3.28084)} ft`}</Text>
                ) : null}
                {problem && phase !== 'review' ? <Text style={{ color: c.bad, marginTop: space.md }}>{PROBLEM[problem]}</Text> : null}

                {confirm === 'discard' ? (
                  <View style={{ gap: space.sm, marginTop: space.xl }}>
                    <Text style={{ color: c.ink, fontSize: 15 }}>Discard this activity? It won’t be saved.</Text>
                    <Button
                      label="Discard"
                      danger
                      onPress={() => {
                        reset();
                        onClose();
                      }}
                    />
                    <Button label="Keep it" onPress={() => setConfirm(null)} />
                  </View>
                ) : phase === 'review' ? (
                  <>
                    {track.miles.length ? <Splits marks={track.miles} /> : null}
                    <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Notes</Text>
                    <Field value={note} onChangeText={setNote} placeholder="How it felt" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
                    <Button label="Save" primary onPress={save} style={{ marginTop: space.xl }} />
                    <Button label="Resume" onPress={resume} style={{ marginTop: space.md }} />
                  </>
                ) : (
                  <View style={[st.controls, { marginTop: space.xl }]}>
                    {phase === 'recording' ? (
                      <Button label="Pause" onPress={pause} style={{ flex: 1 }} />
                    ) : (
                      <Button label="Resume" primary onPress={resume} style={{ flex: 1 }} />
                    )}
                    <Button label="Finish" primary={phase === 'recording'} onPress={finish} style={{ flex: 1 }} />
                  </View>
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
