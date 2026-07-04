# Publish Readiness — Diet Plan & Tracker

Audit date: 2026-07-01. Scope: Apple App Store + Google Play publishability.
Method: direct inspection of configs, server middleware, manifests, client
bundle inputs, `npm audit`, and the live production behaviour. Auto-fixes
applied in this run are marked ✅ and listed in DECISIONS.md §24.

## TOP 5 BLOCKERS

1. **Signing & store accounts (manual)** — no iOS distribution cert/
   provisioning profile and no Android upload keystore exist yet. Nothing
   ships without them. Follow `SECRETS.md` (kept locally, now untracked) +
   `scripts/generate-android-keystore.sh`; enrol Apple Developer Program +
   Play Console.
2. **`dietplan.app` domain assumptions** — Android App Links, the privacy/
   terms URLs you'll enter in store forms, and OAuth callbacks reference
   `dietplan.app` / the Vercel URL inconsistently. Decide the canonical
   production domain, serve `.well-known/assetlinks.json` (Android) and
   `apple-app-site-association` (iOS) from it, and use its `/privacy` +
   `/terms` URLs in both store listings.
3. **Store listing assets (manual)** — screenshots per device class,
   content-rating questionnaires, support URL, and the privacy
   declarations (transcribe `DATA_INVENTORY.md`). `STORE_METADATA.md` has
   name/description drafts; icons + splash exist in both shells.
4. **Native release build never exercised end-to-end** — debug simulator
   runs work, but no TestFlight build or Play internal-testing AAB has been
   produced. The release pipeline (fastlane / `.github/workflows`) is
   written but unproven; expect first-run issues (signing, bundle IDs,
   version codes).
5. **Vercel auto-deploy from GitHub is broken** — pushes to `main` do not
   reach production (found 2026-06-30; production was 8 days stale).
   Reconnect the Git integration or keep deploying via CLI, otherwise the
   backend the store build talks to will silently rot.

---

## A. Application Security

| Item | Status | Severity | Effort | Notes |
|---|---|---|---|---|
| Secrets in tracked source | OK | — | — | No live keys/DB URLs in git (only a test-container URL in `__tests__/setup.ts`). `SECRETS.md` was tracked but is documentation/placeholders only — ✅ untracked to match `.gitignore` intent. `session-ses_1786.md` (past leak) confirmed gitignored. |
| `.env` hygiene | OK | — | — | `.gitignore` covers `.env*` comprehensively; `!.env.example` whitelisted. |
| Client-side env vars | OK | — | — | Only `VITE_API_URL`, `VITE_POSTHOG_KEY/HOST`, `VITE_SENTRY_DSN` reach the bundle — all designed-to-be-public values. Anthropic/CN/DB keys are server-only; verified absent from `client/dist`. |
| JWT handling | OK | — | — | 7d access + hashed refresh tokens; `JWT_SECRET` enforced at startup (throws in prod if missing/short/placeholder — no hardcoded fallback). |
| Cookie flags | OK | — | — | `httpOnly`, `secure` (prod), `sameSite` set. Native uses Bearer tokens in localStorage — acceptable for WebView apps; note it in the privacy write-up. |
| Helmet | OK | — | — | Present with sane config (CSP off is fine for a JSON-only API). |
| CORS | OK | — | — | Explicit allowlist + per-project Vercel preview regex; Capacitor WebView origins allowed deliberately (every endpoint still requires JWT). Not `*`. |
| Rate limiting | OK | — | — | `express-rate-limit` on login/signup/deletion/reset; per-user limiter; AI generation capped 3/day + 2/month. In-memory stores reset per serverless instance — acceptable now, note for scale. |
| SQL injection | OK | — | — | Prisma throughout; raw queries are constant health-check `SELECT 1`s. |
| API ownership checks | OK | — | — | Routes filter by `req.userId` from JWT (spot-checked tracker/weight/meals/plan); public recipe share route is deliberately read-only. |
| Error responses | OK | — | — | Production error middleware returns generic `server_error`; stacks logged server-side only. |
| Dependency vulns | Needs Work | Medium | 1–2h | Server: 2 high (`nodemailer` raw-option SSRF — only exploitable if attacker controls message construction, we don't use `raw`; `undici` header injection). Client: 1 high (`form-data` CRLF), 1 moderate (`dompurify`). Run `npm audit fix` in both, retest login-email + generation. Not store blockers. |

## B. Mobile Platform Configuration

| Item | Status | Severity | Effort | Notes |
|---|---|---|---|---|
| iOS bundle ID / versions | OK | — | — | `com.dietplan.tracker`; version/build driven by Xcode build settings (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`). |
| iOS permission strings | OK | — | — | No `NS...UsageDescription` needed — plugins are app/haptics/splash/status-bar only; no camera/photos/notifications requested. Keep it that way unless a feature demands one. |
| iOS ATS | OK | — | — | `NSAllowsArbitraryLoads=false`; only a localhost dev exception (standard, review-safe). |
| iOS privacy manifest | OK | — | — | `PrivacyInfo.xcprivacy` present: name/email/userID/health declared, tracking=false. Matches `DATA_INVENTORY.md`. |
| iOS encryption declaration | OK | — | — | `ITSAppUsesNonExemptEncryption=false` declared (HTTPS-only exemption). |
| Android package / versions | OK | — | — | `com.dietplan.tracker`; versionCode/Name overridable via env/CI — remember to bump per upload. |
| Android target SDK | OK | — | — | target/compile SDK 36, min 24 — above Play's current minimum. |
| Android permissions | ✅ Fixed | — | — | Removed `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM` (belonged to uninstalled local-notifications plugin; exact-alarm draws review scrutiny). Kept `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE` (haptics). |
| Cleartext traffic | ✅ Fixed | — | — | Android `network_security_config` already forbids cleartext; `capacitor.config.ts` `server.cleartext` flipped `true`→`false` (API is HTTPS-only; dev uses bundled assets). |
| Capacitor server URL | Needs Work | High | 0.5h + discipline | `server.url` comes from `VITE_API_URL` at sync time — correct pattern, but store builds MUST be produced with it **unset** (bundled assets) and the client **built** with `VITE_API_URL=<prod API>` baked in. Document the exact release command in the build scripts so a stray env var can't ship a remote-URL WebView (Apple rejects thin web wrappers pointing at remote sites). |
| Deep links | Needs Work | Medium | 1–2h + domain | `dietplan://` scheme fine. Android App Links intent-filter (`autoVerify=true`) requires `https://dietplan.app/.well-known/assetlinks.json` to actually be served — it is not today; verification will fail (falls back to chooser, not fatal). Serve it or drop the App Links filter for v1. |
| Debug flags | OK | — | — | `webContentsDebuggingEnabled=false`, `allowMixedContent=false`, no `CAPACITOR_DEBUG` leakage in release scheme. |
| Signing | **Blocker (manual)** | Blocker | 2–4h author | iOS: Apple Developer Program + distribution cert + provisioning profile (fastlane match scripted in repo). Android: generate upload keystore (`scripts/generate-android-keystore.sh`), enrol in Play App Signing. **Not automatable — author task.** |

## C. Privacy & Store Compliance

| Item | Status | Severity | Effort | Notes |
|---|---|---|---|---|
| Privacy policy | OK | — | — | Served at `/privacy` (`routes/pages.ts`), covers health data, retention, rights; linked in-app (AuthScreen + ProfileTab). Use its **canonical production URL** in both store forms. |
| Terms of service | OK | — | — | `/terms` served + linked; includes 13+ age requirement. |
| Account deletion | OK | — | — | Apple-required in-app deletion exists: Profile → Delete Account → `DELETE /api/auth/delete-account` (password-confirmed, rate-limited, cascading delete). Also email-confirmed `request-deletion` path. |
| App Privacy / Data Safety forms | Needs Work (manual) | Blocker-adjacent | 1–2h | Store questionnaires must be filled at submission; transcribe `DATA_INVENTORY.md` (written this run). |
| Health-data disclosure | OK | — | — | Privacy policy names diet/body metrics; PrivacyInfo declares health type; Anthropic sharing disclosed in DATA_INVENTORY for the forms. |
| Third-party SDK disclosure | OK | — | — | PostHog / Google / Apple / Anthropic / CalorieNinjas enumerated in DATA_INVENTORY. |
| Children / COPPA | OK | — | — | 13+ in Terms; select "not directed at children" in both stores. |

## D. Store Listing Readiness (all manual/author tasks)

| Item | Status | Notes |
|---|---|---|
| App icons | OK | Full `AppIcon.appiconset` (incl. 1024) + Android mipmaps present. |
| Splash screens | OK | All density buckets present in both shells. |
| Screenshots | Missing | Per-device-class screenshots needed (6.7"/6.5"/5.5" iPhone, iPad if supported, phone+tablet for Play). `take-screenshots.js` exists as a starting point. |
| Name / description / keywords | Needs Work | Drafts in `STORE_METADATA.md` — review and finalise. |
| Content rating | Missing | Fill questionnaires (expect "Everyone"/4+; health-adjacent, no medical claims — avoid "weight loss cure" phrasing). |
| Support + marketing URL | Missing | Needs a real support contact page/email on the canonical domain. |
| Review notes / demo account | Needs Work | `STORE_REVIEW_NOTES.md` exists — attach a working demo login for reviewers. |

## E. Production Readiness

| Item | Status | Severity | Effort | Notes |
|---|---|---|---|---|
| Crash reporting | Needs Work | High | 0.5h | Sentry is wired in `main.tsx` but `VITE_SENTRY_DSN` is unset → no crash visibility in the wild. Create a (free-tier) Sentry project and set the DSN in the release build env. |
| Error handling / stack leaks | OK | — | — | Generic prod errors; SSE generation errors mapped to friendly messages. |
| Log hygiene | OK | — | — | No passwords/tokens logged (grep-verified); morgan logs are standard access lines. Meal/validation logs contain health-adjacent content in the DB by design — covered by privacy policy. |
| AI provider failure UX | Needs Work | Medium | 1h | Anthropic monthly-cap/429 surfaces as generic "Failed to generate meal plan" (hit this on 2026-06-30). Map 400-usage-cap/429/529 to "service busy — try again later" so reviewers with a fresh account never see a dead-end. **Review risk:** if the Anthropic cap is exhausted during app review, the core flow fails — raise the cap before submitting. |
| Offline behaviour | Needs Work | Medium | 2–4h | PWA service worker + API_UNREACHABLE interceptor exist; App.tsx has minimal offline handling. Verify airplane-mode UX on device: app must show a graceful message, not a blank WebView (common rejection). |
| Loading/empty states | OK | — | — | Generation has SSE progress + heartbeat; tabs have empty states. Spot-check on device during QC. |
| Rate limits vs. real users | OK | — | — | 3 gens/day + 2/month per user is store-safe; document in review notes so testers aren't surprised. |
| Vercel deploy pipeline | **Blocker** | Blocker | 0.5h | GitHub auto-deploy not landing (prod was 8 days stale). Reconnect Git integration in Vercel project settings, or adopt the manual CLI deploy as the documented process. |

---

## Prioritized Action Plan

### Tier 1 — Blockers (before submission)
1. **Signing material** *(manual)* — Apple Developer Program + match; Android keystore + Play App Signing. Effort: 2–4h of account work.
2. **Canonical domain + legal URLs** *(manual + tiny code)* — pick the production domain; ensure `/privacy`, `/terms`, support URL live on it; serve `assetlinks.json` (or drop the App Links filter). Effort: 1–2h.
3. **Fix Vercel auto-deploy** *(manual, 30 min)* — reconnect the GitHub integration so the backend stays current.
4. **Store forms** *(manual)* — App Privacy + Data Safety from `DATA_INVENTORY.md`; content ratings; review notes with demo account. Effort: 2–3h.
5. **Produce one real release build per platform** *(code+manual)* — TestFlight + Play internal testing, with `VITE_API_URL` baked and `server.url` unset. Effort: half a day incl. first-run signing issues.

### Tier 2 — High priority (before launch)
6. **Set `VITE_SENTRY_DSN`** in release builds — crash visibility (0.5h).
7. **Map AI-provider errors** to accurate user messages + ensure Anthropic cap headroom during review window (1h).
8. **`npm audit fix`** both workspaces; retest email + generation (1–2h).
9. **Device QC pass**: offline/airplane mode, cold start, deletion flow, generation E2E on physical devices (2–4h).
10. **Document the exact release build commands** (env discipline for `VITE_API_URL`) in `scripts/build-*.sh` (0.5h).

### Tier 3 — Polish (post-v1)
11. Durable rate-limit store (Upstash/Redis) instead of per-instance memory.
12. Fix the 3 pre-existing `TS2835` import-extension build warnings.
13. iPad-optimised layouts or restrict to iPhone in App Store Connect.
14. Push notifications (re-add local-notifications properly with its permissions) if reminders become a feature again.
15. Periodic dependency audit + Capacitor major-version cadence.
