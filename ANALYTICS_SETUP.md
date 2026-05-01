# Analytics Setup — PostHog

This app uses [PostHog](https://posthog.com) for product analytics.  
Analytics is **opt-in and purely additive** — the app works identically when the key is absent.

---

## 1. Create a PostHog project

1. Sign up at <https://posthog.com> (free tier is generous)
2. Create a new project — choose **US Cloud** (or EU if required by your privacy policy)
3. Copy the **Project API Key** from **Project Settings → Project API Key**

---

## 2. Add environment variables

### Local development

Add to your local `.env` file (never commit this):

```
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### Production (Vercel)

```bash
vercel env add VITE_POSTHOG_KEY production
vercel env add VITE_POSTHOG_HOST production   # value: https://us.i.posthog.com
```

Or set them in the Vercel dashboard under **Project → Settings → Environment Variables**.

> **Important:** Vite only exposes variables prefixed `VITE_` to the browser bundle.  
> The PostHog key is a **public** write-only ingest key — it is safe to expose in the client.

---

## 3. Verify it's working

1. Deploy / run locally with the key set
2. Open the app, navigate between tabs, log in
3. In PostHog dashboard go to **Activity → Live Events** — you should see events arriving within seconds

In development, PostHog debug mode is enabled automatically (logs to the browser console).

---

## 4. Events tracked

| Event | Where | Properties |
|---|---|---|
| `page_viewed` | All tabs | `page` |
| `onboarding_started` | Onboarding mount | — |
| `onboarding_step_completed` | Each step CONTINUE | `step`, `step_name` |
| `plan_duration_selected` | Step 7 | `duration` |
| `onboarding_custom_instructions_added` | Summary screen | `character_count` |
| `meal_plan_generation_started` | Generate button | `plan_duration`, `meals_per_day`, `is_first_plan` |
| `meal_plan_generation_completed` | On SSE done | `plan_duration`, `duration_seconds`, `is_first_plan` |
| `meal_plan_generation_failed` | On error | `error` |
| `onboarding_completed` | Plan review confirm | `is_first_plan` |
| `meal_marked_eaten` | Meals tab toggle | `meal_index`, `meal_type`, `day_index` |
| `meal_unmarked_eaten` | Meals tab toggle | `meal_index`, `meal_type`, `day_index` |
| `calendar_week_navigated` | Week arrows | `direction` |
| `meal_detail_opened` | Meal card tap | `meal_type`, `meal_name` |
| `swap_meal_tapped` | Swap button | `meal_type` |
| `change_meal_tapped` | Change button | `meal_type` |
| `cooking_instructions_generate_tapped` | Detail sheet | `meal_name`, `servings` |
| `cooking_instructions_generated` | On success | `meal_name`, `servings`, `duration_seconds` |
| `audio_guide_generate_tapped` | Audio section | `meal_name` |
| `audio_guide_generated` | On success | `meal_name`, `duration_seconds` |
| `audio_guide_played` | Play button | `meal_name` |
| `audio_guide_paused` | Pause / end | `progress_pct` |
| `meal_share_tapped` | Share button | `meal_name`, `has_audio` |
| `meal_share_method_selected` | Share sheet | `method` |
| `plan_review_confirmed` | Confirm plan | `total_meals_changed`, `plan_duration` |
| `plan_review_meal_change_tapped` | ↻ CHANGE | `day_index`, `meal_index`, `meal_type` |
| `plan_review_alternative_selected` | Meal picker | `day_index`, `meal_index`, `meal_type` |
| `macro_chart_month_navigated` | Tracker chart | `direction`, `month` |
| `shopping_share_opened` | Share button | `items_total`, `items_bought` |
| `shopping_people_count_changed` | ± buttons | `count` |
| `shopping_item_bought` | Item tap | `category` |
| `weight_logged` | Weight modal | `is_first_log` |
| `plan_regeneration_started` | Profile regen | `plan_duration`, `has_custom_instructions`, `custom_instructions_length`, `generations_used_this_month` |
| `plan_regeneration_limit_hit` | Limit state | `generations_used`, `limit` |
| `plan_regeneration_limit_hit` | Limit button | `generations_used`, `limit` |
| `food_search_performed` | Food search | `query_length` |
| `water_logged` | Water detail | `glasses`, `goal_glasses`, `pct_of_goal` |

---

## 5. Privacy

- **No PII** is ever sent: no names, emails, weights, health conditions, or food choices.
- Users are identified by their **internal numeric user ID only** (`identifyUser(userId)`).
- PostHog is initialised with `autocapture: false` and `disable_session_recording: true`.
- Session recording and heatmaps are disabled.
- The `persistence: 'localStorage'` setting stores a random anonymous ID client-side.

To add a privacy notice, update the onboarding summary screen or the Profile tab to include:

> "We use anonymous analytics to improve the app. No personal data is collected."

---

## 6. Useful PostHog dashboard queries

- **Onboarding funnel**: Funnel → `onboarding_started` → `meal_plan_generation_completed` → `onboarding_completed`
- **Meal engagement**: Trend → `meal_detail_opened`, `cooking_instructions_generated`, `audio_guide_played`
- **Shopping usage**: Trend → `shopping_item_bought`, grouped by `category`
- **Regen rate**: Trend → `plan_regeneration_started`, `plan_regeneration_limit_hit`
