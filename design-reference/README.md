# design-reference

The approved Fresh Light design for Planyourplate, as browsable source.
Drop this whole folder at the repo root and commit it, then point Claude Code at
`claude-code-prompt.md`.

## Start here

| File | What it is |
| --- | --- |
| `claude-code-prompt.md` | **The migration prompt.** Paste into Claude Code. Self-contained: carries the full token file, grep commands and per-screen table. |
| `Code Audit - Design to App.html` | The audit behind the prompt — palette mapping, the three contrast traps, what needs backend work. Open in a browser. |
| `Planyourplate - Full App v4.html` | **Open this to see the design.** All 50 screens on one canvas. Works offline; no build step. |
| `github.md` | Screen-to-source map: which repo file each screen was built from, and how confident that grounding is. |

## The design source

`v3-theme.jsx` first — it holds the token object and the 12 styling primitives every screen is
built from. Everything else composes those.

| File | Screens |
| --- | --- |
| `v3-theme.jsx` | Tokens + primitives (Card, Kick, H, Chip, Btn, Bar, Ring, Check, IconBtn, Food, MacroTick, Row) |
| `v3-chrome.jsx` | Scaffold, bottom nav, top bar |
| `v3-onboard-data.jsx` | Every onboarding option list, verbatim from the repo |
| `v3-screens-onboard7.jsx` | The 5 onboarding steps |
| `v3-screens-mealstab.jsx` | Plan · Today |
| `v3-screens-mealdetail.jsx` | Meal detail, cooking instructions, swapped state, change meal |
| `v3-screens-tracker.jsx` | Track, Water |
| `v3-screens-profile.jsx` | Sign in, Profile, Monthly macros, Delete account |
| `v3-screens-replacer.jsx` | The meal replacer flow |
| `v3-screens-recipes.jsx` | Recipes browse, detail, save to plan |
| `v3-screens-customise.jsx` | Customise plan, regenerate |
| `v3-screens-core.jsx`, `-flow.jsx`, `-real.jsx`, `-app2.jsx`, `-light.jsx`, `-onboard.jsx` | Shop, Learn, system states, and earlier screens still referenced by the canvas |
| `v3-app-full.jsx` | Screen registry — maps a screen id to its component |
| `design-canvas.jsx`, `image-slot.js` | Canvas shell and photo drop-slots. Not part of the app design. |

## Reading it

These are plain browser JSX files, transpiled in the page by Babel — no bundler, no imports.
Components attach to `window` and read the global `v3` token object. That is a viewing
convention, not a pattern to copy into the app: port them as normal TSX importing from
`client/src/theme/tokens.ts`.

Later files override earlier ones where they define the same component. Load order is the
`<script>` list in `Planyourplate - Full App v4.html` — when two files define the same screen,
**the one loaded last is the live one**.

## Two things not to get wrong

**1 glass = 250 ml, water goal = 2.5 L.** Some older files in here (`v3-screens-light.jsx`)
predate the repo read and show 300 ml / 3.0 L. The repo is correct.

**Lime is a fill, not a text colour.** `#C6F24E` fails contrast on white. Accent text is
`#5F8C12`. The audit covers this and the other two inversion traps.
