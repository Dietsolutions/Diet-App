# iOS & Play Store Deployment Checklist

## Prerequisites (Both Platforms)

- [ ] All items in `RUN_CHECKLIST.md` completed
- [ ] Screenshots taken via `npm run screenshots` (23 screenshots, retina quality)
- [ ] App/Play Store reviewer accounts created (set `REVIEW_USERNAME`/`REVIEW_PASSWORD` in production)
- [ ] `STORE_REVIEW_NOTES.md` reviewed — no hardcoded credentials in screenshots
- [ ] Privacy policy URL is live and linked in app
- [ ] Terms of service URL is live and linked in app
- [ ] App icon and splash screen assets are final
- [ ] Version bump in `capacitor.config.ts` and `package.json`

## iOS (App Store)

- [ ] Apple Developer Program membership active ($99/yr)
- [ ] App Store Connect entry created with correct bundle ID (`com.dietplan.tracker`)
- [ ] All screenshots uploaded (6.7" + 6.5" + 5.5" displays required)
- [ ] App description, keywords, and promo text written
- [ ] Privacy policy URL entered in App Store Connect
- [ ] **CI pre-flight**: Verify `ios.yml` workflow works with `workflow_dispatch`
- [ ] Tag repo with `v*` (e.g. `v1.0.0`) to trigger iOS CI
- [ ] CI builds, signs, and archives on `macos-15` runner
- [ ] Upload to TestFlight via `altool` (CI handles this on tag push)
- [ ] TestFlight build tested on physical device
- [ ] Submit for App Store review via App Store Connect

### Required iOS Secrets (GitHub Actions)

| Secret | Purpose |
|---|---|
| `MATCH_GIT_URL` | Fastlane match git repo URL |
| `MATCH_PASSWORD` | Fastlane match decryption password |
| `KEYCHAIN_PASSWORD` | Temporary keychain password for CI |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_ID` | Apple Developer account email |
| `ASC_API_KEY_ID` | App Store Connect API Key ID |
| `ASC_API_ISSUER_ID` | App Store Connect API Issuer ID |
| `ASC_API_KEY_CONTENT` | App Store Connect `.p8` private key file contents |

## Android (Play Store)

- [ ] Google Play Developer account active ($25 one-time)
- [ ] Play Console listing created with correct package name (`com.dietplan.tracker`)
- [ ] App signing: keystore generated and Google Play App Signing configured
- [ ] All screenshots uploaded (phone + 7" + 10" tablets required)
- [ ] App description, short description, and store listing written
- [ ] Privacy policy URL entered in Play Console
- [ ] Content rating questionnaire completed
- [ ] **CI pre-flight**: Verify `android.yml` workflow works with `workflow_dispatch`
- [ ] Tag repo with `v*` to trigger Android CI
- [ ] CI builds AAB and uploads to Play Console via `upload-google-play` action
- [ ] Release goes to `internal` track first for testing
- [ ] Promote from `internal` → `production` after smoke testing

### Required Android Secrets (GitHub Actions)

| Secret | Purpose |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Keystore file (base64-encoded) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_PASSWORD` | Key password for the release key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account JSON key |

## Known Issues

- `localhost:5173` is whitelisted in production CORS (intentional for dev testing). Not a blocker.
- `no-reply@dietplan.app` default FROM email — change to verified domain if email delivery needed.
- CI uses Node 20 locally, Node 20 on CI. Vite 8 + `@vitejs/plugin-react` peer dep warning exists but works at runtime.
