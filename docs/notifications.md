# Notifications System

## Feature → Notification → Deep Link

### 🍽️ Meal Plans (opens `meals` tab)
| Notification | Trigger |
|---|---|
| Breakfast time! 🍳 | Configurable morning time |
| Lunch time! 🥗 | Configurable noon time |
| Dinner time! 🍝 | Configurable evening time |
| You skipped breakfast — log it? | Not toggled eaten by 10 AM |
| You skipped lunch — log it? | Not toggled eaten by 2 PM |
| Your plan expires in 2 days | Plan < 2 days remaining |
| New meal plan is ready ✨ | AI generation completes |

### 📊 Tracker (opens `tracker` tab)
| Notification | Trigger |
|---|---|
| You logged X of Y meals today | 8 PM daily summary |
| 🔥 3-day streak! | 3 consecutive days logged |
| 🔥 7-day streak! One full week | 7 consecutive days |
| Amazing — 14-day streak! | 14 consecutive days |
| 🏆 30-day streak! Incredible | 30 consecutive days |

### 💧 Water (opens `tracker` tab)
| Notification | Trigger |
|---|---|
| Time to drink water 💧 | Every N hours (configurable) |
| You're behind on water — only X glasses today | < 50% of goal by 5 PM |

### ⚖️ Weight (opens `tracker` tab, weight section)
| Notification | Trigger |
|---|---|
| Weigh-in time ⚖️ — same time, same scale | 7 AM daily |
| Weight not logged yet today | Not logged by 10 AM |
| 🎉 You lost X kg since starting! | Every 1 kg milestone |
| Halfway to your goal! | 50% of target weight loss |
| Goal weight reached! 🏆 | Target weight hit |

### 🛒 Shopping List (opens `shopping` tab)
| Notification | Trigger |
|---|---|
| Your shopping list is waiting 🛒 | Morning of day 1 of meal plan |
| X items still unbought | 2 days into plan, items remain |

### 🍳 Cooking Instructions (opens specific meal detail)
| Notification | Trigger |
|---|---|
| Your audio guide is ready 🔊 | TTS audio generation completes |

### 📖 Recipes (opens `recipes` tab)
| Notification | Trigger |
|---|---|
| New recipe recommendations for you | Weekly digest |

### 📱 App-level
| Notification | Trigger |
|---|---|
| End-of-day report — see your progress | 9 PM daily |
| Your meals are prepped for tomorrow | Evening before |
| Start fresh today 🌱 | After 3+ days inactive |

## Deep Link Architecture

**Capacitor (native):** `dietplan://tab/{tabId}`
- `dietplan://tab/meals` → MealsTab
- `dietplan://tab/tracker` → TrackerTab
- `dietplan://tab/shopping` → ShoppingTab
- `dietplan://tab/recipes` → BrowseRecipesTab
- `dietplan://tab/profile` → ProfileTab
- `dietplan://tab/meal/{planId}/{dayIndex}/{mealIndex}` → specific meal detail

**PWA (web):** `{baseUrl}/#tab={tabId}` route

## Architecture

### Layer 1 — Local Notifications (iOS + Android)
- `@capacitor/local-notifications`
- Schedule on-device, no server needed
- Works offline, fires even if app is closed
- Perfect for meal/water/weight reminders

### Layer 2 — Push Notifications (server-sent)
- `web-push` library + VAPID keys for PWA
- `@capacitor/push-notifications` for native push
- Perfect for streaks, milestones, re-engagement

### Layer 3 — Server scheduling
- `node-cron` for daily batch jobs
- Check conditions + send pushes

## Implementation Plan

### 1. Server
- `NotificationPreference` Prisma model (userId, type, enabled, time)
- `GET/PATCH /api/notifications/preferences`
- `POST /api/notifications/register-device`

### 2. Client — Capacitor Local Notifications
- Install `@capacitor/local-notifications`
- Request permission on login
- Schedule recurring local notifications
- Handle tap → deep link to correct screen

### 3. Client — Settings UI
- ProfileTab → "Notifications" section
- Toggle for each notification type
- Time pickers for meal reminders
- Water interval picker

### 4. Client — Deep link handler
- `App.addListener('appUrlOpen', ...)` handles `dietplan://tab/{tabId}`
- `setActiveTab(tabId)` navigates to the right screen
- Local notification tap listener navigates similarly

## Priority: Tier 1 (MVP)
1. Meal reminders (breakfast/lunch/dinner) → `meals` tab
2. Water reminder → `tracker` tab
3. Weight prompt → `tracker` tab
4. End-of-day report → `tracker` tab
5. Streak milestones → `tracker` tab
