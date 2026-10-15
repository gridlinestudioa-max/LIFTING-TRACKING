# Emailed summaries

People pick **Daily**, **Weekly**, **Monthly** or **Yearly** under Progress → Export → *Email me a summary*.
Every hour, the database calls this function. It emails each summary that's due at about 7 am in the
person's time zone, with the PDF attached. Each summary is sent once, and a period with nothing logged is
skipped. The summary is made from the copy of their data saved to their account.

It sends through [Resend](https://resend.com) (free for 3,000 emails a month). If you already use Resend
as the SMTP sender for sign-up emails, use the same account.

## Set it up (once)

1. **Table:** Supabase → SQL Editor → paste [`../../reports.sql`](../../reports.sql) → Run.
2. **Resend:** add and verify your domain (Resend → Domains), then create an API key (Resend → API Keys,
   "Sending access").
3. **Secrets:** Supabase → Edge Functions → Secrets → add:
   - `RESEND_API_KEY`: the Resend key.
   - `REPORT_FROM`: who it's from, on your verified domain, like `Training Tracker <reports@yourdomain.com>`.
   - `CRON_SECRET`: a long random string you make up (for example from a password manager). Only the
     schedule in step 5 uses it.
   - `APP_URL` (optional): `https://lifting-tracking.vercel.app`, for the link in the email.

   Type these into Supabase directly. Don't paste them into chats or commit them.
4. **Deploy the function**, from this repository on your computer:
   ```bash
   npx supabase login
   npx supabase functions deploy send-reports --project-ref irtefeidnewjbhwhqblm --no-verify-jwt
   ```
   `--no-verify-jwt` is needed because the hourly schedule doesn't sign in. The function checks for itself:
   the schedule must send `CRON_SECRET`, and "Send me one now" must come from a signed-in person, who
   only ever gets their own summary (at most one a minute).
5. **Schedule it:** Supabase → SQL Editor → run this, with your `CRON_SECRET` in place of
   `PASTE_CRON_SECRET`:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule(
     'send-reports',
     '5 * * * *',
     $$ select net.http_post(
          url := 'https://irtefeidnewjbhwhqblm.supabase.co/functions/v1/send-reports',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PASTE_CRON_SECRET'),
          body := '{}'::jsonb
        ) $$
   );
   ```
   To stop it: `select cron.unschedule('send-reports');`

6. **Try it:** in the app, sign in, open Progress → Export, turn on Weekly, and tap *Send me one now*.

## Changing the summary

The summary and PDF code lives in `src/logic/report.ts` and `src/logic/reportPdf.ts`, shared with the
app. `report.js` here is a bundle of it. After changing either file, rebuild it and deploy again:

```bash
node scripts/build-report-bundle.mjs
npx supabase functions deploy send-reports --project-ref irtefeidnewjbhwhqblm --no-verify-jwt
```
