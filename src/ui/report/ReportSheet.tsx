import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { Mute } from '@/ui/components';
import { saveText } from '@/ui/files';
import { Button, Notice, Pill, Sheet } from '@/ui/food/kit';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

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

/** Download a PDF report of a day, week, month or year. */
export function ReportSheet({ visible, onClose, initial = 'week' }: { visible: boolean; onClose: () => void; initial?: ReportPeriod }) {
  const c = useColors();
  const { state, today } = useTracker();
  const [period, setPeriod] = useState<ReportPeriod>(initial);
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
    <Sheet visible={visible} title="Download a report" onClose={onClose}>
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

const st = StyleSheet.create({
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginBottom: space.md },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, padding: space.md },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  preview: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, marginTop: space.md },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md - 2 },
});
