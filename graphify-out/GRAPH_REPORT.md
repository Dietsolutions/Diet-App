# Graph Report - .  (2026-06-10)

## Corpus Check
- 132 files · ~107,991 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 493 nodes · 734 edges · 34 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `optionalString()` - 17 edges
2. `hr()` - 9 edges
3. `main()` - 9 edges
4. `update()` - 9 edges
5. `seedSyedkhalid()` - 8 edges
6. `seedBatthulavinay()` - 7 edges
7. `seedSooryaprakash()` - 7 edges
8. `optionalStringArray()` - 7 edges
9. `seedICMRNIN()` - 6 edges
10. `pad()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Client UI Components (Meals, Tracker, Shopping, Water, Weight)"
Cohesion: 0.04
Nodes (8): ErrorBoundary, computeConsumed(), localToday(), MacroAchievementCard(), safe(), safeTarget(), getMealEaten(), handleToggle()

### Community 1 - "Server Core Services (AI, Macro Validation, Meal Plan, TDEE, Prisma)"
Cohesion: 0.05
Nodes (18): anthropicClient(), callLLM(), callLLMJson(), openaiClient(), selectProvider(), stripCodeFences(), buildDayLevelCorrectionPrompt(), buildMealCorrectionPrompt() (+10 more)

### Community 2 - "Client Auth & Data Fetching (AuthScreen, Login, useAuth, usePlan)"
Cohesion: 0.06
Nodes (9): identifyUser(), optedIn(), track(), trackPage(), handlePasswordChange(), handleSubmit(), handleUsernameChange(), validatePassword() (+1 more)

### Community 3 - "Food Search Services (USDA, OpenFoodFacts, IndianFood, CalorieNinjas, AI Food)"
Cohesion: 0.08
Nodes (16): extractIngredients(), getMealMacrosFromCalorieNinjas(), verifyDayMacros(), zeroed(), checkAIFallbackRateLimit(), dedup(), runWaterfall(), getTrigrams() (+8 more)

### Community 4 - "App Entry Points & Native (App.tsx, main.tsx, server.ts, Capacitor, PWA)"
Cohesion: 0.06
Nodes (4): buildCorsOptions(), createApp(), handleDismiss(), setDismissed()

### Community 5 - "Meal Replacer Feature (Search, Results, AI Estimate, Quantity, Sheet)"
Cohesion: 0.09
Nodes (0): 

### Community 6 - "Onboarding & Plan Review Flow"
Cohesion: 0.1
Nodes (10): calcEndTime(), handleCountrySelect(), handleEatingHoursChange(), handleOptOut(), handleStartTimeChange(), handleToggle(), selectGoal(), toggleArr() (+2 more)

### Community 7 - "Validation Utilities (comprehensive input validation functions)"
Cohesion: 0.14
Nodes (26): clampBytes(), optionalString(), optionalStringArray(), requiredString(), sanitizeText(), validateAllergies(), validateAvoidIng(), validateCity() (+18 more)

### Community 8 - "Client API Layer & Profile/Weight Features"
Cohesion: 0.1
Nodes (2): apiFetch(), apiUrl()

### Community 9 - "Auth Routes (JWT, Apple/Google OAuth, Password Reset, Review Account)"
Cohesion: 0.1
Nodes (12): attemptRefresh(), base64UrlDecode(), base64UrlToBigInt(), ecdsaSigDerToRaw(), ensureReviewAccount(), extractToken(), getAppleJwks(), issueToken() (+4 more)

### Community 10 - "Audio/TTS Services (ElevenLabs, UnrealSpeech, OpenAI, PlayHT)"
Cohesion: 0.21
Nodes (7): generateAudio(), generateUnrealSpeechChunk(), generateWithElevenLabs(), generateWithOpenAI(), generateWithPlayHT(), generateWithUnrealSpeech(), splitScriptIntoChunks()

### Community 11 - "Validation Data Query Scripts (Analysis/Reporting)"
Cohesion: 0.45
Nodes (12): avg(), hr(), main(), pad(), pct(), queryAttemptBudget(), queryDayLevelCorrections(), queryMealTargetFailures() (+4 more)

### Community 12 - "Kaggle Indian Foods Seed Script"
Cohesion: 0.55
Nodes (10): main(), makeResolver(), parseCSV(), seedBatthulavinay(), seedSooryaprakash(), seedSyedkhalid(), toCode(), toFloat() (+2 more)

### Community 13 - "Tracker Route (Server)"
Cohesion: 0.22
Nodes (4): getMondayOfCurrentWeek(), getPlanDates(), localDateStr(), todayLocal()

### Community 14 - "ICMR-NIN/INDB Indian Food Database Seed Script"
Cohesion: 0.46
Nodes (7): main(), parseCSVRow(), parseNum(), r0(), r1(), seedICMRNIN(), seedINDB()

### Community 15 - "Shopping Share Sheet (Native Sharing)"
Cohesion: 0.29
Nodes (2): buildShareText(), categoryEmoji()

### Community 16 - "Auth Cookie Utilities (httpOnly cookie management)"
Cohesion: 0.57
Nodes (6): clearAllAuthCookies(), clearAuthCookie(), clearRefreshCookie(), isProd(), setAuthCookie(), setRefreshCookie()

### Community 17 - "Validation Tests"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Calendar Component"
Cohesion: 0.4
Nodes (0): 

### Community 19 - "TDEE Tests"
Cohesion: 0.6
Nodes (3): calculateBMR(), calculateTDEE(), getActivityMultiplier()

### Community 20 - "Haptic & Long Press Hooks"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Audio Guide Hook"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Utils Tests"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Auth Tests"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "VBar UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Btn UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Query Attempt Detail Script"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Replaced Meal Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Check UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Swipe Gesture Hook"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Pill UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Vite Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Test Setup"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "DataRow UI Component"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `VBar UI Component`** (2 nodes): `VBar.tsx`, `VBar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Btn UI Component`** (2 nodes): `Btn.tsx`, `Btn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Query Attempt Detail Script`** (2 nodes): `queryAttemptDetail.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Replaced Meal Card Component`** (2 nodes): `ReplacedMealCard.tsx`, `ReplacedMealCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Check UI Component`** (2 nodes): `Check.tsx`, `Check()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Swipe Gesture Hook`** (2 nodes): `useSwipeGesture.ts`, `useSwipeGesture()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pill UI Component`** (2 nodes): `Pill.tsx`, `Pill()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Env Types`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Setup`** (1 nodes): `setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DataRow UI Component`** (1 nodes): `DataRow.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Client UI Components (Meals, Tracker, Shopping, Water, Weight)` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Server Core Services (AI, Macro Validation, Meal Plan, TDEE, Prisma)` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Client Auth & Data Fetching (AuthScreen, Login, useAuth, usePlan)` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Food Search Services (USDA, OpenFoodFacts, IndianFood, CalorieNinjas, AI Food)` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `App Entry Points & Native (App.tsx, main.tsx, server.ts, Capacitor, PWA)` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Meal Replacer Feature (Search, Results, AI Estimate, Quantity, Sheet)` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Onboarding & Plan Review Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._