# Data Inventory — Diet Plan & Tracker

Personal-data inventory for the Apple App Privacy "Nutrition Label" and the
Google Play Data Safety form. Compiled 2026-07-01 from the actual code
(`server/src/prisma/schema.prisma`, routes, `client/src/lib/analytics.ts`).
Transcribe each row into both stores' questionnaires.

## 1. Data collected, purpose, storage

| Data | Where collected | Purpose | Stored where | Linked to identity? |
|---|---|---|---|---|
| Username / email address | Signup, Google OAuth, Apple Sign-In | Account creation, login, password reset | Neon Postgres (`User`) | Yes |
| Password (bcrypt hash only) | Signup | Authentication | Neon Postgres | Yes |
| Name, age, gender | Onboarding profile | TDEE / plan personalisation | Neon Postgres (`UserProfile`) | Yes |
| **Health & fitness data**: weight, height, target weight, body-fat %, activity level, health conditions, diet intensity | Onboarding + weight tracking | Calorie/macro targets, goal projection | Neon Postgres (`UserProfile`, `WeightLog`, `TdeeCalculationLog`) | Yes |
| **Dietary data**: meal preference, cuisine, allergies, preferred/avoided ingredients, meal logs, water logs | Onboarding + daily tracking | Meal-plan generation, adherence tracking | Neon Postgres (plans, logs) | Yes |
| Location (coarse, city/country as typed by user) | Onboarding form | Cuisine localisation | Neon Postgres | Yes — user-entered text only; **no device GPS/location permission is requested** |
| Usage analytics (screens, feature events, device info) | PostHog SDK (client) | Product analytics | PostHog US Cloud | Yes (identified by userId after login) |
| Crash/error data | Sentry (client; only if `VITE_SENTRY_DSN` set) | Crash diagnostics | Sentry | Potentially |
| Auth tokens / refresh tokens (hashed) | Login | Session management | Neon Postgres + device localStorage | Yes |

Not collected: device GPS location, contacts, photos, camera, microphone,
Health app / Google Fit data, advertising identifiers.

## 2. Third parties receiving data

| Third party | What is sent | Why | User identity attached? |
|---|---|---|---|
| **Anthropic** (Claude API, server-side) | Profile-derived prompt: age, gender, weight, height, goals, allergies, cuisine, macro targets | Meal-plan generation & correction | No account identifier sent; content is health-related |
| **CalorieNinjas** (server-side) | Ingredient text only (e.g. "80g roti") | Nutrition lookup | No |
| **USDA / OpenFoodFacts** (server-side, fallback) | Food name text | Nutrition lookup | No |
| **PostHog** (client SDK) | Usage events, device metadata, userId | Analytics | Yes |
| **Google** (OAuth) | OAuth identity exchange | Sign-in | Yes |
| **Apple** (Sign in with Apple) | Identity token verification | Sign-in | Yes |
| **Unreal Speech** (server-side TTS) | Recipe/cooking text | Audio guides | No |
| **Vercel** (hosting) / **Neon** (DB) | All server traffic / all stored data | Infrastructure (processors) | Yes |

## 3. Store-form answers (suggested)

**Apple App Privacy — "Data Used to Track You": none.** (PostHog is
first-party analytics, no cross-app tracking; `NSPrivacyTracking=false`
already declared in `PrivacyInfo.xcprivacy`.)

**Apple — "Data Linked to You":** Contact Info (email), Health & Fitness
(weight, dietary data), Identifiers (user ID), Usage Data (product
interaction). Purposes: App Functionality + Analytics.

**Google Play Data Safety:** Collected: Personal info (email/name), Health
info (diet & fitness), App activity. Shared: Health-derived text with AI
provider (Anthropic) for app functionality; analytics with PostHog.
Encrypted in transit: yes (HTTPS everywhere). Deletion mechanism: in-app
account deletion (Profile → Delete Account) — answer "yes" to the deletion
question and link the privacy policy.

**Health-data sensitivity note:** diet + body metrics are "Health &
Fitness" data on both stores. Neither store forbids it, but both require
the privacy policy to explicitly cover it — `/privacy` (served by
`server/src/routes/pages.ts`) already describes collection, retention
(30/90 days post-deletion), and user rights. Keep that page in sync with
this inventory.

**Children:** app is not directed at children; Terms require users to be
13+. Select 13+ / "not directed at children" in both stores' questionnaires.
