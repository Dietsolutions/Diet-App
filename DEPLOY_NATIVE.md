# Store Deployment Guide

This project ships as three artefacts:
- **Web PWA** — `vercel.json` builds `client/dist/` and deploys to Vercel.
- **iOS App** — `ios/` is a Capacitor-wrapped Xcode project targeting App Store.
- **Android App** — `android/` is a Capacitor-wrapped Gradle project targeting Play Store.

The web build is **still the source of truth**. The native shells re-use `client/dist/` verbatim, so a single `npm run cap:sync` rebundles the latest web app into both stores.

## Contents

- [Three release paths](#three-release-paths)
- [Path 0: One-time setup (do this first)](#path-0-one-time-setup-do-this-first)
- [Path 1: GitHub Actions CI/CD (recommended)](#path-1-github-actions-cicd-recommended)
- [Path 2: Build locally on your Mac](#path-2-build-locally-on-your-mac)
- [Path 3: Manual upload (no Fastlane, no CI)](#path-3-manual-upload-no-fastlane-no-ci)
- [iOS → App Store](#ios--app-store)
- [Android → Play Store](#android--play-store)
- [Local development with native shell](#local-development-with-native-shell)
- [What this does NOT do](#what-this-does-not-do)

## Three release paths

You have three options for producing the signed `.ipa` and `.aab`. Pick the
one that matches your situation.

| Path | Best for | Cost | Setup time |
|------|----------|------|------------|
| 1. **GitHub Actions** | Solo devs, small teams, "fire and forget" releases | Free for public repos | ~1 hour one-time |
| 2. **Build locally on your Mac** | Privacy-sensitive teams, on-prem builds | $0 | ~3 hours one-time |
| 3. **Manual upload** | One-off submission, no automation needed | $0 | ~30 min |

**Path 1 is what this guide is set up for.** Paths 2 and 3 are documented
for completeness.

---

## Path 0: One-time setup (do this first)

Before you can ship anything, you need accounts + payment:

| Account | Cost | Where | Time |
|---------|------|-------|------|
| Apple Developer Program | $99/yr | [developer.apple.com](https://developer.apple.com) | 24-48 hr to approve |
| Google Play Console | $25 one-time | [play.google.com/console](https://play.google.com/console) | Immediate |
| 1Password / password manager | Free tier works | — | 5 min |

Then:

1. **Register your app's bundle ID** with both stores (do this BEFORE first build):
   - App Store Connect → Apps → "+" → New App → Bundle ID = `com.dietplan.tracker` (or your own)
   - Play Console → All apps → Create app → Package name = `com.dietplan.tracker`

2. **Generate the Android keystore** (one-time, 30 seconds):
   ```bash
   ./scripts/generate-android-keystore.sh
   ```
   Follow the on-screen instructions. Save the passwords to 1Password.

3. **Configure the iOS code-signing match repo** (one-time, 10 min):
   - Create a **private** GitHub repo called `ios-certs` (or any name).
   - Note its URL — you'll use it as `MATCH_GIT_URL`.
   - Generate `MATCH_PASSWORD` and `KEYCHAIN_PASSWORD`:
     ```bash
     openssl rand -base64 32   # run twice, save both
     ```
   - Add all secrets listed in `SECRETS.md`.

4. **For GitHub Actions:** follow `SECRETS.md` end-to-end.
   For local builds: skip to Path 2.

---

## Path 1: GitHub Actions CI/CD (recommended)

This repo has two pre-configured workflows in `.github/workflows/`:

- `ios.yml` — builds the iOS `.ipa` on a macOS runner, signs with Fastlane
  match, optionally uploads to TestFlight.
- `android.yml` — builds the Android `.aab` on a Linux runner, signs with
  your keystore, optionally uploads to Play Console internal track.

### Triggering a build

**Option A — manual (good for testing):**
1. GitHub → Actions tab
2. Select "Build iOS" or "Build Android" from the left
3. Click "Run workflow"
4. Set inputs (build mode, upload yes/no)
5. Click the green "Run workflow" button

**Option B — push a tag (good for releases):**
```bash
git tag v1.0.0
git push origin v1.0.0
```
Both workflows fire. If you set `upload_testflight: 'true'` and
`upload_play_console: 'true'` in the workflow files (or use the manual
trigger), the build goes straight to the stores.

**Option C — push to a branch (PR builds for QA):**
- Any push to a PR that touches `ios/`, `android/`, `client/`, or
  `capacitor.config.ts` triggers a debug build.
- The build artefact (`.ipa` or `.aab`) is downloadable from the Actions
  run page for QA testing via TestFlight internal or Play Console internal
  track.

### What happens during a build

```
1. checkout code
2. setup Node, Ruby (iOS), JDK 17 (Android)
3. install dependencies
4. npm run build (Vite → client/dist)
5. cap sync (copies dist into ios/App/App/public/ and android/.../assets/public/)
6. (iOS) Fastlane match fetches signing certs
7. (iOS) pod install
8. (iOS) xcodebuild archive + export .ipa
   (Android) gradle bundleRelease
9. (optional) upload to TestFlight / Play Console
10. upload .ipa/.aab as GitHub Actions artefact
```

### After a successful build

1. GitHub → Actions → click the run → scroll to "Artifacts" → download
   `diet-plan-ios-release-X.ipa` or `diet-plan-android-release-X.aab`.
2. If you didn't enable auto-upload, drag the file into:
   - **iOS:** Transporter app (free on the App Store)
   - **Android:** Play Console → Internal testing → Create release

---

## Path 2: Build locally on your Mac

If you want to build on your own machine instead of GitHub Actions:

```bash
# iOS
./scripts/build-ios.sh release                # signed .ipa
./scripts/build-ios.sh release upload         # signed .ipa + TestFlight upload

# Android
./scripts/build-android.sh release            # signed .aab
./scripts/build-android.sh release upload     # signed .aab + Play upload
```

Prerequisites:
- macOS 13+, Xcode 15+, CocoaPods 1.13+ (for iOS)
- JDK 17+, Android Studio, ANDROID_HOME set (for Android)
- For upload: the API credentials in `SECRETS.md`

The scripts:
- Build the web app first
- Run `cap sync` to inject the bundle
- Bump `CFBundleVersion` (iOS) / `versionCode` (Android) by 1
- Sign and produce the artefact
- Optionally upload to the store

---

## Path 3: Manual upload (no Fastlane, no CI)

For one-off submissions without automation:

1. Build on your machine (Path 2) or download the GitHub Actions artefact (Path 1).
2. Open **Transporter** (free on the App Store, macOS only) → drag the `.ipa` → deliver.
3. Open **Play Console** in your browser → Internal testing → Create release → upload the `.aab`.

That's it. No Fastlane, no service accounts.

---

## Reference: detailed platform steps

The Path 0/1/2/3 sections above are the recommended release flow. The
sections below have additional detail (manual Xcode / Android Studio
workflows, common rejection reasons) that you can reference if you need it.

---

## 1. Prerequisites

| Tool | Min version | Purpose | Install |
|------|-------------|---------|---------|
| Node.js | 18+ | Vite + Capacitor CLI | `brew install node` |
| Xcode | 15+ | iOS build + signing | App Store → developer.apple.com |
| Android Studio | Hedgehog 2023.1.1+ | Android build + signing | developer.android.com/studio |
| JDK | 17 (LTS) | Gradle | `brew install --cask temurin@17` |
| CocoaPods | 1.13+ | iOS dependency manager | `sudo gem install cocoapods` |
| Apple Developer Program | active | Sign + upload iOS apps | $99/yr |
| Google Play Console | registered | Sign + upload Android apps | $25 one-time |

Set `JAVA_HOME` to the JDK 17 path so Gradle uses the right runtime.

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

---

## 2. Pre-build (every release)

1. **Bump versions.** Edit `client/package.json` → `version`, then in Xcode/Gradle set `MARKETING_VERSION` (iOS) and `versionName` / `versionCode` (Android) to match.
2. **Rebuild the web app.**
   ```bash
   npm install
   npm run build
   ```
3. **Sync to native projects.**
   ```bash
   npm run cap:sync
   ```
   This copies `client/dist/` into `ios/App/App/public/` and `android/app/src/main/assets/public/`, refreshes plugin lists, and re-applies `capacitor.config.ts` to both projects.
4. **Verify no secrets leaked.** The web build will inline any `VITE_*` env vars. `ANTHROPIC_API_KEY`, `JWT_SECRET`, `DATABASE_URL` must NOT be prefixed with `VITE_` — they belong in `server/.env` only.

---

## 3. iOS → App Store

### 3.1 One-time setup

1. Open the project:
   ```bash
   npm run cap:open:ios
   ```
2. Select the **App** target → **Signing & Capabilities** tab.
3. Set **Team** to your Apple Developer account.
4. Set the **Bundle Identifier** (e.g. `com.dietplan.tracker`). This must match the bundle ID you register in App Store Connect.
5. Verify **PrivacyInfo.xcprivacy** is in `ios/App/App/`. It's already there — confirm by selecting the file in Xcode's navigator.
6. Confirm the four **usage description** strings in `Info.plist`:
   - `NSCameraUsageDescription` — food label scanning
   - `NSPhotoLibraryUsageDescription` — meal photos
   - `NSHealthUsageDescription` — TDEE refinement
   - `NSUserNotificationUsageDescription` — meal reminders

### 3.2 Build & archive

```bash
# Inside Xcode:
# 1. Select "Any iOS Device" as the build target (not a simulator).
# 2. Product → Clean Build Folder (Shift+Cmd+K).
# 3. Product → Archive.
# 4. Once the Organizer opens, click "Distribute App".
# 5. Choose "App Store Connect" → "Upload" → let Xcode manage signing.
# 6. Wait for the upload to complete (1-5 min).
```

### 3.3 Submit for review

1. Open App Store Connect → My Apps → your app.
2. **Version** tab → fill in:
   - Screenshots (6.7" iPhone Pro Max, 6.1" iPhone, 12.9" iPad Pro — at least one set)
   - Description, keywords, support URL, privacy policy URL
   - What's New in this version
   - App Privacy questionnaire (the privacy manifest covers most)
3. Select the build you just uploaded.
4. Submit for Review. Typical turnaround: 24–48 hours.

### 3.4 Common rejection reasons

| Reason | Fix |
|--------|-----|
| "Guideline 4.2 — Minimum Functionality" (looks like a website) | Already mitigated: native StatusBar, SplashScreen, App lifecycle, dark theme, custom icon. Don't add extra native screens unless pushed back. |
| "Missing privacy manifest" | `ios/App/App/PrivacyInfo.xcprivacy` is already in place. |
| "App uses non-exempt encryption" | `ITSAppUsesNonExemptEncryption=false` in Info.plist — already set. |
| "App crashes on launch" | Run on a real device via Xcode first. If it crashes only on TestFlight build, check that `capacitor.config.ts` `server.url` is unset for production. |

---

## 4. Android → Play Store

### 4.1 One-time setup

1. Open the project:
   ```bash
   npm run cap:open:android
   ```
2. **Build → Generate Signed Bundle / APK** → choose **Android App Bundle**.
3. Create a new keystore:
   - **Key store path:** `~/keystores/diet-plan-release.jks` (BACK THIS UP — losing it blocks all future updates)
   - **Password:** generate with `openssl rand -base64 32`
   - **Alias:** `diet-plan-release`
   - **Validity:** 25 years
4. Set the **applicationId** in `android/app/build.gradle` to your final ID (e.g. `com.dietplan.tracker`). Match the package in `capacitor.config.ts`.
5. Enable **Play App Signing** in Play Console → Release → Setup → App integrity. Upload your AAB signing key once.

### 4.2 Build & upload

```bash
# Inside Android Studio:
# 1. Build → Generate Signed Bundle / APK → Android App Bundle.
# 2. Select release variant.
# 3. Pick the keystore from step 3.
# 4. Output: android/app/release/app-release.aab
```

Or via Gradle CLI:
```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Upload to Play Console:
1. Play Console → your app → **Release** → **Production** → **Create new release**.
2. Upload `app-release.aab`.
3. Fill in **Release notes**, **Release name**.
4. Review and roll out.

### 4.3 Common rejection reasons

| Reason | Fix |
|--------|-----|
| "Data safety form incomplete" | Play Console asks what data the app collects. Declare: account email, body metrics, meal logs, health data (if NSHealth wired). No tracking. |
| "Target API level too low" | Capacitor 8 sets `compileSdk=35`, `targetSdk=35`. Keep it. |
| "Missing privacy policy URL" | Add a hosted privacy policy URL in the Play Console listing. |
| "App crashes on launch" | Check `adb logcat` on a real device. If it crashes only on signed release, ensure `VITE_API_URL` is unset (the webview will use `https://` default) and that your backend is reachable from outside your dev network. |

---

## 5. Updating an existing release

```bash
# 1. Make your code changes.
# 2. Bump version (client/package.json + native projects).
# 3. Build + sync.
npm run cap:sync
# 4. Open the relevant platform and archive/upload.
npm run cap:open:ios
npm run cap:open:android
```

You can update iOS and Android independently — they don't need to ship in lockstep.

---

## 6. Local development with native shell

```bash
# Terminal 1: run server
npm run dev --prefix server

# Terminal 2: run client on its dev port
npm run dev --prefix client

# Terminal 3: run app on iOS simulator
npx cap run ios

# Or on Android emulator
npx cap run android
```

`cap run` uses `webDir: client/dist`, so it loads the **production** build of the web app (not the Vite dev server). To use the Vite dev server inside the native shell, set:

```ts
// capacitor.config.ts
server: {
  url: 'http://localhost:5173',
  cleartext: true,
}
```

Only enable `cleartext: true` for local dev — never ship it.

---

## 7. What this does NOT do

- No push notifications yet. iOS Info.plist declares `remote-notification` background mode, but you'd need to add a push provider (Firebase Cloud Messaging or APNs) and a plugin (`@capacitor/push-notifications`).
- No in-app purchases. App Store requires this for paid features. Capacitor has `@capacitor-community/in-app-purchases`.
- No offline-first. The PWA service worker handles basic offline, but the React app is not a true offline-first app — generated meal plans require a live API call to the LLM.
- No code obfuscation. The JavaScript bundle in `client/dist/assets/` is readable. If you need obfuscation, add `vite-plugin-obfuscator` to the Vite build.
