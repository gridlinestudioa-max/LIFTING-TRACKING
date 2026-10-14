# Training Tracker

A phone app (and website) for tracking **food**, **cardio** and **lifting**. People sign in, set up a profile, and pick which of the three they use; each is a tab.

- **Food:** a food log with about 12,900 built-in USDA foods plus branded foods from Open Food Facts, calories in and out, diets (fasting, keto, vegan, ...) and suggested daily targets from body stats.
- **Cardio:** log any run, walk, ride, swim or row. Optional plans put workouts on a calendar and track whether each was done: running (maintenance, 5K, 10K, half marathon, marathon), biking (maintenance, 10, 25, 50, 100 miles), swimming (maintenance, 200, 400, 800, 1500 m) and triathlon (sprint, standard, half and full Ironman).
- **Lifting:** plans for 3 to 7 days a week (push/pull/legs, upper/lower, full body, body part split, or custom), built from a library of 700+ exercises, or an unplanned workout any day. Each exercise has sets × a rep range; the app raises the weight when you hit the top of the range on every set (double progression).

Built with Expo (React Native) + TypeScript. The original 12-week prototype is in [`docs/`](docs/).

## Accounts and where data lives

With accounts switched on (see [Set up accounts](#set-up-accounts-supabase)), people sign up with email and password. Their data is saved on the device and synced to their account through Supabase, so it's the same on every phone and browser they sign in on. The newer copy wins when two devices disagree. Without an account (or before accounts are set up), the app works on that device only.

Data saved by the first version of the app (key `mm_tracker_v1`) is brought forward automatically the first time the new version opens: runs, calories, notes, lift days and food all carry over, and push/pull/legs become three routines. The original is kept on the device as `mm_tracker_v1_backup`.

## Layout

| Path | What |
|---|---|
| `src/logic/` | Pure TypeScript, no React. Everything below is unit-tested in `src/logic/__tests__/`. |
| `src/logic/types.ts`, `state.ts`, `migrate.ts` | The saved data (one document per person), loading it safely, and bringing first-version data forward. |
| `src/logic/plans.ts`, `cardio.ts` | The cardio plans (weekly layouts and distances), and sessions, planned workouts, statuses and stats. |
| `src/logic/lifting.ts`, `exercises.ts`, `templates.ts` | Routines, schedule, workouts, double progression; the exercise library; lifting plans (splits × days a week). |
| `src/logic/nutrition.ts`, `diet.ts`, `profile.ts`, `calories.ts` | Food log and totals, diets and on-track checks, body stats and suggested targets, calories in/out. |
| `src/logic/usda.ts`, `openfoodfacts.ts` | The built-in USDA food list, and online search on Open Food Facts. |
| `src/logic/sync.ts` | Which copy wins when the device and the account are compared. |
| `src/logic/data/` | Generated data files: `usda-foods.json`, `exercises.json` (loaded only when needed). |
| `scripts/` | Rebuild the data files from their sources (see below). |
| `src/app/` | Screens (expo-router): `food`, `cardio`, `lifting`, `progress`, `you`. `_layout.tsx` = sign-in, setup, and the tabs. |
| `src/ui/` | Components, theme (light/dark follows the system), the store (`store.tsx`: saving and syncing), accounts (`account.tsx`, `cloud.ts`), sign-in and setup screens. `food/`, `cardio/`, `lifting/` = each tab's sheets. |
| `src/brand.ts`, `assets/brand/` | The app's name and logo (see [Name and logo](#name-and-logo)). |
| `supabase/schema.sql`, `supabase/email-templates/` | The database table and access rules for accounts; branded sign-up and password emails. |

## Develop

```bash
npm install
npm test            # unit tests for src/logic
npm run typecheck
npm run lint
npm start           # starts the Expo dev server and shows a QR code
```

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store or Google Play.
2. On your computer, in this folder: `npm install`, then `npm start`.
3. Phone and computer on the same Wi-Fi:
   - **iPhone:** open the Camera app and scan the QR code in the terminal.
   - **Android:** open Expo Go and tap *Scan QR code*.
4. If the phone can't reach your computer (different network or a work Wi-Fi), run `npx expo start --tunnel` instead.

Expo Go must support this project's SDK version (Expo SDK 57). If Expo Go says the SDK isn't supported, update Expo Go from the store.

## Use it as a website on your phone

The web version is deployed on Vercel from this repo (`vercel.json` runs `npx expo export --platform web` and serves `dist/`).
Every push to the default branch redeploys it.

On your phone, open the site and add it to your Home Screen so it opens full-screen like an app:
- **iPhone (Safari):** Share button → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Add to Home screen* (or *Install app*).

Signed in, your data is saved to your account. Without an account it's saved in that browser on that phone only: always open it the same way (the Home Screen icon), and don't clear website data for the site.

To build the website locally: `npx expo export --platform web`, then serve `dist/`.

## Build an installable version

Builds run in Expo's cloud with **EAS Build**, so you don't need Xcode or Android Studio. You need a free Expo account.

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure    # first time only, links the project to your account
```

**Android (simplest):** this builds an `.apk` you can install directly.

```bash
npx eas-cli@latest build --platform android --profile preview
```

When it finishes, open the link it prints on your phone, download the APK and install it (allow "install unknown apps" if asked).

**iPhone:** requires a paid Apple Developer account ($99/yr).

```bash
npx eas-cli@latest device:create                                   # register your iPhone (one time)
npx eas-cli@latest build --platform ios --profile preview          # ad-hoc build for registered devices
```

Or use `--profile production` and then `npx eas-cli@latest submit --platform ios` to send it to TestFlight.

Bundle ID / package name is `com.trainingtracker.app` (in `app.json`). Change it before your first build if you want your own.

## Set up accounts (Supabase)

Accounts use [Supabase](https://supabase.com) (free tier is enough). Until this is done, the sign-in screen offers "Use without an account" only.

1. Create a project at supabase.com (any name and region). Wait for it to finish setting up.
2. **SQL Editor** → New query → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates the table and the rules that let each person read and write only their own data.
3. Copy the **Project URL** (green **Connect** button, or **Data API**) and the **publishable key** (`sb_publishable_…`, under **Project Settings → API Keys**; older projects call it the **anon / public** key). Never use the secret / `service_role` key.
4. Put them where the app is built:
   - **Vercel** (the website): Project → Settings → Environment Variables → add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then redeploy.
   - **Locally / EAS builds:** copy `.env.example` to `.env` and fill in the two values.
5. **Authentication → URL Configuration**: set **Site URL** to the website's address, and add it with `/**` under **Redirect URLs** (plus `https://*-gridlinestudioa-max.vercel.app/**` for preview builds). Confirmation and password-reset links then open the website already signed in: a confirmation link shows "You're signed in", a reset link asks for a new password.
6. **Emails:** paste the branded templates from [`supabase/email-templates/`](supabase/email-templates/) (steps in its README). For real users, also set up your own email sender (SMTP) there.
7. Optional: **Authentication → Sign In / Providers → Email**. "Confirm email" is on by default (people click a link before their first sign-in); turn it off for instant sign-up.

The publishable (anon) key is safe to ship in the app; the access rules in `schema.sql` are what protect each person's data.

## Name and logo

The app's name, tagline and logo are set in [`src/brand.ts`](src/brand.ts). To add a logo, put a square PNG in `assets/brand/` and point `LOGO` at it; until then a simple mark with the first letter shows. The sign-in screen, setup, welcome page and emails use them. The file lists the other places the name appears (app.json, the web manifest, icons, email templates).

## Food data

- **USDA FoodData Central** (public domain), built into the app so it works offline: FNDDS (foods as eaten, with household portions) and SR Legacy (ingredients; baby foods left out). Nutrients are per 100 g, with portions like "1 cup (163 g)".
- **Open Food Facts** (Open Database License): branded and packaged foods, searched online when you tap *Search Open Food Facts* or type a barcode number. It allows about 10 searches a minute per user, so the app never searches as you type. Products you log are saved on the device.
- Food groups used by diets (meat, dairy, grains, ...) are inferred: from USDA categories and ingredient lists, and from Open Food Facts allergens and categories. They're a best guess.

To rebuild the USDA list, download the FNDDS (survey) and SR Legacy JSON zips from https://fdc.nal.usda.gov/download-datasets/, unzip them, then:

```bash
python3 scripts/build-usda-foods.py surveyDownload.json FoodData_Central_sr_legacy_food_json_2018-04.json
```

## Exercise data

The lifting library is [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, The Unlicense): about 740 lifting exercises with muscles, equipment, instructions and pictures (pictures load from GitHub when you open an exercise). Stretching and cardio entries are left out. People can add their own exercises too.

To rebuild it:

```bash
curl -o exercises.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
python3 scripts/build-exercises.py exercises.json
```

