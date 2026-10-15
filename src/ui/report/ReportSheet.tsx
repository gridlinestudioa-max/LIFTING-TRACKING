import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  REPORT_PERIODS,
  addDays,
  buildReport,
  fmt,
  fmtInt,
  reportEmpty,
  reportFileName,
  reportSpan,
  sgn,
  type ReportPeriod,
} from '@/logic';
import { useAccount } from '@/ui/account';
import { supabase } from '@/ui/cloud';
import { Mute, Section } from '@/ui/components';
import { saveText } from '@/ui/files';
import { Button, LinkButton, Notice, Pill, Sheet } from '@/ui/food/kit';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

/** The hour (local time) summaries are emailed at. */
const SEND_HOUR = 7;

const WHEN: Record<ReportPeriod, string> = {
  day: 'Yesterday’s summary, every morning',
  week: 'Last week, every Monday',
  month: 'Last month, on the 1st',
  year: 'Last year, on January 1',
};

const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Moves the date by whole periods. */
function shift(period: ReportPeriod, anchor: string, n: number): string {
  if (period === 'day') return addDays(anchor, n);
  if (period === 'week') return addDays(anchor, 7 * n);
  const [y, m] = anchor.split('-').map(Number);
  if (period === 'month') {
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${y + n}-01-01`;
}

/** Export a PDF summary of a day, week, month or year, and sign up to get them by email. */
export function ReportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { state, today } = useTracker();
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [anchor, setAnchor] = useState(today);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const span = useMemo(() => reportSpan(period, anchor), [period, anchor]);
  const report = useMemo(() => buildReport(state, span, today), [state, span, today]);
  const atLatest = reportSpan(period, today).from === span.from;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Loaded only when needed: the PDF maker is large.
      const { reportPdf } = await import('@/logic/reportPdf');
      const bytes = await reportPdf(report, reportSpan('day', today).title);
      const err = await saveText(reportFileName(report), bytes, 'application/pdf');
      setMsg(err ? { tone: 'bad', text: err } : null);
    } catch (e) {
      console.error('PDF export failed', e);
      setMsg({ tone: 'bad', text: 'Couldn’t make the PDF. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const r = report;
  const lines: [string, string][] = [];
  if (r.calories?.daysLogged) {
    if (r.calories.avgNet != null) lines.push([period === 'day' ? 'Calorie deficit' : 'Avg daily deficit', `${sgn(Math.round(r.calories.avgNet))} kcal`]);
    lines.push(['Days with food logged', String(r.calories.daysLogged)]);
  }
  if (r.cardio?.count) lines.push(['Cardio', `${r.cardio.count} · ${fmt(Math.round(r.cardio.miles * 10) / 10)} mi`]);
  if (r.lifting?.workouts) lines.push(['Lifting', `${r.lifting.workouts} ${r.lifting.workouts === 1 ? 'workout' : 'workouts'} · ${fmtInt(r.lifting.sets)} sets`]);
  if (r.lifting?.prs.length) lines.push(['Personal records', String(r.lifting.prs.length)]);
  if (r.body?.weightFrom != null) lines.push(['Weight', `${fmt(r.body.weightTo ?? r.body.weightFrom)} lb`]);

  return (
    <Sheet visible={visible} title="Export a summary" onClose={onClose}>
      <View style={st.pills}>
        {REPORT_PERIODS.map((p) => (
          <Pill
            key={p.id}
            label={p.label}
            selected={period === p.id}
            onPress={() => {
              setPeriod(p.id);
              setAnchor(today);
            }}
          />
        ))}
      </View>

      <View style={[st.nav, { backgroundColor: c.card }]}>
        <Arrow label="‹" a11y={`Previous ${period}`} onPress={() => setAnchor(shift(period, anchor, -1))} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[st.title, { color: c.ink }]} numberOfLines={1}>
            {span.title}
          </Text>
          {atLatest && period !== 'day' ? <Text style={{ color: c.mute, fontSize: 12.5 }}>So far</Text> : null}
        </View>
        <Arrow label="›" a11y={`Next ${period}`} disabled={atLatest} onPress={() => setAnchor(shift(period, anchor, 1))} />
      </View>

      <View style={[st.preview, { backgroundColor: c.card }]}>
        {reportEmpty(r) ? (
          <Mute>Nothing logged in this {period}.</Mute>
        ) : (
          lines.map(([k, v], i) => (
            <View key={k} style={[st.line, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <Text style={{ color: c.mute, fontSize: 15, flex: 1 }}>{k}</Text>
              <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', ...tabular }}>{v}</Text>
            </View>
          ))
        )}
      </View>
      <Mute style={{ fontSize: 13, marginTop: space.sm }}>
        The PDF has your calories, cardio, lifting and body log for the {period}, with charts and the list of what you did.
      </Mute>

      <Button label={busy ? 'Making PDF…' : 'Save PDF'} primary onPress={busy ? () => {} : save} style={{ marginTop: space.lg }} />
      {msg ? (
        <Notice tone={msg.tone} style={{ marginTop: space.md }}>
          <Text style={{ color: c.ink }}>{msg.text}</Text>
        </Notice>
      ) : null}

      <EmailSummaries />
    </Sheet>
  );
}

function Arrow({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => [st.arrow, { borderColor: c.line, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Text style={{ fontSize: 20, color: c.ink, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

type SubState = { status: 'loading' } | { status: 'ready'; periods: ReportPeriod[] } | { status: 'unavailable' } | { status: 'error'; text: string };

/** Sign up for summaries by email: pick daily, weekly, monthly and/or yearly. */
function EmailSummaries() {
  const c = useColors();
  const { mode, user } = useAccount();
  const [sub, setSub] = useState<SubState>({ status: 'loading' });
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const sb = supabase();
  const uid = user?.id ?? null;

  // Bumped to read the settings again (after a save fails).
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!sb || !uid) return;
    let live = true;
    sb.from('report_subscriptions')
      .select('periods')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setSub(error.code === '42P01' || error.code === 'PGRST205' ? { status: 'unavailable' } : { status: 'error', text: 'Couldn’t load your email settings.' });
        else setSub({ status: 'ready', periods: ((data?.periods as ReportPeriod[] | undefined) ?? []).filter((p) => REPORT_PERIODS.some((x) => x.id === p)) });
      });
    return () => {
      live = false;
    };
  }, [sb, uid, reload]);

  if (mode !== 'account' || !sb || !uid) {
    return (
      <Section title="Email me a summary" style={{ marginTop: space.xl }}>
        <Mute>Sign in to get these summaries by email. They’re made from the copy of your data saved to your account.</Mute>
      </Section>
    );
  }

  const toggle = async (p: ReportPeriod, on: boolean) => {
    if (sub.status !== 'ready') return;
    const periods = REPORT_PERIODS.map((x) => x.id).filter((x) => (x === p ? on : sub.periods.includes(x)));
    setSub({ status: 'ready', periods });
    setNote(null);
    const { error } = await sb
      .from('report_subscriptions')
      .upsert({ user_id: uid, periods, tz: timeZone(), hour: SEND_HOUR, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      setNote({ tone: 'bad', text: 'Couldn’t save that. Check your connection and try again.' });
      setReload((n) => n + 1);
    }
  };

  const sendNow = async () => {
    if (sending) return;
    setSending(true);
    setNote(null);
    const period = sub.status === 'ready' && sub.periods.length ? sub.periods[0] : 'week';
    const { data, error } = await sb.functions.invoke('send-reports', { body: { period, tz: timeZone() } });
    setSending(false);
    if (error) {
      let text = 'Couldn’t send it. Email summaries may not be set up on the server yet.';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) text = body.error;
      } catch {
        // Keep the general message.
      }
      setNote({ tone: 'bad', text });
    } else setNote({ tone: 'ok', text: (data as { message?: string })?.message ?? 'Sent.' });
  };

  return (
    <Section title="Email me a summary" style={{ marginTop: space.xl }}>
      {sub.status === 'loading' ? <Mute>Loading…</Mute> : null}
      {sub.status === 'unavailable' ? <Mute>Email summaries aren’t switched on for this app yet.</Mute> : null}
      {sub.status === 'error' ? <Mute>{sub.text}</Mute> : null}
      {sub.status === 'ready' ? (
        <>
          {REPORT_PERIODS.map((p, i) => (
            <View key={p.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{p.every}</Text>
                <Text style={{ color: c.mute, fontSize: 13, lineHeight: 18 }}>{WHEN[p.id]}</Text>
              </View>
              <Switch
                value={sub.periods.includes(p.id)}
                onValueChange={(v) => toggle(p.id, v)}
                accessibilityLabel={`${p.every} summary email`}
                trackColor={{ true: c.ok, false: c.line }}
                thumbColor="#ffffff"
                {...({ activeThumbColor: '#ffffff' } as object)}
              />
            </View>
          ))}
          <Mute style={{ fontSize: 12.5, marginTop: space.sm }}>
            {`Sent to ${user?.email ?? 'your email'} around ${SEND_HOUR} am your time, with the PDF attached. Periods with nothing logged are skipped.`}
          </Mute>
          {sub.periods.length ? (
            <View style={{ flexDirection: 'row', marginTop: space.md }}>
              <LinkButton label={sending ? 'Sending…' : 'Send me one now'} onPress={sendNow} />
            </View>
          ) : null}
        </>
      ) : null}
      {note ? (
        <Notice tone={note.tone} style={{ marginTop: space.md }}>
          <Text style={{ color: c.ink }}>{note.text}</Text>
        </Notice>
      ) : null}
    </Section>
  );
}

const st = StyleSheet.create({
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginBottom: space.md },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, padding: space.md },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  preview: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, marginTop: space.md },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md - 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
});
