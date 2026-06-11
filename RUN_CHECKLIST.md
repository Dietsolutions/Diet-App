# Run Checklist

## Before First Launch (Vercel)

- [ ] Set Vercel env vars: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
- [ ] Set Vercel env vars: `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` (if using)
- [ ] Set Vercel env vars: `CLIENT_URL` & `FRONTEND_URL` → `https://ai-dpt.vercel.app`
- [ ] Set Vercel env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- [ ] Set Vercel env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for password reset/delete account emails)
- [ ] Set Vercel env vars: `REVIEW_USERNAME`, `REVIEW_PASSWORD` (App/Play Store reviewer demo account)
- [ ] Set Vercel env vars: `VERCEL_PROJECT_NAME` (used in CORS preview origin regex)
- [ ] Verify `npm run typecheck` passes (0 errors)
- [ ] Verify `npm test --prefix server` passes (42 tests)
- [ ] Verify `npx vitest run --prefix client` passes (49 tests)

## Post-Deploy Verification

- [ ] Visit production URL — app loads without console errors
- [ ] Sign up / log in flow works
- [ ] Google OAuth login works
- [ ] Generate meal plan — AI call succeeds
- [ ] Log food / water / weight
- [ ] Password reset flow sends email
- [ ] Account deletion flow sends confirmation email
- [ ] Sentry error tracking captures errors (test by triggering an error)
- [ ] PWA install prompt appears (iOS Safari share → Add to Home Screen)
- [ ] Service worker registers and caches assets
- [ ] run `npm run screenshots` (dev server on :5175) for store screenshots

## Local Dev

- [ ] `npm run dev` (root) starts both server (:3001) and client (:5173)
- [ ] Proxy from :5173 → :3001 works for `/api/*`
- [ ] `npm run typecheck` passes
- [ ] `npm run test --prefix server` passes
- [ ] `npx vitest run --prefix client` passes
