// Draws a Report (report.ts) as a PDF: a heading, then calories, cardio, lifting and body sections with
// key numbers, a bar chart and the list of what was done. Uses pdf-lib, which is plain JavaScript and works on
// the web and on phones.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

import { fmtSleep } from './body';
import { shortDayLabel } from './dates';
import { fmt, fmtInt, sgn } from './format';
import { niceTicks } from './ranges';
import type { Report, ReportBar } from './report';

const W = 612;
const H = 792;
const M = 44;
const INK = rgb(0.09, 0.09, 0.11);
const MUTE = rgb(0.42, 0.42, 0.46);
const LINE = rgb(0.88, 0.88, 0.9);
const ACCENT = rgb(0.988, 0.298, 0.008);
const OK = rgb(0.13, 0.6, 0.33);
const BAD = rgb(0.84, 0.2, 0.2);

interface Pen {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  reg: PDFFont;
  bold: PDFFont;
}

/** Characters the built-in PDF font can't draw are dropped (it has no emoji or arrows). */
function safe(f: PDFFont, s: string): string {
  let out = '';
  for (const ch of s) {
    try {
      f.encodeText(ch);
      out += ch;
    } catch {
      // Not in the font.
    }
  }
  return out;
}

function text(p: Pen, s: string, x: number, y: number, size: number, opt: { bold?: boolean; color?: RGB; right?: boolean; max?: number } = {}) {
  const f = opt.bold ? p.bold : p.reg;
  let t = safe(f, s);
  if (opt.max) while (t.length > 1 && f.widthOfTextAtSize(t, size) > opt.max) t = `${t.slice(0, -2)}…`;
  const w = f.widthOfTextAtSize(t, size);
  p.page.drawText(t, { x: opt.right ? x - w : x, y, size, font: f, color: opt.color ?? INK });
}

function newPage(p: Pen) {
  p.page = p.doc.addPage([W, H]);
  p.y = H - M;
}

/** Starts a new page when less than `h` points are left. */
function room(p: Pen, h: number) {
  if (p.y - h < M) newPage(p);
}

function heading(p: Pen, s: string) {
  room(p, 60);
  p.y -= 8;
  text(p, s, M, p.y - 16, 16, { bold: true });
  p.page.drawRectangle({ x: M, y: p.y - 24, width: 28, height: 2.5, color: ACCENT });
  p.y -= 36;
}

/** Up to four big numbers in a row, each with a label. */
function tiles(p: Pen, items: { value: string; label: string; color?: RGB }[]) {
  const per = 4;
  for (let i = 0; i < items.length; i += per) {
    room(p, 44);
    const row = items.slice(i, i + per);
    const cw = (W - 2 * M) / per;
    row.forEach((t, j) => {
      text(p, t.value, M + j * cw, p.y - 18, 17, { bold: true, color: t.color, max: cw - 8 });
      text(p, t.label, M + j * cw, p.y - 32, 8.5, { color: MUTE, max: cw - 8 });
    });
    p.y -= 44;
  }
}

function chart(p: Pen, title: string, data: ReportBar[], unit: string, signed = false) {
  const vals = data.map((d) => d.v).filter((v): v is number => v != null);
  if (vals.length < 1) return;
  const h = 110;
  room(p, h + 34);
  text(p, `${title} (${unit})`, M, p.y - 10, 9.5, { bold: true, color: MUTE });
  p.y -= 22;
  const lo = signed ? Math.min(0, ...vals) : 0;
  const hi = Math.max(signed ? 0 : 1, ...vals);
  const ticks = niceTicks(lo, hi, 3);
  const tlo = Math.min(lo, ticks[0]);
  const thi = Math.max(hi, ticks[ticks.length - 1]);
  const left = M + 40;
  const right = W - M;
  const bottom = p.y - h;
  const yOf = (v: number) => bottom + ((v - tlo) / (thi - tlo || 1)) * h;
  for (const t of ticks) {
    const y = yOf(t);
    p.page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: t === 0 ? 0.8 : 0.4, color: t === 0 ? MUTE : LINE });
    text(p, Math.abs(t) >= 1000 ? fmtInt(t) : fmt(Math.round(t * 10) / 10), left - 5, y - 3, 7.5, { color: MUTE, right: true });
  }
  const n = data.length;
  const slot = (right - left) / n;
  const bw = Math.max(1.5, Math.min(26, slot * 0.7));
  const every = Math.ceil(n / 16);
  data.forEach((d, i) => {
    const cx = left + slot * i + slot / 2;
    if (d.v != null && d.v !== 0) {
      const y0 = yOf(0);
      const y1 = yOf(d.v);
      p.page.drawRectangle({ x: cx - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(0.8, Math.abs(y1 - y0)), color: signed ? (d.v >= 0 ? OK : BAD) : ACCENT });
    }
    if (i % every === 0 || i === n - 1) {
      const lw = p.reg.widthOfTextAtSize(safe(p.reg, d.label), 7);
      text(p, d.label, cx - lw / 2, bottom - 10, 7, { color: MUTE });
    }
  });
  p.y = bottom - 22;
}

function list(p: Pen, title: string, rows: { left: string; right?: string }[]) {
  if (!rows.length) return;
  room(p, 34);
  if (title) {
    text(p, title, M, p.y - 10, 9.5, { bold: true, color: MUTE });
    p.y -= 16;
  }
  for (const r of rows) {
    room(p, 16);
    text(p, r.left, M, p.y - 10, 10, { max: r.right ? W - 2 * M - 120 : W - 2 * M });
    if (r.right) text(p, r.right, W - M, p.y - 10, 10, { right: true, color: MUTE, max: 116 });
    p.page.drawLine({ start: { x: M, y: p.y - 15 }, end: { x: W - M, y: p.y - 15 }, thickness: 0.4, color: LINE });
    p.y -= 17;
  }
  p.y -= 8;
}

/** "45 min", "1 h 5 min". */
const dur = (secs: number) => {
  const m = Math.round(secs / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};

/** A line saying nothing was logged. */
function none(p: Pen, s: string) {
  text(p, s, M, p.y - 10, 10, { color: MUTE });
  p.y -= 24;
}

const kc = (v: number | null) => (v == null ? '–' : fmtInt(Math.round(v)));
const date = (s: string) => shortDayLabel(s);

/** The report as PDF bytes. */
export async function reportPdf(r: Report, made: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Training summary: ${r.span.title}`);
  doc.setCreator('Training Tracker');
  const p: Pen = { doc, page: doc.addPage([W, H]), y: H - M, reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };

  // Heading band.
  p.page.drawRectangle({ x: 0, y: H - 108, width: W, height: 108, color: rgb(0.1, 0.1, 0.12) });
  p.page.drawRectangle({ x: 0, y: H - 112, width: W, height: 4, color: ACCENT });
  text(p, `${{ day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[r.span.period]} summary${r.name ? ` · ${r.name}` : ''}`, M, H - 46, 11, { color: rgb(0.8, 0.8, 0.82) });
  text(p, r.span.title, M, H - 76, 26, { bold: true, color: rgb(1, 1, 1) });
  text(p, r.span.from === r.span.to ? '' : `${date(r.span.from)} – ${date(r.span.to)}`, M, H - 96, 10, { color: rgb(0.8, 0.8, 0.82) });
  p.y = H - 130;

  const c = r.calories;
  if (c) {
    heading(p, 'Calories');
    if (!c.daysLogged) none(p, 'No calories logged.');
    else {
      tiles(p, [
        { value: c.avgNet == null ? '–' : sgn(Math.round(c.avgNet)), label: r.span.period === 'day' ? 'Deficit (kcal)' : 'Avg daily deficit (kcal)', color: c.avgNet == null ? undefined : c.avgNet >= 0 ? OK : BAD },
        { value: kc(c.avgIn), label: r.span.period === 'day' ? 'Eaten (kcal)' : 'Avg eaten (kcal/day)' },
        { value: kc(c.avgOut), label: r.span.period === 'day' ? 'Burned (kcal)' : 'Avg burned (kcal/day)' },
        r.span.period === 'day'
          ? { value: c.goal != null ? (c.goal === 0 ? 'Even' : sgn(c.goal)) : '–', label: 'Target (kcal)' }
          : { value: `${c.daysAtGoal}/${c.daysLogged}`, label: c.goal != null ? 'Days on target' : 'Days in a deficit' },
        ...(r.span.period !== 'day' ? [{ value: sgn(Math.round(c.totalNet)), label: 'Total deficit (kcal)', color: c.totalNet >= 0 ? OK : BAD }] : []),
        ...(c.macros
          ? [
              { value: `${fmt(c.macros.protein)} g`, label: r.span.period === 'day' ? 'Protein' : 'Avg protein/day' },
              { value: `${fmt(c.macros.carbs)} g`, label: r.span.period === 'day' ? 'Carbs' : 'Avg carbs/day' },
              { value: `${fmt(c.macros.fat)} g`, label: r.span.period === 'day' ? 'Fat' : 'Avg fat/day' },
            ]
          : []),
      ]);
      chart(p, r.span.period === 'year' ? 'Average daily deficit by month' : 'Deficit by day', c.bars, 'kcal', true);
      for (const m of c.meals) list(p, m.label, m.items.map((x) => ({ left: x.name, right: `${fmtInt(x.kcal)} kcal` })));
    }
  }

  const cd = r.cardio;
  if (cd) {
    heading(p, 'Cardio');
    if (!cd.count) none(p, 'No cardio logged.');
    else {
      tiles(p, [
        { value: String(cd.count), label: cd.count === 1 ? 'Activity' : 'Activities' },
        { value: `${fmt(Math.round(cd.miles * 10) / 10)} mi`, label: 'Distance (not swims)' },
        { value: cd.secs ? dur(cd.secs) : '–', label: 'Time' },
        { value: cd.longest ? cd.longest.split(',')[0] : '–', label: 'Longest' },
      ]);
      if (cd.bySport.length > 1 || r.span.period !== 'day')
        list(p, 'By sport', cd.bySport.map((s) => ({ left: `${s.label} · ${s.count}×`, right: [s.dist, s.secs ? dur(s.secs) : ''].filter(Boolean).join(' · ') })));
      chart(p, r.span.period === 'year' ? 'Miles by month' : 'Miles by day', cd.bars, 'mi');
      list(p, 'Activities', cd.list.map((x) => ({ left: x.text, right: r.span.period === 'day' ? undefined : date(x.date) })));
    }
  }

  const l = r.lifting;
  if (l) {
    heading(p, 'Lifting');
    if (!l.workouts) none(p, 'No workouts logged.');
    else {
      tiles(p, [
        { value: String(l.workouts), label: l.workouts === 1 ? 'Workout' : 'Workouts' },
        { value: fmtInt(l.sets), label: 'Sets done' },
        { value: l.volume ? `${fmtInt(l.volume)} lb` : '–', label: 'Volume (weight × reps)' },
        { value: l.minutes ? dur(l.minutes * 60) : '–', label: 'Time' },
      ]);
      chart(p, r.span.period === 'year' ? 'Workouts by month' : 'Workouts by day', l.bars, 'count');
      list(p, 'Personal records', l.prs.map((x) => ({ left: x })));
      list(p, 'Workouts', l.list.map((x) => ({ left: x.text, right: r.span.period === 'day' ? undefined : date(x.date) })));
    }
  }

  const b = r.body;
  if (b) {
    heading(p, 'Body');
    tiles(p, [
      {
        value: b.weightFrom == null ? '–' : b.weightTo == null ? `${fmt(b.weightFrom)} lb` : `${fmt(b.weightTo)} lb`,
        label: b.weightTo != null && b.weightFrom != null ? `Weight (${sgn(Math.round((b.weightTo - b.weightFrom) * 10) / 10)} lb)` : 'Weight',
      },
      { value: b.avgSleepMins != null ? fmtSleep(Math.round(b.avgSleepMins)) : '–', label: r.span.period === 'day' ? 'Sleep' : 'Avg sleep' },
      { value: b.avgSteps != null ? fmtInt(Math.round(b.avgSteps)) : '–', label: r.span.period === 'day' ? 'Steps' : 'Avg steps' },
      { value: b.avgWaterOz != null ? `${fmtInt(Math.round(b.avgWaterOz))} oz` : '–', label: r.span.period === 'day' ? 'Water' : 'Avg water' },
    ]);
  }

  if (r.notes.length) {
    heading(p, 'Notes');
    list(p, '', r.notes.map((n) => ({ left: r.span.period === 'day' ? n.text : `${date(n.date)}: ${n.text}` })));
  }

  // Footer on every page.
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    p.page = pg;
    text(p, `Made ${made} with Training Tracker`, M, 24, 8, { color: MUTE });
    text(p, `${i + 1} / ${pages.length}`, W - M, 24, 8, { color: MUTE, right: true });
  });
  return doc.save();
}
