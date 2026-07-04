# What Our App Knows About Users — Plain-English Data Inventory
### Your cheat-sheet for the Apple "App Privacy" and Google "Data Safety" forms

**Why this document exists:** when you submit the app, both stores make you
fill in a public questionnaire about the personal data the app collects. The
answers appear on your store page for everyone to see, and wrong answers are
grounds for rejection or removal. This document was compiled by reading the
actual code and database structure — it is the truth to copy from. Compiled
1 July 2026; if features change, update this file first, then the store forms.

---

## Part 1 — What the app collects, and why

Think of this as: *"if a user asked 'what do you know about me?', this is the
honest answer."*

### Account basics
| What | Why we need it | Where it lives |
|---|---|---|
| Username / email address | To create the account, log in, and send password-reset emails | Our database (Neon, a cloud Postgres provider) |
| Password | To log in. Stored **scrambled** (bcrypt hashing) — nobody, including us, can read the original | Our database |
| Sign-in via Google or Apple | Optional alternative to a password — we receive the user's verified identity from Google/Apple | Our database (identity reference only) |

### Profile & health details (the sensitive category)
| What | Why we need it | Where it lives |
|---|---|---|
| Name, age, gender | Calorie needs differ by age and sex — used to personalise the plan | Our database |
| Weight, height, target weight, body-fat % | The core inputs for calorie/macro targets and progress tracking | Our database |
| Activity level, health conditions, diet intensity | Adjusts the plan (e.g. sedentary vs athlete) | Our database |
| Food preferences: cuisine, allergies, liked/avoided ingredients, meals per day | So generated meals are safe and to taste | Our database |
| Daily logs: meals eaten, water drunk, weight over time | The tracking features | Our database |
| City / country **as typed by the user** | To localise cuisine suggestions. **Important: the app never uses GPS or asks for the phone's location** — it's just a text box | Our database |

> ⚠️ **This block is "Health & Fitness" data in store language.** Both stores
> treat it as sensitive. You must declare it (instructions in Part 3), and the
> privacy policy already describes it — keep the two in sync.

### Behind-the-scenes
| What | Why | Where |
|---|---|---|
| Usage analytics (which screens are opened, which features used, device type) | To understand what's working in the product | PostHog (a US-based analytics service). Events are tied to the user's account ID after login |
| Crash reports | To find bugs (only active once Sentry is switched on — see readiness guide item 6) | Sentry |
| Login tokens | The "stay signed in" mechanism; stored scrambled on our side | Our database + the user's own device |

### What the app does **not** collect (nice to be able to say)
No GPS location, no contacts, no photos, no camera or microphone access, no
Apple Health / Google Fit reading, no advertising identifiers, no selling of
data, no cross-app tracking.

---

## Part 2 — Which outside companies see any of it

Store forms ask about "sharing with third parties." Here is the complete list
and the honest characterisation of each:

| Company | What they receive | In plain terms |
|---|---|---|
| **Anthropic** (the AI that writes meal plans) | Age, gender, weight, height, goals, allergies, cuisine and calorie targets — as text inside the AI request. **No name, email, or account ID is attached** | "We tell the AI *about an anonymous person's body and tastes* so it can write their menu — we don't tell it who they are" |
| **CalorieNinjas / USDA / OpenFoodFacts** (nutrition lookups) | Only food text, e.g. "80g roti" | No personal data at all |
| **PostHog** (analytics) | Usage events + device info, linked to account ID | Standard product analytics, identified |
| **Google / Apple** (sign-in) | The sign-in handshake only | Only if the user chooses that login method |
| **Unreal Speech** (text-to-speech) | Recipe text to convert into audio | No personal data |
| **Vercel** (server hosting) & **Neon** (database hosting) | All traffic / all stored data respectively | These are your infrastructure landlords ("processors"), not data buyers |

None of these relationships is "selling data" or "advertising use" — you can
truthfully answer **no** to those questions on both forms.

---

## Part 3 — Exactly what to tick in each store form

### Apple — "App Privacy" section (App Store Connect)

**Question: Do you or your partners use data to track users across other
companies' apps/websites?** → **No.** (Nothing in the app does cross-app
tracking; the iOS privacy file already declares `tracking = false`.)

**Data types to declare, all under "Data Linked to You":**
- **Contact Info → Email Address** — purpose: App Functionality
- **Health & Fitness → Health** (weight, body metrics, dietary data) —
  purpose: App Functionality
- **Identifiers → User ID** — purposes: App Functionality + Analytics
- **Usage Data → Product Interaction** (the PostHog events) — purpose:
  Analytics

Everything else ("Data Not Linked to You", "Data Used to Track You") stays
empty.

### Google Play — "Data safety" section (Play Console)

- **Does your app collect or share user data?** → Yes.
- **Data types:**
  - *Personal info → Email address, Name* — collected, not shared, required,
    purpose: account management / app functionality.
  - *Health and fitness → Health info* — collected; **shared** (with the AI
    provider for app functionality — Google's definition of "shared" covers
    sending it to a service provider). Purpose: app functionality.
  - *App activity → App interactions* — collected (PostHog), purpose:
    analytics.
- **Is all data encrypted in transit?** → **Yes** (HTTPS everywhere).
- **Do you provide a way for users to request deletion?** → **Yes** — in-app:
  Profile → Delete Account. Give the privacy-policy URL when asked.
- **Data selling / advertising** → No / No.

### Both stores also ask for:
- **Privacy policy URL** — the `/privacy` page on your official domain
  (see Blocker 2 in the readiness guide).
- **Children:** the app is **not designed for children**; Terms require 13+.
  Pick the "not directed at children" option and a 13+/Everyone rating as the
  questionnaires steer you.

---

## Part 4 — Promises the app already keeps (so you can sign the forms honestly)

- **Deletion really deletes.** The in-app Delete Account flow removes the
  user and all linked records from the database (the privacy policy promises
  completion within 30 days, with backups purged within 90 — matching how the
  hosting works).
- **Passwords are unreadable** even to you (bcrypt hashing).
- **Everything travels encrypted** (HTTPS enforced; unencrypted connections
  were explicitly switched off during the 2026-07-01 audit).
- **The AI never receives names or emails** — only body/diet facts needed to
  write the plan.

If any future feature changes one of these four facts, update this file, the
privacy policy, and both store forms **before** shipping the feature.
