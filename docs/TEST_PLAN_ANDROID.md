# RACR — Android/Mobile Test Plan

Companion to `RELEASE_READINESS_AUDIT.md`. Since there is no Android app to install today, this plan is split into what's testable **right now** (the PWA, in a real Android Chrome browser and installed-to-home-screen) and what becomes testable **once a TWA wrapper exists** (see `GOOGLE_PLAY_CHECKLIST.md`).

## Part 1 — Testable today, on a real Android device, no wrapper needed

Use an actual Android phone (not just desktop Chrome DevTools' device emulation — real touch input, real OS notification behavior, and real memory constraints only show up on a real device).

### 1.1 Install and first-run
- [ ] Visit the live URL in Chrome for Android; confirm `beforeinstallprompt` fires and "Add to Home Screen" works.
- [ ] Launch from the home-screen icon; confirm it opens `display: standalone` (no browser chrome) and the icon itself renders correctly (cross-reference `RELEASE_BLOCKERS.md` CRITICAL-4 — check specifically for a blank/generic icon).
- [ ] Complete the full onboarding wizard (event → race date/goal → fitness → logistics) on a real touchscreen; confirm no tap targets are too small to hit reliably.

### 1.2 Core logging flows
- [ ] Log a run with a `mm:ss` duration and a `h:mm:ss` duration (>1 hr); confirm pace computes correctly on-device.
- [ ] Build a multi-activity cross-training session (the feature shipped this session) end-to-end on a touchscreen; confirm the add/remove segment buttons are comfortably tappable.
- [ ] Log a bodyweight challenge (e.g. Squat Century) across two separate app sessions on the same day; confirm both contributions are retained (regression check for the same-day multi-log fix verified this session).

### 1.3 Offline behavior
- [ ] Enable Airplane Mode, relaunch the app; confirm it still opens and shows the cached plan (service-worker fallback).
- [ ] While offline, log a run, complete a Side Mission, and log challenge progress; confirm all three persist to `localStorage` with no error.
- [ ] Re-enable connectivity; if signed in, confirm cloud sync resumes without duplicating or losing the offline-logged entries.
- [ ] Kill Chrome for Android from the OS app-switcher while offline, reopen, confirm state survived.

### 1.4 Notifications
- [ ] Enable notifications via the Settings toggle; confirm the real Android permission prompt appears (not the in-app toggle alone).
- [ ] With the app open, verify at least one rule-based notification fires (e.g. seed a scenario matching the today's-workout-reminder rule).
- [ ] **Explicitly confirm the known limitation**: fully close the app (swipe away from recents) and wait past a scheduled reminder time — confirm (as expected, per the audit) that no notification fires, since there is no push server. This isn't a bug to file, it's a limitation to keep documented and visible in test records.
- [ ] Deny the notification permission; confirm the Settings toggle reflects the denial gracefully rather than looping or erroring.

### 1.5 Two-device / multi-device sync
- [ ] Sign in with the same account on two separate Android devices (or one device + desktop browser).
- [ ] While both are offline, edit the race goal/profile on device A and log a run on device B, then bring both online.
- [ ] Confirm which edit "won" and whether the other was silently discarded — this directly tests the whole-object last-write-wins gap flagged in the audit (Section D). Record the actual observed behavior; do not assume it matches the source-code prediction without confirming live.

### 1.6 Accessibility (manual, since no automated a11y tooling runs in this repo yet)
- [ ] Turn on TalkBack (Android's screen reader); navigate the header icon row, the bottom tab bar, and a Side Mission card. Record every control that announces nothing useful (cross-reference the audit's Section K — expect most icon-only buttons to fail this).
- [ ] Increase the system font size to its largest setting; confirm text doesn't clip or overlap.
- [ ] Check color contrast on the dark theme's faint/dim text classes against WCAG AA at typical outdoor-daylight screen brightness (a real running-app usage condition, not just indoor testing).

### 1.7 Performance on a real, non-flagship device
- [ ] Test cold start time on a low/mid-range Android device (not the newest flagship) — this is where the unminified ~244 KB `app.js` payload (audit Section L) is most likely to be noticeable.
- [ ] Test on a throttled/slow mobile network (Chrome DevTools remote debugging + network throttling, or a real weak-signal location) — confirm the network-first service worker doesn't leave the user staring at a blank screen for long before falling back to cache.

## Part 2 — Testable only once a TWA wrapper exists (see `GOOGLE_PLAY_CHECKLIST.md`)

- [ ] Confirm the TWA opens full-screen with no browser address bar (validates Digital Asset Links are correctly configured — the single most common TWA misconfiguration).
- [ ] Confirm Play's automated Pre-launch report runs clean (or triages whatever it flags) on first internal-track upload.
- [ ] Confirm app updates: push a new version, confirm the existing `sw.js` version-bump + `APP_UPDATED` postMessage mechanism actually surfaces to the user inside the TWA shell (this was flagged in the audit as unverified whether anything listens for that message client-side).
- [ ] Confirm behavior when Android's battery optimization / "unrestricted background activity" settings are set to their most aggressive/default state — since this app has no real background service, expect this to be a non-issue, but confirm rather than assume.
- [ ] Confirm the account-deletion flow works identically inside the TWA shell as it does in a normal mobile browser tab (it calls the same Netlify function either way, but the sign-in/session-token flow through Supabase should be spot-checked once inside a wrapper).

## Test data / accounts needed

- At least one Supabase test account with magic-link access, for the sync and account-deletion test cases.
- A seeded plan with multiple weeks and mixed workout types (long/quality/cross/rest), matching the seeding technique already established in this project's own development process (`localStorage.setItem('training_plan_v1', JSON.stringify({...}))` via a browser console), to avoid needing to manually click through the full onboarding wizard for every test run.
