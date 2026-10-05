# Training Tracker: handoff for Claude Code

Turn the working web prototype (`reference-prototype.html`, a single self-contained HTML file) into a phone app.
The prototype is the source of truth for behavior and visuals. Open it in a browser to see how it works.
All logic is in the `<script>` block at the bottom.

## Prompt to paste into Claude Code

> Read HANDOFF.md and reference-prototype.html in this folder. Build this as an iOS/Android app with
> Expo + React Native + TypeScript, matching the prototype's behavior exactly. Put all plan, status, pace,
> and calorie logic in a pure TypeScript module (`src/logic/`) with unit tests, separate from the UI.
> Store data on-device. Don't add features that aren't in the spec without asking. When done, tell me
> how to run it on my phone (Expo Go) and how to build an installable version.

## Recommended stack
- **Expo (React Native) + TypeScript**, expo-router with two tabs: **Calendar** and **Progress**.
- `react-native-svg` for the bar/line charts (the prototype draws them as plain SVG).
- `@react-native-async-storage/async-storage` (or MMKV) for persistence. One JSON blob is fine.
- Light and dark mode, following the system setting.
- Faster alternative if wanted: wrap the prototype with Capacitor. A native rebuild is preferred.

## What the app is
A 12-week tracker for one person training for a half marathon ("mini marathon") while lifting
push/pull/legs, with a daily calories in vs out log to confirm a deficit. Units are miles and lb.

## The plan (hard-coded, week 1 starts on `start`, a Monday)
Default `start` = **2026-10-05** (editable; any chosen date snaps back to that week's Monday).
Plan covers 84 days (12 weeks). Race day = `start + 83 days` (a Sunday).

Weekly layout, Monday to Sunday:

| Day | Type |
|---|---|
| Mon | Push |
| Tue | Tempo run |
| Wed | Pull |
| Thu | Legs |
| Fri | Easy run |
| Sat | Rest |
| Sun | Long run |

Planned run miles:
- **Long run by week (1 to 12):** 7, 8, 9, 7, 10, 11, 8, 12, 10, 8, 6, 13.1 (week 12 Sunday is **Race day**).
- **Easy run:** 3 mi, except week 12 = 2 mi.
- **Tempo run:** 3 mi in weeks 1 to 4, 4 mi in weeks 5 to 9, 3 mi in weeks 10 to 12.

## Lifting
Each lift has `w` (week 1 weight, already the first bump), `inc` (bump size), and `unit`.
**Target weight for week index `w` (0-based) = base + inc * floor(w / 3)**, so weights go up in weeks 4, 7 and 10.
`base` is user-editable per lift (the W1 cell in the progression table) and everything else recalculates.

Push (order shown): Tricep extension 3x15, 35 lb, +5 · Dumbbell bench (each hand) 3x8, 45, +5 ·
EZ bar skull crushers 3x15, 35, +5 · Pec deck 3x10, 100, +5 · Shoulder press 3x10, 40, +5

Pull: Seated cable row wide 3x10, 110, +5 · Biceps cable 3x12, 50, +2.5 · Lat pulldown cable 3x10, 110, +5 ·
Bicep curls 3x10, 35, +5 · Face pulls / rear delt fly 3x15, 85, +5

Legs: Leg press 3x8, 7 **plates (PL)**, +1 · Romanian deadlift 3x10, 65, +5 · Leg curl 3x10, 120, +5 · Leg extension 3x10, 130, +5

## Calendar screen
- Month grid, **Monday-first**, prev/next month. Each day cell shows: day number, a colored tag (Push, Pull, Legs, Tempo, Easy, Long, Rest; "RACE" on race day),
  planned miles for run days (replaced by logged miles once submitted), `n/total` for partially logged lift days, and a small calorie dot (green deficit, red surplus) when both calorie numbers are logged.
- Tag colors: push coral, pull blue, legs purple, tempo amber, easy green, long teal, rest gray.
- **Day status** (only *submitted* logs count):
  - `done` (green cell + green ✓ top-right): lift day = every exercise checked; run day = logged miles >= 90% of planned.
  - `partial` (amber cell + ◐): the day has passed and some but not all was done (some lifts checked, or run > 0 but < 90%).
  - `missed` (red cell + ✕): the day has passed and nothing was done.
  - `open`: today or a future day not yet done, with no color. Today's number is bold/accent. Selected day gets an outline.
  - Rest days are always neutral. **Calories never affect status.**
- Tapping a day opens a detail panel below the grid (bottom sheet is fine on phone).

## Day detail panel
Always shows the scheduled workout first (day, week number, type chip, status badge), then the log form, then **Submit**.
- **Lift day:** a "Scheduled" box listing each exercise with sets and that week's target weight. Below it, one row per exercise: checkbox plus weight field (prefilled with the target, unit shown).
- **Run day:** a "Scheduled" box with planned miles and a tip (long: slow and conversational; tempo: comfortably hard or intervals; easy: relaxed; race: start easy). Fields: **Miles** and **Time**.
  Time accepts `58` (minutes), `58:30` (m:ss), or `1:58:30` (h:mm:ss), is stored as seconds, and is reformatted on blur.
  **Pace** (min/mi, `m:ss /mi`) = seconds / miles, shown live as the user types.
- **Rest day:** "Rest day. Bike commute only, no extra training."
- **Calories (every day, including rest):** `In (eaten)` and `Out (total burned)`. Hint: "Out = your watch or Health app total for the whole day (resting burn + activity)."
  Live result: **Deficit: N kcal** (green) when out - in >= 0, else **Surplus: N kcal** (red). If a goal is set and it's a deficit, append "· goal met ✓" or "· N short of goal".
- Notes textarea.
- **Submit / Update button.** Edits are drafts (kept in memory per date, not persisted) until Submit; the panel shows "Not submitted yet" while a draft exists and "Submitted ✓" right after.
  Nothing on the calendar or Progress changes until Submit. After the first submit the button reads **Update**.
  Validation: run day needs miles *or* calories; rest day needs calories; lift day can be submitted with anything.

## Progress screen
1. Stats: sessions completed / sessions planned so far (planned = non-rest days up to today that are past or done), missed or partial count, total miles logged, longest run, average pace (total seconds / total miles over runs that have a time), lifting sessions completed.
2. **Long run chart:** bar per week, dashed outline = planned, solid = logged (the Sunday run).
3. **Weekly running miles chart:** same style, sum of all runs that week.
4. **Calories: in vs out**
   - Stats: average daily deficit (negative = surplus), total deficit, days logged, days at or above goal (or days in a deficit if no goal).
   - Optional daily deficit **goal** input (kcal). No default value.
   - **Daily deficit bars:** ~last 3 weeks (window ends today; if fewer than 14 days since start, show start + 14 days; clamp to plan end). Green above the zero line = deficit, red below = surplus, dashed line = goal, day-of-month labels.
   - **Cumulative deficit** line over logged days (needs >= 2 days) with the latest total labeled.
   - **By week** table: days logged, average in, average out, average deficit (only weeks with data).
5. **Lifting progression table:** all lifts by 12 weeks, current week highlighted, bump weeks (W1, W4, W7, W10) marked, W1 column editable.
6. **Logged weights:** per lift, a sparkline and last logged weight (checked entries only).
7. **Plan start** date picker (snaps to Monday) and a "Race day" label.

A calorie "net" is always `out - in` (positive = deficit).

## Data model (one JSON object)
```json
{
  "start": "2026-10-05",
  "goal": null,
  "base": { "tri": 35, "bench": 45, "skull": 35, "peck": 100, "ohp": 40,
            "row": 110, "bicable": 50, "lat": 110, "curl": 35, "face": 85,
            "lpress": 7, "rdl": 65, "lcurl": 120, "lext": 130 },
  "logs": {
    "2026-10-05": {
      "submitted": true,
      "lifts": { "tri": { "w": 35, "done": true } },
      "cin": 2200, "cout": 2700, "note": "felt good"
    },
    "2026-10-11": { "submitted": true, "miles": 7, "secs": 4200, "cin": 2300, "cout": 3000 }
  }
}
```
Only submitted logs are stored. Drafts are in-memory only. Dates are local `YYYY-MM-DD` strings.
Prototype storage key is `mm_tracker_v1`. In the claude.ai artifact it also syncs via a per-user db doc; **drop that part**,
since `window.claude` only exists inside claude.ai.

## Notes
- The prototype's "Scheduled" workout never changes when something is logged. Keep the schedule visible next to what was done.
- Respect safe areas (notch, home indicator) and use large tap targets on the calendar.
- Keep the plan constants (`LONG`, `LIFTS`, day order, mile rules) in one config file so they're easy to change.
- Possible later additions, **only if asked**: reminders, export to CSV, cloud sync, Apple Health / Google Fit import for calories out.

## Test checklist
- Plan mapping: 2026-10-05 is Push, week 1; 2026-10-11 is a 7 mi long run; 2026-12-27 is race day (13.1).
- Target weights: shoulder press 40/45/50/55 in weeks 1/4/7/10; leg press 7/8/9/10 plates; biceps cable 50/52.5/55/57.5.
- Pace: 3 mi in `27:30` gives `9:10 /mi`; time input `58` is 58 minutes.
- Status: lift day all checked gives done; 2 of 5 checked on a past day gives partial; run of 2.7 of 3 mi gives done (90% rule); past day with nothing gives missed; unsubmitted drafts change nothing.
- Calories: in 2200, out 2700 gives Deficit 500; with goal 400 it shows "goal met ✓"; in 2500, out 2400 gives Surplus 100.
