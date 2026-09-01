# Play Store Deployment Guide — Diet Plan & Tracker

This is the end-to-end runbook for shipping the Android app to Google Play.

---

## 1. One-time setup

### 1.1 Google Play Console
1. Create a **Google Play Developer account** at https://play.google.com/console ($25 one-time fee).
2. Create the app:
   - App name: **Diet Plan & Tracker**
   - Default language: English
   - App / Game: **App**
   - Free / Paid: **Free**
3. Note the **package name** — must be `com.dietplan.tracker` (already in `android/app/build.gradle`).
4. Enable **Play App Signing** (Settings → App signing):
   - Google will manage the app signing key.
   - You'll upload with your **upload key** (the `diet-plan-release.jks` we already have).
   - This protects your app signing key from being lost.

### 1.2 Hosting
The Capacitor WebView loads `https://getplanyourplate.com` (or your domain). The Play Store requires:
- A **public privacy policy URL** — host `/privacy` from the same domain. Already implemented in `server/src/routes/pages.ts:65` and live on Vercel.
- A **public data-deletion endpoint** — for the Data Safety form. Same Vercel deploy already serves it (see `pages.ts:114`).
- A **support email** — `dietplan.support@gmail.com` is set in the app.

### 1.3 Vercel environment (production runtime)
Set these in **Vercel → Project → Settings → Environment Variables** for the `Production` environment:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Required |
| `DATABASE_URL` | Neon pooled URL | From Neon dashboard |
| `DIRECT_URL` | Neon direct URL | From Neon dashboard |
| `JWT_SECRET` | `openssl rand -base64 48` | Unique per environment |
| `CLIENT_URL` | `https://getplanyourplate.com` | CORS allowlist |
| `FRONTEND_URL` | `https://getplanyourplate.com` | OAuth callback |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Claude API |
| `SMTP_HOST` | (Resend / SES / SendGrid) | Password-reset emails |
| `SMTP_PORT` | `587` | STARTTLS |
| `SMTP_USER` | … | |
| `SMTP_PASS` | … | |
| `EMAIL_FROM` | `dietplan.support@gmail.com` | Note: Gmail addresses need an SMTP provider (Resend/SES) that permits sending "from" this address, or Gmail SMTP with an app password |
| `APPLE_CLIENT_ID` | `com.dietplan.tracker.signin` | |
| `APPLE_TEAM_ID` | (10-char Apple Team ID) | |
| `APPLE_PRIVATE_KEY` | (paste .p8 contents) | Alternative to APPLE_PRIVATE_KEY_PATH |
| `REVIEW_USERNAME` | `reviewer@dietplan.app` | Reviewer demo account |
| `REVIEW_PASSWORD` | (long random) | |
| `GOOGLE_CLIENT_ID` | … | Optional — Google sign-in |
| `GOOGLE_CLIENT_SECRET` | … | Optional |
| `GOOGLE_CALLBACK_URL` | `https://getplanyourplate.com/api/auth/google/callback` | |
| `VITE_API_URL` | (empty) | Same-origin |
| `VITE_POSTHOG_KEY` | … | Optional analytics |

After saving, **redeploy** the Vercel project so the new envs take effect.

---

## 2. Local environment (this machine)

### 2.1 Create `server/.env`
Already exists at `server/.env` (gitignored) with your real values. Make sure these are present:
- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `SMTP_*` + `EMAIL_FROM` (so password reset works locally)
- `CLIENT_URL=http://localhost:5173`, `FRONTEND_URL=http://localhost:5173`
- `NODE_ENV=development`

### 2.2 Create `android/app/keystore.properties`
Already exists (gitignored). Make sure it has:
```
storeFile=diet-plan-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=diet-plan-release
keyPassword=YOUR_KEY_PASSWORD
```

If you ever lose this keystore, you'll lose the ability to push updates — keep a backup in 1Password / Bitwarden.

---

## 3. Build the App Bundle

From the project root:
```bash
# 1. Build the web bundle (Vite → client/dist/)
npm run build

# 2. Sync the bundle into the Android project
npx cap sync android

# 3. Build the signed AAB
cd android
./gradlew bundleRelease
```

The signed AAB lands at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Bumping the version code
The AAB must have a unique `versionCode` for every Play Store upload. The `build.gradle` already auto-increments:
```bash
ANDROID_VERSION_CODE=42 ./gradlew bundleRelease
```
or
```bash
./gradlew bundleRelease -PversionCode=42
```

---

## 4. Upload to Play Console

1. Go to **Play Console → Diet Plan & Tracker → Testing → Internal testing**.
2. Click **Create new release**.
3. Upload `app-release.aab`.
4. Fill in **Release notes** (what changed).
5. **Review and roll out** → start with **Internal testing** track first.

### 4.1 Required store listing assets

You need to provide these — code can't generate them:

| Asset | Size | Notes |
|---|---|---|
| **App icon** | 512 × 512 PNG, 32-bit, no alpha | Use your brand mark |
| **Feature graphic** | 1024 × 500 PNG/JPG | Banner for Play Store listing |
| **Phone screenshots** | 16:9 or 9:16, min 320 px, max 3840 px | **Minimum 2**, recommended 4–8 |
| **Short description** | ≤ 80 chars | One-line pitch |
| **Full description** | ≤ 4000 chars | Marketing copy |
| **Privacy policy URL** | Public URL | `https://getplanyourplate.com/privacy` |
| **App category** | Health & Fitness | |
| **Content rating** | Fill IARC questionnaire | Everyone / PEGI 3 |
| **Target audience** | Not children | Required for health apps |
| **Data safety form** | See below | **Required** |
| **Government app** | No | |
| **Ads** | No | |
| **In-app purchases** | No (or list prices) | |
| **Data deletion URL** | `https://getplanyourplate.com/data-deletion` | Required since app has account deletion |

### 4.2 Data Safety form (the biggest submission item)
Match the declarations to the data you actually collect. Based on `ios/App/App/PrivacyInfo.xcprivacy` and the server code:

**Data collected (yes, all of these — all "required" for app functionality):**
- **Account info** — username, email, full name (purpose: app functionality)
- **Health info** — weight, height, age, health conditions, dietary preferences (purpose: app functionality)
- **App activity** — page views, taps (purpose: **analytics**, ONLY if user opts in)
- **Device or other IDs** — `userId` (purpose: app functionality)
- **Photos** — meal photos (purpose: app functionality, optional feature)
- **User-generated content** — meal logs, food entries (purpose: app functionality)

**Data shared:** None shared with third parties.

**Data security:**
- ✅ Encrypted in transit (HTTPS)
- ✅ Users can request account + data deletion (Profile → Delete Account)
- ❌ Not encrypted at rest by the app itself (relies on Neon Postgres at-rest encryption)

**Data deletion:**
- Provide URL: `https://getplanyourplate.com/data-deletion`
- The user can also trigger deletion in-app (Profile → Delete Account)

**Compliance:**
- ❌ Not a child-directed app
- ❌ No government requests
- ❌ No financial features

---

## 5. Testing the release locally

### 5.1 Install on a connected device
```bash
cd android
./gradlew installRelease
adb shell am start -n com.dietplan.tracker/.MainActivity
```

### 5.2 Verify reviewer demo account
After `NODE_ENV=production` + `REVIEW_USERNAME` + `REVIEW_PASSWORD` are set in Vercel, hitting the API should auto-create that account. Test:
```bash
curl -X POST https://getplanyourplate.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"$REVIEW_USERNAME","password":"$REVIEW_PASSWORD"}'
```

### 5.3 Test the WebView
The app's WebView points to `https://getplanyourplate.com`. Make sure that:
- All pages render correctly in WebView (test in Chrome DevTools mobile emulation)
- No console errors
- Apple/Google sign-in flows are reachable

---

## 6. Internal testing → Production rollout

1. **Internal testing** (up to 100 testers, no review) — smoke test with team.
2. **Closed testing** (alpha / beta tracks) — wider test.
3. **Production** — submit for review.
   - First submission goes through **Google's full review** (1–7 days).
   - After approval, subsequent updates are reviewed in hours–days.
   - Google requires all **Data Safety**, **Content rating**, **Target audience**, and **Store listing** fields filled.

### 6.1 Pre-submission checklist
- [ ] AAB signed with upload key
- [ ] Version code higher than the previous one
- [ ] Release notes filled
- [ ] Data Safety form matches actual data collection
- [ ] Privacy policy URL live
- [ ] Data deletion URL live
- [ ] App icon 512×512 uploaded
- [ ] Feature graphic uploaded
- [ ] 2+ phone screenshots uploaded
- [ ] Short description (≤80 chars)
- [ ] Full description (≤4000 chars)
- [ ] Category = Health & Fitness
- [ ] Content rating filled (IARC questionnaire)
- [ ] Target audience = Not for children
- [ ] No ads declaration
- [ ] No government / financial / health-data-without-policy issues
- [ ] Tested on at least one physical device (Android 8+ recommended)
- [ ] No "TODO" / "Lorem ipsum" anywhere
- [ ] Reviewer demo account works
- [ ] All Apple/Google sign-in flows tested

---

## 7. Continuous deployment (GitHub Actions)

There isn't an Android CI workflow yet. To add one, create `.github/workflows/android.yml`:

```yaml
name: Android release
on:
  workflow_dispatch:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - run: npm ci
      - run: npm run install:all
      - run: npm run build
      - run: npx cap sync android
      - name: Decode release keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/diet-plan-release.jks
      - name: Write keystore.properties
        working-directory: android
        run: |
          cat > app/keystore.properties <<EOF
          storeFile=diet-plan-release.jks
          storePassword=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          keyAlias=diet-plan-release
          keyPassword=${{ secrets.ANDROID_KEY_PASSWORD }}
          EOF
      - name: Build AAB
        working-directory: android
        run: ./gradlew bundleRelease -PversionCode=${GITHUB_RUN_NUMBER}
      - uses: actions/upload-artifact@v4
        with:
          name: diet-plan-android-${{ github.run_number }}.aab
          path: android/app/build/outputs/bundle/release/app-release.aab
      - name: Upload to Play internal track
        if: startsWith(github.ref, 'refs/tags/')
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT_JSON }}
          packageName: com.dietplan.tracker
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: internal
          status: completed
```

Set up the secrets in **GitHub → Settings → Secrets and variables → Actions**:
- `ANDROID_KEYSTORE_BASE64` — `base64 -i diet-plan-release.jks | pbcopy`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `PLAY_STORE_SERVICE_ACCOUNT_JSON` — from Google Cloud → Service Account with "Play Android Developer" role
