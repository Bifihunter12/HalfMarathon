# RACR — Release Blockers

Companion to `RELEASE_READINESS_AUDIT.md`. Only BLOCKER and CRITICAL items — see `FIX_ROADMAP.md` for HIGH/MEDIUM/LOW and sequencing.

Each item: title, severity, evidence, files, why it matters, user impact, Play risk, recommended fix, effort.

**Update (2026-08-05):** a follow-up audit re-verified every item below against the current codebase. CRITICAL-4 is resolved. CRITICAL-2/CRITICAL-3 are partially addressed by a real (if minimal) telemetry pipeline that didn't exist when this doc was first written. CRITICAL-1 is meaningfully narrower than originally scoped, but not resolved — see its updated status. BLOCKER-1 is unchanged. Original analysis is left in place below each item's own **Status (2026-08-05):** line rather than rewritten, so the audit trail of what changed and why is still visible.

---

## BLOCKER-1: No Android application exists to submit

**Severity:** BLOCKER
**Evidence:** Repo-wide search for `android/`, `ios/`, `capacitor.config.*`, `*.gradle`, `AndroidManifest.xml`, `twa-manifest.json` — zero matches. `package.json` has no build/bundle script; only `"test": "node --test"`.
**Files:** N/A (absence of files, not a bug in one)
**Why it matters:** Google Play requires an uploaded `.aab` (or `.apk`) tied to a signed keystore. There is currently nothing to build, sign, or upload.
**User impact:** None yet — no users are affected because nothing has shipped to Play.
**Google Play risk:** Cannot create even an internal-testing release until this exists.
**Recommended fix:** Wrap the existing PWA as a Trusted Web Activity using Bubblewrap or PWABuilder (this was already the planned approach per this project's own roadmap notes — see `GOOGLE_PLAY_CHECKLIST.md` for the concrete steps), or commit to a native/React Native/Flutter rewrite (materially larger effort, not recommended given the existing PWA is functionally complete).
**Estimated effort:** 1–3 days for a first TWA build (icon regeneration, Digital Asset Links verification, Play Console project setup, first signed upload) — assuming no rewrite.
**Status (2026-08-05):** Still open, unchanged. Re-checked the same repo-wide search (`android/`, `ios/`, `capacitor.config.*`, `*.gradle`, `AndroidManifest.xml`, `twa-manifest.json`) — still zero matches. Icon regeneration (part of this item's own effort estimate) is now done as a side effect of CRITICAL-4 being resolved below, so the remaining work here is narrower than when this was written, but the core blocker (no build/sign/upload pipeline at all) stands.

---

## CRITICAL-1: Zero automated test coverage for `app.js` itself

**Severity:** CRITICAL (narrowed — see status)
**Evidence:** `npm test` runs 92 tests, all located in `tests/*.test.js`, each `require()`-ing either a `netlify/functions/*.js` file or one of `side-quests.js` / `path-system.js` / `xp-system.js`. No test file requires or exercises `app.js`.
**Files:** `app.js` (entire file, ~4,390 lines); `tests/` (for the absence)
**Why it matters:** `app.js` contains the plan generator, all state mutation, and `mergeRunnerState` — the cross-device conflict-resolution logic. This project's own history shows three separate real data-loss bugs in `mergeRunnerState` were only caught by manual live-browser testing, never by an automated test, because none exist for this file.
**User impact:** A regression in plan generation or state merging can ship to production and only be discovered when a real user loses data or sees a broken plan.
**Google Play risk:** Indirect — but a pattern of user-reported data loss or broken plans is a classic driver of 1-star reviews and uninstalls once there's a real install base.
**Recommended fix:** Extract the pure, non-DOM functions from `app.js` (starting with `mergeRunnerState`, `buildStructuredWeeks`, `classifyUser`, `evaluateSafety`) into their own requireable module(s), following the exact pattern already proven for `side-quests.js`/`path-system.js`/`xp-system.js`, then add `node:test` coverage matching that existing style.
**Estimated effort:** 2–4 days for the highest-value subset (merge logic + plan generator); a full extraction of all pure logic is larger.
**Status (2026-08-05):** The exact recommended fix above has been done for the four named functions. `mergeRunnerState` now lives in `merge-state.js` (36 tests in `tests/merge-state.test.js`) and `buildStructuredWeeks`/`classifyUser`/`evaluateSafety` live in `coaching-rules.js` (20+ tests across `tests/coaching-rules.test.js`, `tests/plan-scenarios.test.js`, `tests/pain-guidance.test.js`, `tests/race-readiness.test.js`, `tests/decision-scenarios.test.js`). `npm test` now runs 326 tests total. A follow-up audit went further than the original scope: it found and fixed three real bugs in `mergeRunnerState` that no test had ever caught — the original motivating concern for this whole item — including a systemic one where every dict/id-map-shaped field (`logs`, `overrides`, `crossType`, `sessionLogs`, `sessionOverrides`, `dayAdjustments`, `scheduleChoices`, `sideQuestCalendar`, `recurringWorkouts`, `travelPeriods`) could silently resurrect a deletion when syncing with a stale device. **Not resolved:** the extraction only ever covered these four functions. `app.js` itself still has roughly 140 of its own functions with zero test coverage — pace/pace-zone math, quest-track/side-quest/challenge logic, day-adjustment scheduling, and all state-mutating UI handlers. The same audit found a live bug in this untested remainder (`applySideQuest`/`applySideQuestChat` could silently fail to persist a swap despite showing a success toast) purely by manual code reading, which is exactly the failure mode this item warns about. Re-scope the remaining work as: extract and test the highest-risk remaining pure functions (pace/pace-zone math is a reasonable next target — it's already comment-documented and DOM-free) rather than treating this as closed.

---

## CRITICAL-2: No crash/error reporting service

**Severity:** CRITICAL
**Evidence:** Grepped `app.js`, `index.html`, all Netlify functions, and `package.json` for Sentry/Bugsnag/Crashlytics/Rollbar — no real integration found (one substring false-positive on the variable `isEntry`).
**Files:** N/A (absence)
**Why it matters:** If a real user hits an uncaught exception in production, no one on the team is notified. The only way bugs are currently found is manual testing or a user directly reporting it.
**User impact:** Broken experiences can persist indefinitely without the team knowing.
**Google Play risk:** Play Console's own "Android vitals" crash/ANR metrics would apply once wrapped as an Android app — currently there's no equivalent visibility even at the web layer, so the team would enter that phase with zero baseline crash data.
**Recommended fix:** Add a lightweight browser error-reporting SDK (e.g. Sentry's browser SDK) with `window.onerror`/`unhandledrejection` hooks, scrubbing any PII before sending.
**Estimated effort:** 0.5–1 day for basic wiring; ongoing triage cost after that.
**Status (2026-08-05):** Partially addressed, deliberately not via a third-party SDK. `app.js` (top of file) wires both `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)`, fire-and-forget POSTing to `netlify/functions/log-telemetry.js`, which logs to Netlify's own function logs (7 tests in `tests/log-telemetry.test.js`). Its own header comment explains the tradeoff: it "deliberately does NOT integrate a third-party service... those require creating a new account, which isn't something to do on the user's behalf" — a real first step, not a full platform. **Still missing:** no dashboard, no alerting/notification when an error occurs, no aggregation across errors, no PII-scrubbing beyond "never send free-text fields" (worth a second look before assuming this is airtight) — someone still has to know to go tail Netlify's logs. Recommend deciding explicitly whether this minimal approach is good enough for launch or whether a real SDK is still wanted, rather than this item silently going stale as "already handled."

---

## CRITICAL-3: No analytics or usage telemetry of any kind

**Severity:** CRITICAL
**Evidence:** Grepped for Google Analytics, gtag, Mixpanel, Amplitude, Segment, PostHog across all JS/HTML — zero matches.
**Files:** N/A (absence)
**Why it matters:** There is no way to know onboarding completion rate, feature usage (Side Missions, Path, the new XP/challenge system), drop-off points, or real-world AI-call failure rates. Every past "verified" claim in this project has been a single-session manual spot-check, never an aggregate real-usage signal.
**User impact:** Indirect — but product decisions (including everything built this session) are made without any real usage data to validate them against.
**Google Play risk:** Not a rejection risk by itself, but Play Console will separately require a Data Safety declaration the moment any analytics tool is added — plan for that dependency now rather than retrofitting consent flows later.
**Recommended fix:** Add a minimal, privacy-conscious event pipeline (self-hosted or a privacy-focused provider) covering onboarding completion, plan generation, workout logged, Side Mission/challenge completed, and AI-call failures — with an explicit, honest consent/disclosure step if any data leaves the device.
**Estimated effort:** 1–2 days for basic event wiring.
**Status (2026-08-05):** Partially addressed, via the same `log-telemetry.js` pipeline as CRITICAL-2 above (`app.js`'s `logTelemetryEvent`). Actual events already wired: `onboarding_completed`, `workout_logged`, `workout_skipped`, `side_mission_completed`, `challenge_completed`, and `ai_call_failed` (tagged per endpoint: coach, celebrate, why-workout, weekly-recap) — matching most of this item's own recommended-fix list. No free-text/PII is sent, only short event names/enums. **Still missing:** no aggregation, dashboard, or drop-off/funnel analysis — it's raw log lines in Netlify's console, so answering "what's the onboarding completion rate?" still means manually reading logs, not the real usage-data capability this item was written to unlock. The Data Safety declaration dependency this item flagged is still relevant if a real analytics tool is added later.

---

## CRITICAL-4: Manifest icons are SVG-only — RESOLVED

**Severity:** CRITICAL (resolved)
**Evidence:** `manifest.json` lists exactly two icons, both `image/svg+xml`, both with `"purpose": "any maskable"`.
**Files:** `manifest.json`, `icons/icon-192.svg`, `icons/icon-512.svg`
**Why it matters:** Browser/OS support for SVG app icons — especially the `maskable` purpose, which requires safe-zone padding so the OS can crop to a circle/squircle/rounded-square shape — is inconsistent across Android versions and manufacturers. A missing, blank, or badly-cropped home-screen icon is one of the most visible possible first impressions a user can have.
**User impact:** Some Android devices could show a broken or generic icon instead of the app's real branding after "Add to Home Screen," or (if later wrapped as a TWA) the wrapper generator will likely reject or auto-convert these anyway.
**Google Play risk:** Play Store's own asset pipeline requires PNG icons at specific sizes for the store listing regardless of what the manifest uses — this is a guaranteed blocker for that specific step, not just a risk.
**Recommended fix:** Generate and ship PNG icons (192×192 and 512×512 minimum, plus whatever additional sizes a TWA generator requests) alongside the existing SVGs, with the maskable variant properly padded to the standard safe zone (icon content within the inner ~80% of the canvas).
**Estimated effort:** 0.5 day (asset export + manifest update), assuming the source SVG art already exists.
**Status (2026-08-05):** Resolved. `icons/` now has `icon-192.png`, `icon-512.png`, and a separate `icon-512-maskable.png` alongside the original SVGs. Have not independently re-verified the maskable variant's safe-zone padding pixel-by-pixel — worth a quick visual check against Android's maskable icon preview tool before the first TWA build (BLOCKER-1), but the PNG generation itself, the actual blocker for Play's asset pipeline, is done.
