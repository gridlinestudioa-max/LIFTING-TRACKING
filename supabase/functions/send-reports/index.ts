// Emails PDF summaries (day, week, month or year) to people who asked for them in the app.
//
// Called two ways:
//  - Every hour by the database schedule (pg_cron), with the x-cron-secret header: sends every summary that's
//    due, at each person's chosen local hour, once each.
//  - From the app ("Send one now"), with the person's sign-in token: sends them their latest summary.
//
// Secrets (Supabase -> Edge Functions -> Secrets): RESEND_API_KEY, REPORT_FROM, CRON_SECRET, and optionally
// APP_URL. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. See README.md here.
// Deno runtime.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

import * as R from './report.js';

type Period = 'day' | 'week' | 'month' | 'year';
const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
const EVERY: Record<Period, string> = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };

/** A summary from report.js (src/logic/report.ts has the full shape). */
// deno-lint-ignore no-explicit-any
type Report = { span: { period: Period; title: string; from: string } } & Record<string, any>;

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('REPORT_FROM') ?? '';
const CRON = Deno.env.get('CRON_SECRET') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? '';

/** Most emails sent in one hourly run. */
const PER_RUN = 200;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Today's date and the hour in a time zone. */
function local(tz: string, now = new Date()): { today: string; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

/** A short HTML email: the main numbers, with the full summary attached as a PDF. */
function emailHtml(r: Report): string {
  const rows: [string, string][] = [];
  const c = r.calories;
  if (c?.daysLogged) {
    if (c.avgNet != null) rows.push([r.span.period === 'day' ? 'Calorie deficit' : 'Avg daily deficit', `${R.sgn(Math.round(c.avgNet))} kcal`]);
    if (c.avgIn != null) rows.push([r.span.period === 'day' ? 'Eaten' : 'Avg eaten', `${R.fmtInt(Math.round(c.avgIn))} kcal`]);
  }
  if (r.cardio?.count) rows.push(['Cardio', `${r.cardio.count} ${r.cardio.count === 1 ? 'activity' : 'activities'}${r.cardio.miles ? `, ${R.fmt(Math.round(r.cardio.miles * 10) / 10)} mi` : ''}`]);
  if (r.lifting?.workouts) rows.push(['Lifting', `${r.lifting.workouts} ${r.lifting.workouts === 1 ? 'workout' : 'workouts'}, ${R.fmtInt(r.lifting.sets)} sets`]);
  if (r.lifting?.prs.length) rows.push(['Personal records', String(r.lifting.prs.length)]);
  if (r.body?.weightFrom != null) rows.push(['Weight', `${R.fmt(r.body.weightTo ?? r.body.weightFrom)} lb`]);
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:#6b6b75;border-bottom:1px solid #eee">${esc(k)}</td><td style="padding:8px 0;text-align:right;font-weight:700;border-bottom:1px solid #eee">${esc(v)}</td></tr>`)
    .join('');
  const open = APP_URL ? `<a href="${esc(APP_URL)}" style="color:#fc4c02">Open Training Tracker</a>. ` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17171c">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#1a1a1f;border-bottom:4px solid #fc4c02;border-radius:12px 12px 0 0;padding:20px 24px;color:#fff">
<div style="font-size:13px;color:#ccc">Your ${EVERY[r.span.period]} summary</div>
<div style="font-size:24px;font-weight:800;margin-top:4px">${esc(r.span.title)}</div></div>
<div style="background:#fff;border-radius:0 0 12px 12px;padding:16px 24px 24px">
${rows.length ? `<table style="width:100%;border-collapse:collapse;font-size:15px">${table}</table>` : '<p style="color:#6b6b75">Nothing was logged in this period.</p>'}
<p style="font-size:14px;color:#6b6b75;margin-top:16px">The full summary, with charts, is attached as a PDF.</p></div>
<p style="font-size:12px;color:#8a8a93;margin-top:16px">${open}You asked for these emails. To stop them, go to Progress → Export in the app and turn them off.</p>
</div></body></html>`;
}

async function sendReport(admin: SupabaseClient, userId: string, email: string, period: Period, today: string): Promise<'sent' | 'empty' | 'nodata'> {
  const { data: row } = await admin.from('tracker_data').select('data').eq('user_id', userId).maybeSingle();
  if (!row?.data) return 'nodata';
  const state = R.normalize(row.data);
  const span = R.lastFinished(period, today);
  const report: Report = R.buildReport(state, span, today);
  if (R.reportEmpty(report)) return 'empty';
  const pdf = await R.reportPdf(report, R.reportSpan('day', today).title);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `Your ${EVERY[period]} summary: ${span.title}`,
      html: emailHtml(report),
      attachments: [{ filename: R.reportFileName(report), content: encodeBase64(pdf) }],
    }),
  });
  if (!res.ok) throw new Error(`Email service: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return 'sent';
}

async function emailOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** Hourly: everything due. */
async function runSchedule(admin: SupabaseClient) {
  const { data: subs, error } = await admin.from('report_subscriptions').select('user_id, periods, tz, hour, last_sent').neq('periods', '{}');
  if (error) throw error;
  let sent = 0;
  let checked = 0;
  for (const s of subs ?? []) {
    if (sent >= PER_RUN) break;
    const { today, hour } = local(s.tz);
    if (hour < s.hour) continue;
    const last = (s.last_sent ?? {}) as Record<string, string>;
    const due = (s.periods as Period[]).filter((p) => PERIODS.includes(p) && last[p] !== R.lastFinished(p, today).from);
    if (!due.length) continue;
    checked++;
    let email: string | null = null;
    try {
      email = await emailOf(admin, s.user_id);
    } catch (e) {
      // One account's problem shouldn't stop everyone else's emails.
      console.error('no email for', s.user_id, String(e));
      continue;
    }
    const next = { ...last };
    for (const p of due) {
      try {
        if (email && (await sendReport(admin, s.user_id, email, p, today)) === 'sent') sent++;
        // Marked done even when there was nothing to send, so it isn't tried again every hour.
        next[p] = R.lastFinished(p, today).from;
      } catch (e) {
        console.error('send failed', s.user_id, p, String(e));
      }
    }
    await admin.from('report_subscriptions').update({ last_sent: next }).eq('user_id', s.user_id);
  }
  return { checked, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (!SB_URL || !SERVICE) return reply(500, { error: 'Supabase settings are missing.' });
  if (!RESEND || !FROM) return reply(503, { error: 'Email isn’t set up yet (RESEND_API_KEY and REPORT_FROM).' });
  const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  if (CRON && req.headers.get('x-cron-secret') === CRON) {
    try {
      return reply(200, await runSchedule(admin));
    } catch (e) {
      console.error(e);
      return reply(500, { error: 'Run failed.' });
    }
  }

  // "Send one now" from the app, for the signed-in person only.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user?.email) return reply(401, { error: 'Sign in first.' });
  let body: { period?: string; tz?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body.
  }
  const period = PERIODS.includes(body.period as Period) ? (body.period as Period) : 'week';
  const { data: sub } = await admin.from('report_subscriptions').select('last_test, tz').eq('user_id', user.id).maybeSingle();
  if (sub?.last_test && Date.now() - new Date(sub.last_test).getTime() < 60_000) return reply(429, { error: 'Wait a minute before sending another.' });
  await admin.from('report_subscriptions').upsert({ user_id: user.id, last_test: new Date().toISOString() }, { onConflict: 'user_id' });
  const { today } = local(typeof body.tz === 'string' ? body.tz : (sub?.tz ?? 'UTC'));
  try {
    const r = await sendReport(admin, user.id, user.email, period, today);
    if (r === 'nodata') return reply(200, { result: r, message: 'Nothing is saved to your account yet. Sign in on this device so your data syncs, then try again.' });
    if (r === 'empty') return reply(200, { result: r, message: 'Nothing was logged in that period, so there’s nothing to send.' });
    return reply(200, { result: r, message: `Sent to ${user.email}.` });
  } catch (e) {
    console.error(e);
    return reply(502, { error: 'Couldn’t send the email. Check the email settings (RESEND_API_KEY and REPORT_FROM).' });
  }
});
