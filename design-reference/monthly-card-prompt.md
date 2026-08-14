# Redesign the Monthly Macros card — dark treatment

Target file: `client/src/components/MonthlyCalorieChart.tsx`

Reference: `design-reference/v3-screens-monthly.jsx` — component `V3KcalDark`. Read it in full
before starting. Where this document and that file disagree, the file wins.

This is a **restyle of one card**, not a data change. Keep the existing props, hooks, month
navigation state and macro-tab state exactly as they are.

## What changes

The card moves from a light surface to the Track tab's dark chart language:

1. **Ink card.** Whole card sits on `s2.ink` (`#0F140F`), radius 32, padding 20 with
   `paddingBottom: 38` to leave room for the pop-out below. Text on it uses `s2.onDark`,
   `s2.onDarkDim`, `s2.onDarkDimmer` — never `s2.text`.

2. **Month navigator** moves into the card header, right-aligned, beside a
   `MONTHLY MACROS` kicker. Circular 28px buttons at `rgba(246,247,243,0.09)`.

3. **Macro tabs become shaded pills**, replacing the underlined tab row. Five equal-flex pills,
   `borderRadius: 999`, `padding: 8px 0`, 10.5px weight 700. Active pill fills with that macro's
   colour and takes `color: s2.ink`; inactive pills are `rgba(246,247,243,0.09)` with
   `s2.onDarkDim` text. `transition: background 180ms ease-out`.

4. **Consumed / Target / Delta cells are replaced by one hero line:** the consumed figure at
   42px Archivo, with `/ target` trailing in 14px sans, and the delta as a chip on the right
   (`▼ 115g under` / `▲ … over`). Under is lime-on-lime-wash, over is coral-on-coral-wash.

5. **Remove the Daily avg / Under target / Over target cells.** They were on the light card; they
   are not on this one. The under/over story is carried by the chart and its legend.

6. **The chart bars sync to the selected macro.** Under-goal bars use the macro's colour;
   over-goal bars use a fixed contrasting colour. Critical detail:

   ```ts
   const cUnder = macro.color;
   const cOver  = macro.color === s2.fat ? s2.lilac : s2.fat;
   ```

   Without that swap the Fat tab paints both directions the same hue and the chart becomes
   unreadable. The legend swatches must read from these same two variables, not from constants.

7. **All 31 days are plotted, not just elapsed ones.** Three states per column:
   - logged → bar of `max(|delta| / yMax * half, 3)` px, above the goal line if over, below if under
   - elapsed but not logged → 3px tick sitting on the goal line at `rgba(246,247,243,0.13)`
   - future → 2px centred rail at `rgba(246,247,243,0.05)`

   Plus a dashed goal line at the midpoint (`rgba(246,247,243,0.32)`), a soft on-target band
   behind it, a y-axis showing `+yMax / 0 / −yMax`, and x labels at 1 / 8 / 15 / 22 / 31.
   `yMax = Math.ceil(maxAbs / 5) * 5`.

8. **Month-progress line** reads `13 OF 31 PLAN DAYS PROGRESSED (42%) · 2 NOT LOGGED`, over a
   3px rail filled to the elapsed fraction. The "not logged" clause only renders when that count
   is non-zero — do not hardcode it.

9. **Cumulative progress bar** stays, restyled: 6px pill rail on `rgba(246,247,243,0.10)`, fill in
   the macro colour, with `0` / `{pct}% of {macro} target` / `{target}` beneath.

10. **The message pops out of the card.** It is a separate raised element *below* the ink card,
    pulled up over its bottom edge with `margin: -24px 14px 0` and
    `boxShadow: 0 14px 32px rgba(15,20,15,0.22)`. Peach with a `!` badge when the macro is under
    target in a way that needs action; lime with a `✓` when the deficit is intentional (calories,
    carbs, fat on a cut). Do not make every macro a warning — the current copy already
    distinguishes these; keep that logic.

## Data

No new data. Everything on the card derives from the existing per-day values and the daily goal:

```ts
const logged   = days.filter(v => v != null);
const consumed = logged.reduce((a, b) => a + b, 0);
const target   = goal * elapsedDays;
const delta    = consumed - target;
const missed   = elapsedDays - logged.length;
const pct      = consumed / target * 100;
```

Derive these — do not accept them as separate props, or the card can drift out of agreement with
its own chart.

**One correctness note carried over from design review:** if you keep a daily-average figure
anywhere, divide by **logged** days, not elapsed days. Dividing by elapsed treats unlogged days as
zero, which put the stated average *below the lowest plotted bar* on four of five tabs.

## Verify

- Click every one of the five tabs. On the **Fat** tab specifically, confirm over-goal and
  under-goal bars are visibly different colours and the legend matches the bars.
- Confirm no `s2.text` / `s2.textDim` survives on the ink card (light-on-light).
- Confirm the pop-out overlaps the card's bottom edge rather than sitting flush below it.
- `npm run typecheck` clean.
