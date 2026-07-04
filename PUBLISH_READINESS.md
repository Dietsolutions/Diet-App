# Getting Diet Plan & Tracker into the App Store and Play Store
### A plain-English readiness guide

**Audit date:** 1 July 2026.
**Who this is for:** you, the app owner — no technical background assumed.
**The one-line verdict:** your app's *code* is in good shape. Almost everything
left is *paperwork, accounts, and one-time setup* — the kind of thing only you
(as the account owner) can do. This document explains every item: what it is,
why the stores care, and exactly what to do about it.

---

## How app publishing works (60-second primer)

Think of the two app stores as very strict landlords:

1. **You need an identity.** Apple and Google only accept apps from registered
   developers. That means paid developer accounts in your name/company.
2. **Your app must be "signed."** Signing is a digital wax seal that proves the
   app really came from you and wasn't tampered with. It uses secret files
   (certificates / keystores) that only you should hold.
3. **You must declare what data you collect.** Both stores make you fill in a
   public "privacy questionnaire" about what personal data your app touches.
   Lying or forgetting things gets apps rejected or removed.
4. **A human reviewer will use your app.** If anything looks broken, dead-ends,
   or scary during their 10-minute test, you get rejected and must resubmit.

Everything below is in service of those four facts.

---

## ✅ Good news first: what's already done

You don't need to touch any of this — it was either already built or fixed
during this audit. Listed so you know it's covered:

| Thing the stores check | Status | What it means in plain English |
|---|---|---|
| Passwords stored safely | ✅ Done | Passwords are scrambled ("hashed") — even we can't read them. |
| Connections encrypted | ✅ Done | All traffic between the app and server uses HTTPS (the padlock). |
| Server protected against common attacks | ✅ Done | Standard protective layers (security headers, request limits, safe database queries) are in place. |
| No secret keys leaked in the code | ✅ Verified | We scanned the entire codebase — no API keys or database passwords are exposed anywhere public. |
| "Delete my account" button | ✅ Done | Apple **requires** that users who can sign up can also delete their account inside the app. Yours can (Profile → Delete Account). |
| Privacy Policy & Terms of Service | ✅ Done | Written and shown inside the app. Both stores demand these. |
| Apple privacy manifest | ✅ Done | A technical file Apple requires that declares data collection. Already present and accurate. |
| App icons & splash screens | ✅ Done | All required sizes exist for both platforms. |
| Age policy | ✅ Done | Terms require users to be 13+, which keeps you clear of children's-privacy laws. |
| Unnecessary phone permissions | ✅ Fixed in this audit | The Android app was asking for alarm/notification permissions it no longer uses (left over from a removed feature). Removed — reviewers dislike apps that ask for more than they need. |
| Insecure-connection setting | ✅ Fixed in this audit | A leftover developer convenience setting ("allow unencrypted traffic") was switched off. |

---

## 🔴 The 5 blockers — must be done before you can submit

These are ordered by lead time: start #1 and #2 today because they involve
waiting on other people/companies.

### Blocker 1 — Developer accounts and "signing keys"
**What it is:** the identity + wax seal from the primer above.
**Why it blocks you:** without these, the app literally cannot be uploaded.

What to do, step by step:
1. **Apple:** enrol in the *Apple Developer Program* at developer.apple.com
   ($99/year). Use the Apple ID you want to own the app long-term. Approval
   can take a few days, especially for a company account.
2. **Google:** create a *Google Play Console* account at play.google.com/console
   ($25, one-time).
3. **Android signing key:** the app needs a "keystore" — a small secret file
   that signs every Android release. There is a ready-made script in your
   project (`scripts/generate-android-keystore.sh`) that creates it. **Treat
   the file and its password like a house deed: back it up somewhere safe
   (password manager + offline copy). If you lose it, you can lose the ability
   to update your app.** Enrolling in "Play App Signing" (an option during
   first upload) makes Google keep a safety copy — say yes to that.
4. **iOS signing:** Apple's version is a "distribution certificate +
   provisioning profile." Your project already contains automation ("fastlane
   match") that creates and manages these — a developer session of 1–2 hours,
   with your Apple account logged in, sets it up once and then it's automatic.

**Effort:** mostly waiting + ~2–4 hours of setup. **Cost:** $99/yr + $25 once.

### Blocker 2 — Decide your app's official web address (domain)
**What it is:** your app and its paperwork refer to a website domain
(currently a mix of `dietplan.app` and a temporary `…vercel.app` address).
The stores need **one consistent, real address** because:
- Both store listings must show a **Privacy Policy link** and a **support
  link** that reviewers actually click.
- The Android app claims it can open `dietplan.app` links ("App Links") — but
  for that claim to verify, a small proof file must exist on that website. It
  doesn't yet, so the claim currently fails silently.

What to do:
1. Decide: is `dietplan.app` your real domain? If yes, buy/renew it and point
   it at your existing website hosting. If no, pick the domain you do own.
2. Make sure these pages work on that domain: `/privacy`, `/terms`, and some
   way to contact support (even a simple email link). The pages already exist
   in your backend — this is about serving them from the *official* address.
3. Ask a developer (or me) to publish the small "proof file"
   (`assetlinks.json`) on that domain — 30 minutes of work — **or** remove the
   App-Links claim from the Android app for version 1 (also quick).

**Effort:** 1–2 hours once you've decided the domain.

### Blocker 3 — Fix the auto-publish pipeline for your backend — ✅ RESOLVED (4 July 2026)
**What it was:** your app's "brain" (the server) lives on Vercel. Every code
change should automatically go live, but that automation was broken — the live
server was once running 8-day-old code while fixes sat unused.

**How it was fixed:** you disconnected and reconnected the GitHub repository in
the Vercel dashboard (Settings → Git). We then **verified it end-to-end**: a
test change was pushed to GitHub and appeared on the live site within about a
minute, with no manual publishing. (The test left a harmless marker file at
`/version.txt` on the site — it doubles as a quick way to check what's
deployed.)

**Nothing more to do here.** From now on, anything pushed to GitHub goes live
by itself.

### Blocker 4 — Fill in the store questionnaires
**What it is:** both stores make you answer a public questionnaire about the
data your app collects (Apple calls it "App Privacy", Google calls it "Data
Safety"). They also make you answer a content-rating quiz (violence? gambling?
— for you it's all "no", expect an "Everyone"/4+ rating).

**The good news:** the hard part — figuring out *what* your app actually
collects — is already done. Open **`DATA_INVENTORY.md`** (rewritten in plain
English alongside this file). It tells you, question by question, what to
tick. Budget 1–2 careful hours per store. Do not guess or under-declare:
your app handles **health-related data** (weight, diet), and both stores are
strict about that category.

Also prepare for the human reviewer:
- A **demo account** (username + password) that already has a generated meal
  plan, written into the "review notes" box on both stores. Notes already
  drafted in `STORE_REVIEW_NOTES.md`.

### Blocker 5 — Produce one real "release build" per platform and test it
**What it is:** so far the app has only run in developer/simulator mode. A
"release build" is the actual sealed package that goes to the store. The first
one *always* surfaces surprises (wrong version numbers, signing hiccups), so
it must happen before you plan a launch date.

What to do (a developer task — I can drive it once Blockers 1–2 are done):
1. Build the iOS release and upload to **TestFlight** (Apple's private testing
   channel). Install it on your own iPhone and use the app end-to-end.
2. Build the Android release and upload to Play's **Internal testing** track.
   Same drill on an Android phone.
3. One important technicality your developer must respect: the release must be
   built with the *production server address baked in* — there is a specific
   build command documented in the project for this. (An app pointed at the
   wrong server is the single most common "it worked on my machine" failure.)

**Effort:** roughly half a day including fixing whatever the first run reveals.

---

## 🟠 Should do before launch (won't block review, will hurt you live)

### 6. Turn on crash reporting (30 minutes)
Right now, if the app crashes on a stranger's phone, **you will never know**.
The app already contains the wiring for a free service called Sentry — it just
needs an account and one setting filled in. Sign up at sentry.io (free tier is
fine), create a project, and give the "DSN" value it shows you to whoever does
the release build.

### 7. Make AI failures speak human (1 hour, code)
Your meal plans are generated by an AI service (Anthropic) that has a monthly
usage allowance. We hit that limit during testing and the app showed a vague
"Failed to generate meal plan. Please try again." — which is a dead end.
Two-part fix:
- **Code:** show an honest message like "Our meal-plan service is busy —
  please try again in a few hours."
- **You:** before submitting to the stores, check your Anthropic account has
  plenty of allowance left. **If reviewers hit that limit during review, the
  app's core feature fails in front of them and you will be rejected.**

### 8. Update a few aging software components (1–2 hours, code)
The automated scan found 4 known vulnerabilities in third-party components the
app uses (2 rated "high" on the server, 2 in the app). None of them is
exploitable in the way your app uses them, and none blocks store approval —
but they're the software equivalent of a recalled part: replace at the next
convenient moment. A developer runs one command (`npm audit fix`) in two
folders and re-tests signup emails + plan generation.

### 9. A real-phone quality pass (2–4 hours, you can do this)
Before submitting, spend an afternoon using release builds like a fussy
stranger would:
- Turn on **airplane mode** mid-use — does the app show a polite "you're
  offline" message, or a blank/broken screen? (Blank screens are a classic
  rejection reason.)
- Force-quit and reopen. Log out and back in. Create an account, delete it.
- Generate a plan on mobile data, not just Wi-Fi.
Write down anything weird and hand the list to me/your developer.

---

## 🟢 Nice-to-have (after version 1 is live)

- **Sturdier rate-limiting storage** — a technical upgrade that matters only
  once you have many users.
- **Three cosmetic build warnings** — harmless, but tidy code is cheaper to
  maintain.
- **iPad-friendly layouts** — or simply tell Apple the app is iPhone-only (a
  checkbox) to avoid iPad screenshots for now.
- **Meal/water reminders (notifications)** — the old reminder feature was
  removed; if you want it back it must be re-added properly with its
  permissions and store declarations.
- **Screenshots automation** — a helper script exists to produce the store
  screenshots; polish them with real content before listing.

---

## What was changed by this audit (for the record)

Three small, safe fixes were applied directly (details in `DECISIONS.md` §24):
1. Switched off a leftover "allow unencrypted traffic" developer setting.
2. Removed three Android permissions belonging to a feature that no longer
   exists (reviewers penalise over-asking).
3. Stopped tracking an internal setup-instructions file (`SECRETS.md`) in the
   code history, matching the project's own ignore rules. (It contained
   instructions and placeholders, not actual secrets — verified.)

Everything else in this document is **advice only** — no other code was touched.

## Suggested order of attack

| When | Do |
|---|---|
| **Today** | Start Blocker 1 (accounts — there's a waiting period) and make the Blocker 2 domain decision. |
| **This week** | ~~Blocker 3 (auto-publish)~~ ✅ done 4 July. Item 6 (crash reporting, 30 min), Item 7 (check AI allowance). |
| **Next** | Blockers 4–5: fill questionnaires from `DATA_INVENTORY.md`, produce TestFlight/internal builds, do the Item 9 phone pass. |
| **Then** | Submit. Expect at least one rejection-and-fix round — that's normal for a first release. |
