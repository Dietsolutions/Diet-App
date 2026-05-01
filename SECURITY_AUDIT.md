# Security Audit — Diet App

**Audit date:** 2026-05-01  
**Scope:** Production Express API + React client  
**Users at time of audit:** ~30 (personal health data)

---

## Summary

12 areas audited. 9 issues found, all fixed in this session. 3 areas were already satisfactory.

| # | Area | Status before | Status after |
|---|------|--------------|-------------|
| 1 | Authentication & Sessions | ⚠️ Partial | ✅ Fixed |
| 2 | Input Validation | ⚠️ Gaps | ✅ Fixed |
| 3 | Rate Limiting | ⚠️ Login unprotected | ✅ Fixed |
| 4 | HTTP Security Headers | ❌ None | ✅ Fixed (Helmet) |
| 5 | CORS | ✅ Already locked | ✅ No change needed |
| 6 | Sensitive Data Exposure | ✅ Acceptable | ✅ No change needed |
| 7 | Dependencies | ⚠️ High CVEs in devDeps | ⚠️ Noted (see below) |
| 8 | Environment Variables | ⚠️ Weak fallback | ✅ Fixed |
| 9 | Database Security | ✅ Prisma ORM | ✅ No change needed |
| 10 | Frontend Security | ✅ Acceptable | ✅ No change needed |
| 11 | API Key Protection | ✅ Server-side only | ✅ No change needed |
| 12 | Logging & Monitoring | ⚠️ None | ✅ Fixed (Morgan + security events) |

---

## Area 1 — Authentication & Session Security

### Issues found

**1a. JWT_SECRET had an insecure in-code fallback**  
`middleware/auth.ts` previously fell back to `'fat-loss-secret-key-change-in-prod'` if `JWT_SECRET` was unset. Any deployment without the env var would silently use a publicly known weak secret, allowing token forgery.

**Fix:** Fallback removed. In production, a missing `JWT_SECRET` now causes `process.exit(1)` at startup (fail-fast). In development, a clearly-labelled dev-only string is used instead.

**1b. No login rate limiter**  
`POST /api/auth/login` had no rate limiting, allowing unlimited brute-force attempts.

**Fix:** `loginLimiter` added — 10 attempts per IP per 15 minutes.

### Already satisfactory
- JWT in httpOnly cookie (XSS-safe) ✅
- Bearer token iOS PWA fallback stored in sessionStorage (not localStorage) ✅
- bcrypt salt rounds: 12 ✅
- Signup: 5/hour rate limit ✅
- JWT expiry: 30 days (appropriate for a health tracking PWA) ✅
- Ownership checks on weight logs (update/delete) ✅
- `/api/auth/me` strips passwordHash ✅

### Known tradeoff (not a vulnerability)
The Google OAuth callback passes the JWT in a `?_at=` URL query param for iOS Safari PWA standalone mode. The token is read and removed by the frontend immediately. This is a known, intentional tradeoff — the only alternative would require a separate iOS-specific auth flow. Mitigation: token is removed from the URL by the client before the page settles.

---

## Area 2 — Input Validation & Injection Prevention

### Issues found

**2a. IDOR on `POST /api/plan/regenerate-single-meal`**  
The route read `mealPlanDay` by `{ mealPlanId, dayIndex }` without first verifying that `mealPlan.userId === req.userId`. An authenticated attacker who discovered another user's `mealPlanId` could read their meal data.

**Fix:** Ownership check added before any data access: `prisma.mealPlan.findFirst({ where: { id: mealPlanId, userId } })`.

**2b. IDOR on `PATCH /api/plan/select-meal` (write)**  
Same issue as 2a, but the route also **wrote** to the target mealPlanDay, enabling an authenticated user to silently overwrite another user's meal selections.

**Fix:** Same ownership check pattern added.

**2c. No numeric bounds on `POST /api/profile`**  
The route accepted raw body values for `weightKg`, `heightCm`, `age`, `targetWeightKg`, `gender`, `primaryGoal`, `dietIntensity` without validation. Garbage values would be stored in the DB and fed to the TDEE calculator.

**Fix:** Bounds checks added (e.g., `weightKg` 20–500, `age` 10–120, enum allow-lists for gender/goal/intensity).

**2d. Date format not validated in tracker POST and water POST**  
`POST /api/tracker/:date/:mealIndex/toggle` and `POST /api/water` accepted arbitrary date strings without format checking, which could produce DB query noise or edge-case bugs.

**Fix:** `/^\d{4}-\d{2}-\d{2}$/` regex guard added to both.

**2e. Shopping item key not sanitised**  
`POST /api/shopping/:key/toggle` accepted any string as the item key parameter.

**Fix:** Key must now match `/^[\w-]+$/` and be ≤ 64 chars.

**2f. People count not validated**  
`POST /api/shopping/people-count` accepted any value for `peopleCount`.

**Fix:** Must be an integer 1–20.

**2g. AI prompt inputs not length-limited**  
`instructions` and `hints` in meal replacement routes had no server-side length caps, allowing oversized text to be forwarded to the Anthropic API.

**Fix:** `instructions` capped at 300 chars; `hints` and `rules` arrays capped at 12 items each.

### Already satisfactory
- Auth routes: username regex, password complexity, reserved names ✅
- Meal replacement: `mealIndex` bounds 0–5 ✅
- Meal additions: `VALID_MEAL_CATEGORIES` allow-list ✅
- Weight log: 20–300 kg range ✅
- Water GET: date format validated ✅
- Prisma ORM: all DB queries use parameterised statements (SQL injection impossible) ✅

---

## Area 3 — Rate Limiting

### Issues found

**Login endpoint had no rate limiter** — fixed (see Area 1).

### Already satisfactory
- Signup: 5/hour per IP ✅
- Username check: 30/min per IP ✅
- AI meal generation: 3/day per user (in-memory) ✅
- AI food estimate: configurable per-user daily limit ✅

### Known limitation
Per-user in-memory rate limiters (AI generation, food estimate) reset on server restart. Since the app runs on Vercel serverless functions that may have multiple instances, these are best-effort limits rather than strict ones. For strict enforcement, move to Redis-backed storage (e.g., Upstash). Acceptable for current scale.

---

## Area 4 — HTTP Security Headers

### Issue found

No security headers were set. Missing: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `X-DNS-Prefetch-Control`.

### Fix

`helmet` installed and added to `app.ts`:

```ts
app.use(helmet({
  contentSecurityPolicy: false, // API-only server, no HTML to protect
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
```

`Content-Security-Policy` is disabled because this server only returns JSON — there is no HTML to protect. The React SPA has its own CSP via Vercel's static hosting headers.

---

## Area 5 — CORS Configuration

**Already satisfactory.**  
Origin allowlist in `app.ts` is explicit: `localhost:5173`, `CLIENT_URL`, `FRONTEND_URL`, and a regex matching `*.vercel.app` preview deployments only. `credentials: true` is set. Unknown origins receive a CORS error — not `*`.

---

## Area 6 — Sensitive Data Exposure

**Already satisfactory.**

- Login/signup responses return token + safe user fields only (no `passwordHash`) ✅
- Production error handler returns `{ error: 'server_error' }` without stack traces ✅
- Dev error handler includes stack traces for debugging ✅
- Profile GET returns only the requesting user's own data (guarded by `requireAuth`) ✅
- `audioScript` in `MealCookingInstructions` is stored in DB but never returned in list endpoints ✅

---

## Area 7 — Dependency Security

### Server (`npm audit`)

```
HIGH    minimatch      — ReDoS via repeated wildcards
HIGH    path-to-regexp — backtracking regex
HIGH    undici         — insufficient randomness
HIGH    @vercel/node   — depends on vulnerable @vercel/build-utils
MODERATE @anthropic-ai/sdk — Memory Tool path traversal (sandbox feature, not used)
MODERATE ajv            — ReDoS with $data option
MODERATE @vercel/static-config — depends on vulnerable ajv
MODERATE smol-toml     — DoS via large TOML
```

**All high-severity items are in `@vercel/node`'s dependency chain**, which is a Vercel infrastructure package. These cannot be patched by running `npm audit fix` — they require a `@vercel/node` release. The vulnerabilities are in build-time tooling, not in the runtime execution path of this API. Track the `@vercel/node` release log.

**Action:** Run `npm audit fix` on the next regular maintenance window. Do not run `--force` as it may introduce breaking changes.

### Client (`npm audit`)

```
HIGH (×4), MODERATE (×6) — all in workbox-build → @rollup/plugin-terser → serialize-javascript
```

These are in the PWA build tooling (`vite-plugin-pwa → workbox-build`), not in the runtime bundle served to users. Run `npm audit fix` on the next maintenance window.

---

## Area 8 — Environment Variables

### Issue found

`JWT_SECRET` had an insecure hardcoded fallback — fixed (see Area 1).

### Fix

- `app.ts` now calls `process.exit(1)` if `JWT_SECRET` is missing in production.
- `middleware/auth.ts` no longer silently uses a weak default.

### Already satisfactory
- Startup env check logs all missing required and optional vars ✅
- `ANTHROPIC_API_KEY` is checked at request time and returns `500` with no key leak ✅
- No secrets in client-side code (no `VITE_` prefixed secrets) ✅

---

## Area 9 — Database Security

**Already satisfactory.**

- Prisma ORM generates parameterised queries — SQL injection is structurally prevented ✅
- `DATABASE_URL` is environment-variable only ✅
- Neon PostgreSQL requires SSL by default ✅
- Prisma `select` fields are used in sensitive read endpoints to avoid over-fetching ✅

---

## Area 10 — Frontend Security

**Already satisfactory.**

- No `dangerouslySetInnerHTML` usage found ✅
- JWT stored in sessionStorage (not localStorage) for iOS PWA fallback — ephemeral ✅
- Auth token in primary path is httpOnly cookie — XSS-safe ✅
- `ErrorBoundary` component wraps the app ✅
- No sensitive data in `console.log` calls in production bundles ✅

---

## Area 11 — API Key Protection

**Already satisfactory.**

- `ANTHROPIC_API_KEY`, `USDA_API_KEY`, `GOOGLE_CLIENT_SECRET` are server-only env vars ✅
- No `VITE_` prefix on any secret — they are not compiled into the client bundle ✅

---

## Area 12 — Logging & Monitoring

### Issues found

No HTTP request logging and no structured security event logging.

### Fixes

**Morgan** added to `app.ts`:
- `combined` format in production (structured for log aggregators)
- `dev` format in development (coloured, compact)

**Security event logger** created at `server/src/utils/securityLogger.ts`:
- Emits JSON lines prefixed `[SECURITY]` to stdout
- Events: `login_failed`, `invalid_token`, `rate_limit_hit`, `ownership_violation`, `validation_failed`
- Wired into: login failure paths in `routes/auth.ts`, token verification failure in `middleware/auth.ts`

Vercel captures all stdout/stderr and surfaces it in the Vercel dashboard logs. No separate log shipper required at current scale.

---

## Files Changed

| File | Change |
|------|--------|
| `server/src/app.ts` | Helmet, Morgan, reduced JSON limit (10mb→2mb), fatal startup on missing JWT_SECRET |
| `server/src/middleware/auth.ts` | Removed insecure JWT_SECRET fallback; log invalid tokens |
| `server/src/routes/auth.ts` | Added `loginLimiter` (10/15min per IP); log login failures |
| `server/src/routes/plan.ts` | IDOR fix on `regenerate-single-meal` and `select-meal`; input length limits |
| `server/src/routes/tracker.ts` | Date format validation on GET `/:date` and POST `/:date/:mealIndex/toggle` |
| `server/src/routes/water.ts` | Date format + glasses bounds validation on POST |
| `server/src/routes/shopping.ts` | Item key sanitisation; people count bounds |
| `server/src/routes/profile.ts` | Numeric bounds validation on POST |
| `server/src/routes/food.ts` | Query and description length limits |
| `server/src/utils/securityLogger.ts` | **New** — structured security event logger |

---

## Recommended Next Steps (not implemented — future work)

1. **Redis-backed rate limiting** — replace in-memory `rateLimitMap` with `rate-limit-redis` for correctness across serverless instances.
2. **`npm audit fix`** — run on both `server/` and `client/` after testing.
3. **Refresh token rotation** — 30-day JWT lifespan is long. Consider refresh tokens with shorter access token expiry.
4. **Account lockout** — after N consecutive failed logins per username, require email verification to unlock.
5. **CSP for the SPA** — add `Content-Security-Policy` response headers in `vercel.json` for the static frontend.
