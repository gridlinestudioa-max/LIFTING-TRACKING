import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  CARDIO_TYPES,
  activitiesCsv,
  bodyCsv,
  defaultState,
  exportJson,
  fmtTime,
  foodCsv,
  groupOf,
  isDuplicate,
  parseActivityFile,
  sessionFromImport,
  shortDayLabel,
  type CardioType,
  type ImportedActivity,
} from '@/logic';

import { useAccount } from '../account';
import { Mute, Section } from '../components';
import { pickText, saveText } from '../files';
import { Button, LinkButton, Sheet } from '../food/kit';
import { Select } from '../Select';
import { distFor, paceFor } from '../stats/CardioStats';
import { useTracker } from '../store';
import { space, useColors } from '../theme';

// The "your data is yours" part of the You tab: download everything, bring activities in from other apps,
// say plainly where data lives, and delete it.

interface Note {
  text: string;
  bad?: boolean;
}

function NoteText({ note }: { note: Note | null }) {
  const c = useColors();
  if (!note) return null;
  return <Text style={{ color: note.bad ? c.bad : c.ok, fontWeight: '700', marginTop: space.md }}>{note.text}</Text>;
}

/** Download your data, and import activities from GPX or TCX files. */
export function DataSection() {
  const c = useColors();
  const { state, today } = useTracker();
  const [note, setNote] = useState<Note | null>(null);
  const [picked, setPicked] = useState<{ name: string; activities: ImportedActivity[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async (name: string, ext: 'json' | 'csv', text: string) => {
    const err = await saveText(`${name}-${today}.${ext}`, text, ext === 'json' ? 'application/json' : 'text/csv');
    setNote(err ? { text: err, bad: true } : { text: 'Your file is ready.' });
  };

  const chooseFile = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await pickText();
      if (r.canceled) return;
      if ('error' in r) return setNote({ text: r.error, bad: true });
      const parsed = parseActivityFile(r.file.text);
      if (!parsed.ok) return setNote({ text: parsed.error, bad: true });
      setPicked({ name: r.file.name, activities: parsed.activities });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Your data">
      <Mute>Download everything you’ve logged, any time. Files open in a spreadsheet or any other app.</Mute>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Button label="Download everything (JSON)" onPress={() => download('training-tracker', 'json', exportJson(state))} />
        <Button label="Cardio activities (CSV)" onPress={() => download('activities', 'csv', activitiesCsv(state.cardio))} />
        <Button label="Food log (CSV)" onPress={() => download('food', 'csv', foodCsv(state))} />
        <Button label="Weight, water, sleep and steps (CSV)" onPress={() => download('body', 'csv', bodyCsv(state.days))} />
      </View>

      <Text style={{ fontWeight: '700', fontSize: 16, marginTop: space.xl, color: c.ink }}>Import an activity</Text>
      <Mute style={{ marginTop: 2 }}>Bring in a run, ride or swim from a watch or another app. Choose a GPX or TCX file (Garmin, Strava and most apps can export one).</Mute>
      <Button label={busy ? 'Reading…' : 'Choose a file'} onPress={chooseFile} style={{ marginTop: space.md }} />
      <NoteText note={note} />

      {picked ? (
        <ImportSheet
          key={picked.name}
          fileName={picked.name}
          activities={picked.activities}
          onClose={(added) => {
            setPicked(null);
            if (added != null) setNote({ text: added ? `Added ${added} ${added === 1 ? 'activity' : 'activities'}.` : 'Nothing new to add.' });
          }}
        />
      ) : null}
    </Section>
  );
}

function ImportSheet({ fileName, activities, onClose }: { fileName: string; activities: ImportedActivity[]; onClose: (added?: number) => void }) {
  const c = useColors();
  const { state, today, update } = useTracker();
  const [fallback, setFallback] = useState<CardioType>('run');
  const unsure = activities.some((a) => a.type == null);

  // Build the sessions that would be added, skipping any already in the log (or repeated within the file).
  const rows = useMemo(() => {
    const seen = [...state.cardio.sessions];
    return activities.map((a) => {
      const x = sessionFromImport(a, fallback, today);
      const dup = isDuplicate(seen, x);
      if (!dup) seen.push(x);
      return { a, x, dup };
    });
  }, [activities, fallback, state.cardio.sessions, today]);
  const fresh = rows.filter((r) => !r.dup);

  const add = () => {
    const adds = fresh.map((r) => r.x);
    if (adds.length) {
      update((s) => ({ ...s, cardio: { ...s.cardio, sessions: [...s.cardio.sessions, ...adds].sort((p, q) => p.date.localeCompare(q.date)) } }));
    }
    onClose(adds.length);
  };

  return (
    <Sheet visible title="Import activities" onClose={() => onClose()}>
      <Mute>{`${fileName} · ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} found`}</Mute>

      {unsure ? (
        <View style={{ marginTop: space.lg, gap: 6 }}>
          <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Sport, if the file doesn’t say</Text>
          <Select label="Sport, if the file doesn’t say" value={fallback} options={CARDIO_TYPES.map((t) => ({ value: t.id, label: t.label }))} onChange={setFallback} />
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        {rows.slice(0, 50).map(({ a, x, dup }, i) => {
          const g = groupOf(x.type);
          const bits = [
            x.miles ? distFor(g, x.miles) : null,
            x.secs ? fmtTime(x.secs) : null,
            x.miles && x.secs ? paceFor(g, x.secs / x.miles) : null,
            x.elevFt ? `${x.elevFt} ft` : null,
            x.hr ? `${x.hr} bpm` : null,
          ].filter(Boolean);
          return (
            <View key={x.id} style={[{ paddingVertical: space.sm + 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>{`${CARDIO_LABEL[x.type]} · ${shortDayLabel(x.date)}`}</Text>
              <Text style={{ color: c.mute, fontSize: 13 }}>{bits.join(' · ') || 'No distance or time in the file'}</Text>
              {a.date == null ? <Text style={{ color: c.mute, fontSize: 13 }}>No date in the file, so today’s date is used.</Text> : null}
              {dup ? <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600' }}>Already in your log, skipped.</Text> : null}
            </View>
          );
        })}
        {rows.length > 50 ? <Mute style={{ marginTop: space.sm }}>{`Showing the first 50 of ${rows.length}.`}</Mute> : null}
      </View>

      <Button
        label={fresh.length ? `Add ${fresh.length} ${fresh.length === 1 ? 'activity' : 'activities'}` : 'Nothing new to add'}
        primary
        onPress={add}
        style={{ marginTop: space.xl }}
      />
      <Button label="Cancel" onPress={() => onClose()} style={{ marginTop: space.md }} />
    </Sheet>
  );
}

function Fact({ title, children }: { title: string; children: string }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      <Mute>{children}</Mute>
    </View>
  );
}

/** Plain facts about where data goes. Keep this in step with the code: change it when what the app sends changes. */
export function PrivacySection() {
  const { mode } = useAccount();
  return (
    <Section title="Where your data lives">
      <Fact title="On this device">Everything you log is saved in this app, on this phone or browser.</Fact>
      {mode === 'account' ? (
        <Fact title="In your account">
          A copy is kept in this app’s database so you can sign in anywhere. Access rules let only you read it. It isn’t end-to-end encrypted, so whoever runs the app’s server could technically see it.
        </Fact>
      ) : null}
      <Fact title="Friends (optional)">
        If you turn it on, friends see your name and only what you choose to share on your profile: cardio totals and bests, lifting counts and your top lifts, and food averages for the last 7 days. Never your routes, what you ate, your weight or notes. A phone number, if you add one, is stored scrambled.
      </Fact>
      <Fact title="Other services">
        Maps load tiles from OpenStreetMap, branded food searches go to Open Food Facts, and exercise pictures load from GitHub. They can see your IP address. The USDA food data is built into the app.
      </Fact>
      <Fact title="Not in the app">No ads, and no analytics or tracking code.</Fact>
    </Section>
  );
}

/** Delete the account and its data, or erase what's saved on this device when there's no account. */
export function DeleteSection() {
  const c = useColors();
  const { mode, deleteAccount } = useAccount();
  const { update } = useTracker();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signedIn = mode === 'account';

  const run = async () => {
    if (busy) return;
    setErr(null);
    if (!signedIn) {
      update(() => defaultState());
      return setConfirm(false);
    }
    setBusy(true);
    const e = await deleteAccount();
    // On success the app moves to the sign-in page; only a failure leaves us here.
    if (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <Section title={signedIn ? 'Delete your account' : 'Erase your data'}>
      {confirm ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: c.ink, fontSize: 15 }}>
            {signedIn
              ? 'This permanently deletes your account and everything saved in it: your log, your plan, and your friends and shared stats. This device’s copy is erased too. It can’t be undone.'
              : 'This erases everything saved in this app on this device: your log, plan and profile. It can’t be undone.'}
          </Text>
          <Button label={busy ? 'Deleting…' : signedIn ? 'Delete account and data' : 'Erase everything'} danger onPress={run} />
          <Button label="Cancel" onPress={() => setConfirm(false)} />
        </View>
      ) : (
        <>
          <Mute>Download your data first if you want a copy.</Mute>
          <View style={{ flexDirection: 'row', marginTop: space.md }}>
            <LinkButton label={signedIn ? 'Delete account and data' : 'Erase everything on this device'} color={c.bad} onPress={() => setConfirm(true)} />
          </View>
        </>
      )}
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
    </Section>
  );
}
