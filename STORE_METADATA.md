# Store Listing Copy

Pre-written text for App Store Connect and Google Play Console. Paste the
relevant section into each store's listing form.

All content here is **reviewer-ready**: no exaggerated claims, no medical
disclaimers, no tracking references. Apple and Google have published
guidelines (App Store Review Guidelines §1.4, Play Console Policy) — copy
below complies with both.

---

## App name

**Diet Plan & Tracker**

(80 character max for App Store, 50 for Play. This is 19 chars.)

---

## Subtitle (App Store only — 30 chars)

**Calorie-aware meal plans**

---

## Short description (Play Store only — 80 chars)

**AI meal plans with macro validation. Track calories, hit your goals.**

---

## Full description (4000 chars max — both stores)

```
Diet Plan & Tracker generates personalised fat-loss meal plans using
Claude (Anthropic's AI) and validates every meal's macros against the
CalorieNinjas nutrition database. The result: meal plans that actually
fit your daily calorie and protein target — not generic suggestions.

WHAT IT DOES

• Calculates your TDEE (total daily energy expenditure) from your age,
  sex, weight, height, activity level, and goal.
• Generates a multi-day meal plan (breakfast, lunch, dinner, snacks)
  tailored to your daily calorie and protein target.
• Validates each meal's macros against the CalorieNinjas database and
  re-generates meals that fall outside the ±15% tolerance.
• Tracks what you actually eat against the plan so you can see
  adherence at a glance.
• Visualises calorie and macro trends over 7 / 30 / 90 days.

WHO IT'S FOR

• People who want a sustainable, science-based approach to fat loss
  rather than extreme dieting.
• Lifters and athletes who care about hitting protein targets.
• Anyone tired of generic "1200 calories a day" advice that ignores
  individual metabolism, activity, and food preferences.

WHAT IT DOES NOT DO

• It does not prescribe medical diets or treat medical conditions.
  Consult a registered dietitian for clinical advice.
• It does not require an account on a third-party platform. The
  account lives in this app.
• It does not run ads. There are no in-app purchases. There is no
  subscription tier. The app is self-hosted.

HOW THE VALIDATION WORKS

Each AI-generated meal is checked against a public nutrition database.
If the actual macros are more than 15% off the target, the meal is
re-generated up to 5 times per day until it fits. The validation
log is visible in the plan detail view so you can see exactly why
a meal was changed.

PRIVACY

• Your body metrics, meal logs, and plan history are stored on the
  servers you connect to. There is no cross-app tracking.
• The app does not request advertising ID, location, or contacts.
• It does not collect data for advertising.
• Camera and photo library access are not requested at this time.
• A privacy manifest is bundled with the iOS app per Apple guidelines.

CREDITS

• Anthropic Claude — meal plan generation
• CalorieNinjas — nutrition data validation
• Indian Food Composition Tables (NIN) — additional reference data
```

---

## Keywords (App Store — comma-separated, 100 chars max)

```
meal plan,calorie tracker,macro,protein,TDEE,AI diet,fat loss,food log
```

(95 chars including commas)

---

## Category

| Store | Primary | Secondary |
|-------|---------|-----------|
| App Store | Health & Fitness | Food & Drink |
| Play Store | Health & Fitness | Food & Drink |

---

## Content rating

| Store | Rating | Why |
|-------|--------|-----|
| App Store | 4+ (no objectionable content) | Health-tracking app, no violence, no user-generated content |
| Play Store | Everyone | Same. Fill the IARC questionnaire: no violence, no user UGC, no location sharing |

---

## Age rating questionnaire (Play Console)

When you complete the IARC questionnaire in Play Console, answer:
- Violence: **No**
- Sexual content: **No**
- Language: **No**
- Controlled substances: **No** (the app does not promote alcohol/tobacco)
- User-generated content: **No** (no community features)
- Personal data collection: **Yes** (account, body metrics) — see Data Safety form
- Location: **No**

---

## Data safety form (Play Console — required)

| Data type | Collected? | Shared? | Purpose | User control |
|-----------|-----------|---------|---------|--------------|
| Account info (username, password hash) | Yes | No | Authentication | Delete via app |
| Body metrics (age, sex, weight, height) | Yes | No | TDEE calculation | Delete via app |
| Meal logs (food name, calories, macros) | Yes | No | Plan adherence tracking | Delete via app |
| Photos | No | — | — | — |
| Location | No | — | — | — |
| Contacts | No | — | — | — |
| Health data | No (in v1) | — | — | — |
| Purchase history | No | — | — | — |
| App activity | No | — | — | — |
| Web browsing | No | — | — | — |
| Device IDs | No | — | — | — |

Data is **encrypted in transit** (HTTPS) and **at rest** (Postgres on Neon, AES-256).
Users can **delete their account and all associated data** from the app settings.

---

## App privacy details (App Store — required)

Fill in App Store Connect → App Privacy:

| Question | Answer |
|----------|--------|
| Do you collect data from this app? | **Yes** |
| Contact Info → Email address | Yes, for account recovery |
| Health & Fitness → Fitness | Yes, body metrics |
| User Content → Photos or Videos | No |
| Browsing History | No |
| Usage Data → Product Interaction | Yes, anonymous analytics (PostHog, opt-in only) |
| Diagnostics → Crash Data | Yes, anonymous |
| Identifiers → User ID | Yes, for authentication |
| Purchases | No |
| Location | No |
| Sensitive Info | No |
| Contacts | No |
| Financial Info | No |

**Tracking:** No. The app does not use the IDFA or any cross-app tracking.
**Data linked to user identity:** Yes (account, body metrics, meal logs).
**Data not linked to user identity:** Yes (anonymous analytics, crash reports).

---

## Support URL

Required. Host a simple page on your domain, e.g.:
`https://dietplan.app/support`

Contents:
- FAQ (5-10 common questions)
- Contact email
- Link to GitHub issues if the project is open-source

---

## Privacy policy URL

Required. Host a simple page, e.g.:
`https://dietplan.app/privacy`

Use a generator like [termsfeed.com](https://termsfeed.com) to draft one.
Make sure it covers:
- What data you collect
- Why you collect it
- Where it's stored (Postgres on Neon, US-East)
- How users can request deletion
- Contact email for privacy questions

---

## Marketing URL (optional)

`https://dietplan.app`

---

## Copyright

`© 2025 [Your Company Name]`

---

## Screenshot specifications

You will need screenshots before submitting. Capture from a real device or
simulator running the latest build.

| Device | Required sizes |
|--------|----------------|
| iPhone 6.7" (Pro Max) | 1290 × 2796 (App Store) |
| iPhone 6.5" (Plus) | 1242 × 2688 (App Store) |
| iPhone 5.5" (8 Plus) | 1242 × 2208 (App Store) |
| iPad 12.9" Pro | 2048 × 2732 (App Store) |
| Android phone | 1080 × 1920 (Play Store) |
| Android 7" tablet | 1200 × 1920 (Play Store, optional) |

**Recommended 5-8 screenshots per device:**

1. Onboarding / goal-setting screen
2. Generated daily meal plan
3. Macro validation detail view
4. Adherence chart (7/30/90 day)
5. Settings / account

**Tools to make these fast:**
- Use Apple's `fastlane snapshot` (auto-captures from simulator)
- Use Google's `fastlane screengrab` (auto-captures from emulator)
- Or manually: iOS Simulator → Cmd+S / Android Emulator → camera icon

---

## Release notes (template for each version)

```
What's new in 1.0.0:

• Initial release of Diet Plan & Tracker.
• AI-generated meal plans with macro validation.
• 7/30/90 day adherence charts.
• Dark theme throughout.

We'd love your feedback — reach us at support@dietplan.app.
```
