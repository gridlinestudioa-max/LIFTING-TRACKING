// Your app's name and logo, in one place. Change them here and the sign-in screen, setup, welcome page and
// You tab all follow. Also update (they can't read this file):
//   - app.json: "name", and web "name" / "shortName" (home screen and store name)
//   - public/manifest.webmanifest and public/index.html (apple-mobile-web-app-title)
//   - assets/icon.png, assets/favicon.png and public/*.png (app icons)
//   - supabase/email-templates/*.html (the name in emails)

import type { ImageSourcePropType } from 'react-native';

export const BRAND = {
  /** Full name, shown on the sign-in screen and in headings. */
  name: 'Training Tracker',
  /** Short name, for tight spots. */
  shortName: 'Training',
  /** One line under the name on the sign-in screen. */
  tagline: 'Track food, cardio and lifting. Use one, two or all three.',
};

/**
 * Your logo. Put the file in assets/brand/ (a square PNG, at least 256 × 256, transparent background works best)
 * and point to it, e.g.:
 *   export const LOGO: ImageSourcePropType | null = require('../assets/brand/logo.png');
 * Leave it null to show a simple mark made from the app's initial.
 */
export const LOGO: ImageSourcePropType | null = null;
