# Progress, race identity, and weight tracking — documented rules (new 2026-07-31)

Companion to `docs/COACHING_SPEC.md` (plan generation/scheduling rules) and `docs/SAFETY_POLICY.md` (safety triage). Covers the three features added in this pass, applying the "World-Class App Developer" integrated product/design/development prompt to the existing app: race identity, weekly/monthly running statistics with a compact mileage chart, and optional weight tracking. Same honesty standard as the rest of this documentation set — provisional/simple rules stated as such, not oversold.

## Race identity

`state.raceGoal.raceName` — a new optional string field, additive to the existing `{event, raceDate, startDate, goal}` shape. `''`/absent on legacy plans; no migration needed since every read site falls back to the pre-existing "`{name}'s {event} Training`" text. Editable during onboarding (wizard's "Race details" step) or later directly in Settings — deliberately **not** routed through the wizard's goal-change confirmation flow, since a cosmetic name edit isn't a timeline/safety-affecting change and shouldn't risk that flow's "logs will be cleared" warning (which only fires for real event/date changes).

Dashboard integration: when a race name is set, it becomes the header's headline (`.hd-title`), and the generic "X's Event Training" line demotes into the subtitle alongside level/goal rather than disappearing. The countdown was already rendered in `.stat-line`; no new competing card was added, per the requirement not to duplicate race info across cards.

## Running progress

### What counts as a "run"

A day counts toward every distance/run-count stat in this feature **only if its structural `type` is `easy`, `long`, `quality`, or `race`** (`progress-stats.js`'s `RUN_TYPES`). `cross` and `rest` days never contribute, even if a distance was manually logged against one (e.g. bike miles entered on a cross day) — this is a deliberately stricter definition than the app's pre-existing lifetime "Distance so far"/"Longest run" stats in `renderProgressPanel`, which predate this feature and use a looser "any non-rest day" rule. **Known, disclosed inconsistency**: those two older stats were left untouched in this pass (changing already-shipped numbers wasn't part of this request), so the app currently shows two different distance totals computed under two different definitions. Worth reconciling in a future pass, not attempted here to avoid an unannounced behavior change to unrelated, already-shipped functionality.

### Partial, edited, and deleted workouts

There is no separate "partial credit" concept — a logged run's distance is whatever the runner actually entered (`entry.distance`), which may legitimately be less than the planned distance; the "planned vs. completed" stats simply show both numbers side by side and let the difference speak for itself. Editing a log entry changes the number used in every stat on the next render (all stats are recomputed fresh from `state.logs` on every render, nothing is cached). Deleting a log entry (`setLog`'s existing "no content left, delete the key" behavior) removes it from every total automatically, for the same reason.

### Week and month boundaries

"This week" reuses the plan's own week grouping (`weeks[currentWeekIdx - 1]`, the same week-boundary logic `dateForSlot`/`findCurrentWeekIdx` already establish elsewhere) rather than a separate ISO-calendar-week concept. "This month" is a genuine calendar-month grouping (`dateIso.slice(0, 7)`), computed by walking every day in the plan whose real date (via `dateForSlot`) has already passed and grouping by month key — a day that hasn't happened yet is never included, matching the existing "so far" pattern used by the lifetime stats.

### Unit conversion

Distances are stored/computed in miles throughout `progress-stats.js` (canonical, matching the app's existing convention) and converted to the display unit only at the render boundary in `app.js`, via the existing `toUnit`/`unitLabel` helpers — no new conversion path was introduced.

### Chart

A single hand-rolled inline SVG bar chart (`buildMileageChartHtml`), zero dependencies, matching this project's no-build-step/no-library convention. Shows a trailing window of up to 8 weeks ending at the current week (never a future week, since there's nothing completed there yet to chart) — planned distance as a light background bar, completed distance overlaid in the accent color. Uses only existing design tokens (`--surface-2`/`--border-active`/`--accent`/`--text-faint`), no new colors invented. A visible one-line caption states the latest week's numbers in plain text (meaning never depends on color alone), and a `.sr-only` paragraph carries the full per-week breakdown for screen readers without cluttering the visible page. The same chart renders in a compact form on the main dashboard (spec-mandated) and again on the Progress screen — one component, two call sites, not two separate implementations.

### Insight

At most one insight sentence, chosen by a fixed priority order (`computeProgressInsight`), never more than one claim at a time:

1. A new personal-best longest run this week (compared against the lifetime longest run as of *before* this week started — derived fresh each render, no separate history needs to be persisted for this).
2. This week's completed-vs-planned distance, if any distance is planned this week.
3. "Highest-volume month so far" — only ever claimed when there are at least two months of real data to compare (a single month can't be its own record).
4. This week's completed run count, as a fallback.
5. Nothing shown, if none of the above has real data behind it — never a fabricated claim.

## Weight tracking

Fully optional (`state.weightTrackingEnabled`, default `false`) and off the main dashboard entirely — nothing is reserved or shown there unless enabled, and even then only a compact trend line lives in Settings; the full graph lives on the Progress screen, never the dashboard, per the explicit requirement.

**Data model**: `state.weightEntries`, `[{dateIso, weightLb}]`. Canonical storage is always lb (mirrors miles-as-canonical for distance), converted to the display unit (`state.weightUnits`, independent of the distance-unit toggle) only at the render/entry boundary via `progress-stats.js`'s `toWeightUnit`/`fromWeightUnit`. **One entry per date, by construction**: adding a weigh-in for a date that already has one replaces it (upsert-by-date) — this is simultaneously how "editing" an entry works (there's no separate edit-in-place form, matching this app's existing add/remove-only pattern for every other Settings list) and how duplicate-date entries are prevented. Removal is explicit (a "Remove" button per row), never silent.

**Trend** (`computeWeightTrend`): compares the average of the newer half of the most recent 6 entries against the average of the older half, and only reports a direction if the difference exceeds a **flat 1.5 lb threshold** — small enough to catch a real multi-week pattern, large enough that ordinary day-to-day water-weight fluctuation reports as "stable," not a false trend. Fewer than 2 entries: no trend is reported at all. Language is strictly neutral and descriptive ("Your recent trend is stable/trending up/trending down") — never judgmental, never a health inference, never a goal comparison, matching the spec's explicit examples verbatim.

**Chart**: same hand-rolled SVG approach as the mileage chart, a compact line/dot plot. The y-axis domain is deliberately padded well beyond the real min/max (a proportional pad, with a flat minimum floor) specifically so a small real fluctuation isn't rendered as a dramatic visual swing.

## Explicitly not built, per the spec's own scope

Race-readiness scoring, route maps, weather analytics, shoe tracking, detailed body composition, wearable-derived recovery scores, complex heatmaps, social sharing graphics, calendar-time-of-day management for any of these features, or any BMI/health-status inference from weight data.
