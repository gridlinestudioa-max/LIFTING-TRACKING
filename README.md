# Training Tracker

A 12-week phone app for training for a half marathon while lifting push/pull/legs, with a daily calories in vs out log.
It's built with Expo (React Native) + TypeScript from the web prototype in [`docs/reference-prototype.html`](docs/reference-prototype.html).
The full spec is in [`docs/HANDOFF.md`](docs/HANDOFF.md).

Data is stored only on the phone (AsyncStorage, key `mm_tracker_v1`). There's no account and no cloud sync.

## Layout

| Path | What |
|---|---|
| `src/logic/config.ts` | **Plan constants**: start date, long runs, weekly layout, tempo/easy mile rules, lifts. Edit the plan here. |
| `src/logic/` | Pure TypeScript logic with no React: plan mapping, target weights, day status, time/pace, calories, progress stats, form/submit rules. |
| `src/logic/__tests__/` | Unit tests (covers the HANDOFF test checklist). |
| `src/logic/nutrition.ts`, `diet.ts` | Food log, portions and totals, and diets: fasting windows, presets (keto, vegan, ...) and the on-track checks. |
| `src/logic/profile.ts` | Body stats and suggested daily targets (Mifflin-St Jeor calories; protein, carbs, sugar and fat by diet). Sources are listed at the top of the file. |
| `src/logic/usda.ts`, `src/logic/data/usda-foods.json` | Built-in USDA food list (about 12,900 foods), loaded the first time food search opens. |
| `src/logic/openfoodfacts.ts` | Online search and barcode lookup for branded foods on Open Food Facts. |
| `scripts/build-usda-foods.py` | Rebuilds `usda-foods.json` from USDA downloads (see below). |
| `src/app/` | Screens (expo-router): `index.tsx` = Calendar tab, `food.tsx` = Food tab, `progress.tsx` = Progress tab. |
| `src/ui/` | UI components, theme (light/dark follows the system), and the on-device store. `src/ui/food/` = Food tab sheets. |

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

Your data is saved in that browser on that phone only. Always open it the same way (the Home Screen icon), and don't clear website data for the site, or you'll lose your logs.

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

## Differences from the prototype

- Cloud sync via `window.claude` is dropped (per the handoff). Data stays on the device.
- If you open the app more than 3 weeks after race day, the daily deficit chart shows the plan's last 3 weeks. The prototype showed an empty chart in that case.
- The day detail sits below the calendar grid. Tapping a day scrolls it into view.

## Food data

- **USDA FoodData Central** (public domain), built into the app so it works offline: FNDDS (foods as eaten, with household portions) and SR Legacy (ingredients; baby foods left out). Nutrients are per 100 g, with portions like "1 cup (163 g)".
- **Open Food Facts** (Open Database License): branded and packaged foods, searched online when you tap *Search Open Food Facts* or type a barcode number. It allows about 10 searches a minute per user, so the app never searches as you type. Products you log are saved on the device.
- Food groups used by diets (meat, dairy, grains, ...) are inferred: from USDA categories and ingredient lists, and from Open Food Facts allergens and categories. They're a best guess.

To rebuild the USDA list, download the FNDDS (survey) and SR Legacy JSON zips from https://fdc.nal.usda.gov/download-datasets/, unzip them, then:

```bash
python3 scripts/build-usda-foods.py surveyDownload.json FoodData_Central_sr_legacy_food_json_2018-04.json
```

