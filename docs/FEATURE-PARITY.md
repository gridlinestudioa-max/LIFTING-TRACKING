# Fitbit and Strava, compared

The goal: one app that covers what people use Fitbit and Strava for, that costs less, is easier to use, and treats data more carefully. This page lists what those apps offer, what this app does, and what's still missing. It's a working document: update the status column as things ship.

Competitor details come from the public sources listed at the end and were checked in October 2026. Both companies change plans and prices often, so check before quoting any of it.

## How it compares

| Area | Strava / Fitbit | This app | Status |
|---|---|---|---|
| Record a run, ride or walk with GPS | Strava: yes, with maps and splits | Recorder with route map, live distance, mile splits | Done |
| Log an activity by hand | Both | Distance, time, pace, elevation, heart rate, calories, notes, how hard it felt | Done |
| Activity stats: totals by week, month, year, all time; averages; records; best efforts | Strava: free for the basics | Same, per sport, in the Progress tab | Done |
| Training plans | Paid tiers on both | Running, biking, swimming and triathlon plans, free | Done |
| Fitness and fatigue trend | Strava: paid (Fitness and Relative Effort) | Effort per session, weekly effort, fitness and fatigue lines, free. Our own estimate, not Strava's formula | Done |
| Import activities from other apps | Strava: upload files from a device | GPX and TCX import with preview and duplicate skipping | Done (FIT not yet) |
| Export your data | Both offer some form of export | One tap: JSON of everything, CSV for activities, food and body log, GPX per route | Done |
| Calories and nutrition log | Fitbit: food log | 12,900 built-in USDA foods, Open Food Facts search, full macros, meals, copy from yesterday, tally items, diets | Done |
| Calories burned | Fitbit: from its own devices | Estimate from profile and workouts, or typed in from a watch | Done (no device sync) |
| Weight, water, sleep, steps | Fitbit: yes, from its devices | Entered by hand, with trends and averages; optional Home cards | Partial: manual entry only |
| Lifting log and plans | — | Plans for 3 to 7 days, 700+ exercises, automatic weight progression | Done |
| Friends and leaderboards | Strava: social feed, kudos, segments | Friends by phone contact, friend profiles with chosen cardio, lifting and food stats, leaderboards for run, ride, swim; personal cardio records | Partial: no feed, kudos or comments |
| Connect a watch or phone health data | Fitbit: its own devices; Strava: syncs from most | Not yet | Not done |
| Privacy controls | Strava: privacy zones, visibility settings | Routes are never shared. Plain-language "where your data lives" panel. Delete account | Partial: see below |
| Price | Both have paid tiers for the features above | Free to use | n/a |

## Where this app is different on purpose

- **Nothing important is behind a paywall.** Training plans, the fitness trend, exports and stats are all included.
- **Your data leaves easily.** Everything exports in open formats, and deleting an account removes the stored data, not just the sign-in.
- **You choose what's shared.** Friends see a name plus whichever summaries you turn on: cardio totals and bests (on by default), lifting counts and top lifts, and 7-day food averages. Routes, meals, weight and notes stay private. There's no feed to opt out of.
- **No ads or tracking code** in the app, and the app says in plain words which third-party services it calls: OpenStreetMap for map tiles, Open Food Facts for branded food searches, and GitHub for exercise pictures. The USDA food data is built in.

### What this app does not do (be honest about it)

- The account copy is protected by access rules, not end-to-end encryption. Whoever runs the database could technically read it. The app says this on the You tab.
- Whoever publishes the app has to write their own privacy policy and promises. The in-app text only describes what the code does today. It makes no promise about the future, and none about how the operator handles the database.
- Effort, fitness and fatigue are estimates built from published training-load ideas (Edwards' heart-rate zones, Foster's session RPE, the Banister model). They aren't Strava's numbers and shouldn't be compared with them. They're a rough guide, not medical advice.

## Roadmap

In rough order of value for effort:

1. **Health data sync (Apple Health, Health Connect).** The biggest gap against Fitbit: steps, sleep, heart rate and workouts without typing. Needs native modules, so it needs development builds (not Expo Go) and testing on real phones. Plan: read-only at first, ask for each data type separately, store only what the app shows.
2. **FIT file import.** Garmin and many watches export FIT. Needs a binary parser and careful size limits.
3. **Steps and sleep feeding calorie burn and readiness.** Today they're shown, not used.
4. **Restore from a JSON export.** Left out for now because a restore can overwrite newer data. It needs a preview and a merge rule.
5. **Social extras:** kudos, comments and challenges, kept opt-in. If routes are ever shared, add privacy zones (hide start and end points) before launch.
6. **Segments.** Strava's best-known feature. Needs shared map data, so it conflicts with the less-is-shared goal. Decide on purpose before building.
7. **Optional end-to-end encryption** of the account copy, with the trade-off that a forgotten password can't recover the data.

## Sources

- [Strava free vs paid](https://biketips.com/strava-free-vs-paid/)
- [Strava run activity pages](https://support.strava.com/hc/en-us/articles/216919567-Run-Activity-Pages)
- [Fitbit app redesign and free features (9to5Google, March 2026)](https://9to5google.com/2026/03/31/fitbit-app-redesign-free/)
- [Fitbit Premium vs free](https://wearablebeat.com/articles/fitbit-premium-vs-free-is-the-subscription-worth-it/)
- [Strava privacy settings (Tom's Guide)](https://tomsguide.com/wellness/fitness/how-to-adjust-your-strava-privacy-settings)
- [Fitbit daily readiness score (Android Central)](https://www.androidcentral.com/what-fitbit-daily-readiness-score-and-how-do-i-use-it)

The sources disagree on whether the readiness score is free or Premium (an older article says Premium, a 2026 one says more is free). Treat that row as unsettled.
