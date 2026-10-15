// What the email function (supabase/functions/send-reports) uses, bundled into one file with
// `node scripts/build-report-bundle.mjs`. Rebuild after changing report.ts, reportPdf.ts or the state shape.

export { normalize } from './state';
export { addDays } from './dates';
export { buildReport, lastFinished, reportEmpty, reportFileName, reportSpan, REPORT_PERIODS, type Report, type ReportPeriod } from './report';
export { reportPdf } from './reportPdf';
export { fmt, fmtInt, sgn } from './format';
