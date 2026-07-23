# RACR — Release Readiness Audit

**Date:** 2026-07-22
**Scope:** `C:\Users\carol\OneDrive\HalfMarathon` (repo remote: `Bifihunter12/HalfMarathon.git`, branch `main`, live at `https://tubular-mochi-1a8ae6.netlify.app/`)
**Auditor framing requested:** senior Android release engineer / mobile QA lead / security reviewer / performance engineer, evaluating Google Play release readiness.

## 0. Framework and architecture — read this first

**This is not an Android project.** There is no React Native, Expo, Flutter, Capacitor, Cordova, or Trusted Web Activity (TWA) wrapper anywhere in this repository. A repo-wide search for `android/`, `ios/`, `capacitor.config.*`, `*.gradle`, `AndroidManifest.xml`, and `twa-manifest.json` returned zero matches. There is no `app.json`/Expo config, no Gradle wrapper, no keystore, no native build tooling of any kind.

**What this repo actually is:** a hand-written, zero-build-step, vanilla JavaScript Progressive Web App —

- `index.html` + `style.css` + four plain `<script>`-tag JS files (`app.js`, `side-quests.js`, `path-system.js`, `xp-system.js`) — no bundler, no transpiler, no npm dependency for the app itself.
- `manifest.json` + `sw.js` (a hand-written service worker) make it installable to a home screen via the browser's native "Add to Home Screen" / `beforeinstallprompt` flow — this is what lets it *behave* like an app on Android today, without ever becoming an Android package.
- A Netlify Functions backend (`netlify/functions/*.js`, 7 serverless functions) proxying OpenAI and Google Health, plus Supabase for optional account sync.
- `package.json` exists only to run the Node test suite (`node --test`) for the Netlify functions and the three pure domain modules — it is not a build tool for the app.

**Direct answers to the five questions asked:**

1. **Can the project produce a signed Android App Bundle (.aab)?** No. There is nothing to sign or bundle — no Android module exists to build. This is not a broken build; there is no build.
2. **Does it target the required Android SDK?** N/A — there is no `targetSdk`/`compileSdk`/`minSdk` anywhere because there is no Android manifest. If wrapped as a TWA later (see `GOOGLE_PLAY_CHECKLIST.md`), the wrapper generator (Bubblewrap/PWABuilder) sets these, not this repo.
3. **Is it realistically ready for Google Play internal testing?** No — internal testing on Play requires an uploaded `.aab`/`.apk`. None can exist until a TWA (or native/RN/Flutter rewrite) wrapper project is created. That is a real, separate, multi-day engineering task, not a config fix.
4. **What blocks release?** See `RELEASE_BLOCKERS.md` — the top blocker is the missing Android artifact itself; below that are real product-quality issues (accessibility, observability, icon format) that should be fixed regardless of packaging, before any real users see this on any platform.
5. **What could cause crashes, bad reviews, data loss, battery drain, privacy problems, or Play rejection?** Answered category-by-category below, with evidence, for everything that is actually knowable from this codebase today.

Given this, the audit below covers every category the user asked about, but **native-Android-specific items (build config, signing, Gradle, permission manifest entries, ProGuard, targetSdk compliance) are marked N/A with the reason**, and effort instead goes into the real, verifiable equivalent concerns for a PWA — which map onto almost every other category (stability, security, data sync, offline, notifications, accessibility, performance, compliance) just as legitimately.

---

## A. Build and release configuration

| Item | Finding |
|---|---|
| Android package/application ID | N/A — no Android project |
| versionCode / versionName | N/A — no Android project. **PWA-equivalent exists and is well-maintained**: `app-version.json` (`{"version":"2026.07.22.8"}`), mirrored in `sw.js`'s `APP_VERSION` const and every `?v=` query string in `index.html`. Verified all three are in sync as of this audit. |
| targetSdk/compileSdk/minSdk | N/A |
| Release build configuration | N/A — no build step exists by design (confirmed via `package.json`'s own description: *"the app itself stays a build-step-free vanilla JS PWA"*) |
| Signing configuration | N/A — nothing to sign |
| ProGuard/R8/minification | **Gap.** `app.js` is 4,390 lines / ~244 KB uncompressed, served unminified, unbundled, in one file. No minifier, bundler, or tree-shaking exists anywhere in the toolchain. See Performance (L). |
| Environment variables and secrets | **Good.** All real secrets (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_HEALTH_CLIENT_SECRET`) are read via `process.env.*` only inside `netlify/functions/*.js` (confirmed by grep — 9 occurrences, all server-side). Nothing resembling a real API key (`sk-...`, `AIza...`, PEM private key blocks) was found anywhere in tracked source. |
| Debug code accidentally enabled | None found (no `console.log`-driven debug flags, no hardcoded `debug: true`) |
| Dev endpoints or localhost references | None found — every `fetch()` call site targets relative `/.netlify/functions/*` paths, which resolve correctly in both local dev (`netlify dev` or the plain static server used this session) and production. |
| Production API configuration | The Supabase client key hardcoded in `app.js:1121` (`sb_publishable_...`) is Supabase's public **publishable key** format — this is meant to be public and relies on Row Level Security policies for protection, not secrecy. **Could not verify from source whether RLS policies are actually enabled/correct on the Supabase project** — that lives in Supabase's dashboard, not this repo. Flagged as unverifiable, not as broken. |
| Dependency conflicts / outdated deps | `package.json` has **zero dependencies** (by design, for the test runner). The app itself loads exactly one third-party script at runtime: `@supabase/supabase-js@2` via the jsDelivr CDN in `index.html` (unpinned to an exact version — floating `@2` tag). A breaking minor/patch release on that CDN could silently break auth/sync with no warning. |
| Android App Bundle generation | N/A |
| Reproducible build instructions | There is no `README.md` in the repo at all. A new contributor (or reviewer) has no written instructions for running tests, running the app locally, or deploying. |

---

## B. Crash handling and stability

- **Automated test coverage exists but is incomplete in an important way.** `npm test` → 92/92 passing (verified live during this audit). All 92 tests cover: the 7 Netlify functions (`tests/*.test.js`) and the pure domain logic in `side-quests.js`, `path-system.js`, `xp-system.js`. **Zero automated tests exist for `app.js` itself** — the ~4,400-line file containing the plan generator, all rendering, all state mutation, and the merge logic that reconciles two devices' data. This has been a real, repeated source of bugs this project has caught only through manual live-browser testing (see project history: three separate `mergeRunnerState` data-loss bugs found and fixed by hand across the life of this project, none of them caught by an automated test because none could exist for that file).
- **Error handling on network calls is actually solid.** All 8 `fetch()` call sites in `app.js` (lines 1102, 1326, 1390, 1410, 1432, 3293, 3647, 4349) either chain `.catch()` or sit inside `try { } catch (e) { }` (the 3 `await fetch` call sites at 1326/1390/1410/1432 are all wrapped). Every AI-backed feature (coach chat, "why this workout," weekly recap, celebration messages) has a documented, deterministic local fallback when the network call fails — this was verified multiple times this session and is a genuine strength.
- **No crash reporting / error tracking service.** Grepped for Sentry, Bugsnag, Crashlytics, Rollbar — no real integration exists (one substring false-positive on the variable name `isEntry` was the only hit). If a real user hits a JS exception in production today, **no one is notified** — it fails silently in that one user's console.
- **No CI pipeline.** `.github/workflows/` does not exist. The 92-test suite only runs when a human remembers to run `npm test` locally before committing. Nothing blocks a broken commit from reaching `main`/production.
- Lifecycle/navigation: this is a single-page hand-rolled router (no history API usage beyond the Google Health OAuth redirect handling at `app.js:1386`) — there's no "back button" browser-navigation concern of the kind a real SPA router would need to handle, which removes a whole class of native-navigation bugs, but also means there's no deep-linking beyond that one OAuth redirect case.

---

## C. Login and account flows

Auth is Supabase magic-link email sign-in (`CloudSync` object in `app.js`), fully optional — the app works entirely offline/local-only if the user never signs in.

- **Signup/login**: magic-link only, no password to manage, no password-reset flow needed (there's no password).
- **Session persistence / token refresh**: delegated entirely to the Supabase JS SDK's own session handling — not custom code in this repo, so its correctness rests on Supabase's SDK, not something this audit can verify further from source.
- **Account deletion**: a real, two-tier flow exists — self-service "delete my cloud data" (client-side RLS row delete) and full "delete my account permanently" (`netlify/functions/delete-account.js`, server-side, uses the service-role key, correctly gated behind a live session token check — see `app.js:1320-1336`, wrapped in try/catch, returns a clear error object rather than throwing). This is **better than many production apps ship with** for GDPR/CCPA-style deletion requests.
- **Privacy requests**: `privacy.html` has an explicit rights section directing users to email `support@zaeralabs.com` with a 30-day response commitment (line 191). **Unverified: whether that mailbox is real and monitored** — this has been flagged internally before and was never confirmed.
- **App restart behavior**: state is always loaded fresh from `localStorage` on every load (`loadState()`); cloud state, if signed in, is merged in via `mergeRunnerState` — this merge function is the single most safety-critical piece of code in the app and has no automated test coverage (see Stability above).
- **Deep links**: the only one is the Google Health OAuth redirect (`app.js:1380-1403`), which does correctly check CSRF state before accepting the code and silently drops on mismatch (line 1387) — a good, defensive default.

---

## D. Data syncing and persistence

- **Local storage**: a single `localStorage` key (`training_plan_v1`), plain JSON.
- **Cloud sync**: Supabase, optional, `mergeRunnerState` reconciles local vs. remote on every sync.
- **Conflict handling — mixed maturity.** Recently-added fields (`xpEvents`, `sideQuestLog`, `completedQuestTracks`, `badges`, `unavailable`, `pathNodes`) merge via **append-only union on a natural key** — safe, no data loss possible across two devices editing independently offline. **Older, larger fields (`raceGoal`, `profile`, `planMeta`) still merge as whole-object "prefer whichever device's `lastModified` is newer"** — if a user edits their plan on two devices while both are offline, one device's entire edit is silently discarded, with no conflict UI shown to the user at all. This is a real, live data-loss risk for any user who uses the app on more than one device.
- **`state.xp` was itself a real, now-fixed example of exactly this bug class** — it used to be a bare incrementing counter merged as a scalar (in-code comment at the time explicitly flagged this as fragile); it was rebuilt this session into an idempotent, union-merged event ledger specifically to close this gap. That fix is a strong pattern; it just hasn't been applied to every field yet.
- **Duplicate writes / partial saves**: `setLog`/`awardXp`/`logChallengeProgress` all use idempotency keys or delete-if-empty semantics — no evidence of duplicate-write bugs in the newer subsystems.
- **App reinstall / clear-data behavior**: since state lives in `localStorage`, an uninstall-and-reinstall (or a Chrome "clear site data") wipes all local state; if the user was ever signed in, cloud data alone should let them recover, but this recovery path is not automatically tested end-to-end.
- **Timestamps/time zones**: dates are handled via plain `Date`/`toISOString().slice(0,10)`-style local calendar dates throughout — this works but does not explicitly account for a user traveling across time zones mid-plan; a workout logged just after midnight in a new time zone could land on an unexpected day. Not verified as a live bug, just a design gap worth testing.

---

## E. Offline behavior

- `sw.js` implements a genuine **network-first, cache-fallback** strategy (full source reviewed above) — always tries the network, updates the cache on success, and only serves the cached copy when the network request itself fails. This is a sound, deliberate choice for an app whose content changes based on real dates/logged data, not a naive cache-first PWA.
- Old caches are correctly cleaned up on activate (matches by the `runner-`/`halfmarathon-` prefix), and connected clients are notified of a version change via `postMessage({type: "APP_UPDATED"})` — but **there is no visible confirmation that `app.js` actually listens for and acts on that message** in a way that prompts the user to refresh; if it's inert, users could sit on a stale cached version indefinitely without knowing.
- **Workout/side-mission logs write straight to `localStorage`** — they work fully offline by construction (no network dependency for core logging), which is a real strength.
- **No explicit "you're offline" UI indicator was found.** AI-dependent features (coach chat, "why this workout") degrade gracefully with a local fallback message when a fetch fails, but nothing proactively tells the user *why* before they tap the button.

---

## F. Permissions and privacy

- **No native Android permissions exist** (no manifest). The *browser-level* permission prompts this app can trigger are: Notifications (opt-in, gated behind a Settings toggle, confirmed at `app.js:1467-1471`) and the Google Health OAuth consent screen (a Google-hosted flow, not a device permission).
- **No camera, microphone, contacts, or SMS access anywhere in the codebase.**
- **No geolocation API usage at all** (`navigator.geolocation`/`getCurrentPosition` — zero matches). This is a deliberate, notable design choice: a running app that doesn't use device GPS relies entirely on manual logging plus optional Google Health import, which meaningfully *reduces* privacy/permission surface area compared to most fitness apps, at the cost of no live pace/route tracking.
- **Sensitive data exposure**: no personal data (email, workout logs, pain reports) was found being written to `console.log` anywhere in a spot-check of the logging call sites.
- **Insecure local storage**: `localStorage` is unencrypted by nature (true of any web app) — pain/injury reports and pace data sit in plaintext in the browser's storage. This is standard for the web platform and not unique to this app, but worth stating plainly for a privacy review.
- **HTTPS enforcement**: no `http://` reference exists anywhere in tracked source (`app.js`, `index.html`, `style.css`, `sw.js`, `manifest.json`, `netlify.toml` all clean) — Netlify additionally auto-provisions HTTPS and redirects HTTP by default.
- **Data safety form implications**: the real data categories collected are — account email (Supabase), training plan/profile inputs, workout logs (distance/time/pace/RPE/pain), optional Google Health activity data, and AI-coach chat content sent to OpenAI. All of this is knowable and documentable today regardless of Android packaging status — see `GOOGLE_PLAY_CHECKLIST.md` for the Data Safety form mapping.

---

## G. Notifications

- Implementation is `Notifications` in `app.js` (~line 1444 on), covering 8 of the reward-system's intended notification types (today's workout, rest-day note, missed-workout check-in, long-run hydration reminder, race countdown, plan-adjustment alert, return-after-break, weekly-recap-ready).
- **Critical, already-documented architectural limitation**: this is **local-only, no push server**. Notifications fire via the service worker's `showNotification` only while the tab/installed PWA is open or briefly resumed (a 30-minute `setInterval` while running). **They do not fire while the app is fully closed** — which is the single most common expectation users have of a training-reminder feature ("remind me to run tonight" implies the phone will buzz even if the app hasn't been opened). This is a legitimate, high-likelihood source of "reminders don't work" complaints and bad reviews if marketed as real push reminders without that caveat being visible to the end user.
- **Deduplication is handled correctly** — a dedicated `runner_notif_log` localStorage key prevents the same real-world event from firing twice across re-renders/interval ticks (verified in project history via a live stub test).
- **Time zone/DST**: notification timing logic runs on the device's local `Date`, so it inherits whatever DST handling the JS `Date` object gives for free — not separately tested for a DST-transition edge case.
- **Device restart / battery optimization**: because this isn't a native background service, Android's Doze/App Standby battery optimization is largely moot — there is no persistent background process to be killed, which is a side benefit of the current (also limited) architecture.

---

## H. Battery and background behavior

- No GPS/location polling (see F).
- No wake locks, no persistent background service, no native sensors used.
- The only recurring timer is the notification-check `setInterval` (~30 min) while the app/tab is actually open — negligible battery impact, and it stops entirely when the tab is closed (there is no way for it to run when closed, per the same limitation noted in G).
- Cloud sync push is debounced (`setTimeout(..., 5000)` after a state change, see `saveState`), avoiding a network call on every keystroke.

---

## I. Analytics and observability

- **No analytics or telemetry of any kind exists in this codebase** — grepped for Google Analytics, gtag, Mixpanel, Amplitude, Segment, PostHog across `app.js`, `index.html`, and every Netlify function: zero matches.
- Practical effect: there is currently no way to know onboarding completion rate, which features (Side Missions, Path, the new XP/challenge system) are actually used, where users drop off, how often AI calls fail in production, or whether the reward system is achieving its own stated behavioral goals. Every "verified" claim in this project's own history has been a manual, single-session spot-check — there is no aggregate, ongoing signal from real usage.
- No consent-management/cookie-banner code exists either, which is *consistent* with collecting no analytics, but would need to change the moment any analytics tool is added.

---

## J. Error messages and UX failure states

- AI-feature failures show specific, human-worded fallback text (e.g. *"Couldn't reach the AI coach right now – the explanation above still applies."*), not raw errors or stack traces — verified across `coach.js`/`why-workout.js`/`weekly-recap.js`/`celebrate.js` call sites.
- Form validation is generally soft (e.g. duration parsing silently returns `null` on unparseable input rather than blocking the user) — this avoids hard error states but also means a typo can silently produce no pace calculation with no explicit "that duration format wasn't recognized" message.
- No payment/subscription flow exists in this codebase at all (no Stripe/RevenueCat/IAP code found) — Category M's "subscription disclosure" requirement is currently moot because there is nothing to monetize yet.

---

## K. Accessibility

This is one of the weakest areas found in the audit, with concrete evidence:

- **`aria-label` appears exactly once in the entire ~4,400-line `app.js`.**
- **`role="..."` appears zero times anywhere in `app.js`.**
- At least 12 distinct icon-only button instances (`<i class="ti ti-...">` inside clickable elements — header icons for Progress/Glossary/Safety/Install/Edit/Settings, the 3-tab bottom nav, mission-card action buttons) with no accompanying accessible name found in a spot-check — a screen-reader user tabbing through the header would hear nothing meaningful for most of these controls.
- `<html lang="en">` **is** correctly set (`index.html:2`) — one real positive.
- No evidence anywhere of: explicit touch-target-size review, `prefers-reduced-motion` handling, focus-order review, or color-contrast auditing. None of this is necessarily *broken* — it has simply never been tested or instrumented, so no claim can honestly be made about it either way.
- Progress bars (`.progress-fill`, used for Path/Quest/Challenge progress) are rendered as plain `<div>` width percentages with no `role="progressbar"`/`aria-valuenow` — a screen reader has no way to announce current progress on any of these visual bars.

---

## L. Performance

- **Cold start**: no bundler means no code-splitting — the browser parses and compiles all ~244 KB of `app.js` plus the three domain modules on every fresh load, before anything renders. On a low/mid-range Android device (the exact population most likely to represent a free running app's real user base) this is a measurable, non-trivial delay compared to a minified/split bundle — not measured directly in this audit (no Lighthouse run was performed), but the file-size evidence alone supports flagging it.
- **No image optimization concerns** — icons are SVG (small), and there's no photo/asset-heavy UI, which meaningfully offsets the JS-size concern.
- **List virtualization**: the weekly plan view renders every week's every day as real DOM (`renderMain`) — for a long ultramarathon plan (up to 100-mile training cycles, per this project's own event table) this could be a meaningful number of DOM nodes rendered eagerly with no virtualization, though not extreme enough to be an obvious first-order problem at typical plan lengths (8-20 weeks).
- **No evidence of expensive synchronous work blocking the main thread** in a way distinguishable from normal small-app JS execution — the plan generator (`buildStructuredWeeks`) runs synchronously on every render of the main screen (confirmed, by design, in project history, "negligible at this app's scale, ~280 day-objects max") — a reasonable, previously-made engineering tradeoff, not a newly-found issue.
- **No CI-integrated performance budget or Lighthouse check exists.**

---

## M. Google Play compliance

Since no Android artifact exists, most of this category is **not yet startable**, not "failing" — the distinction matters for how urgently to act. What's already knowable and auditable today from the content/policy side:

| Item | Status |
|---|---|
| Privacy policy | **Exists** (`privacy.html`), describes local-first storage, optional Supabase sync, OpenAI usage, planned Google Health import, device-only OAuth tokens. Contact mailbox unverified (see C). |
| Terms of service | **Not found** anywhere in the repo. |
| Account deletion | **Exists and is real** (server-side, service-role-key-gated) — this is ahead of many shipped apps. |
| Data safety declarations | Not started (requires a Play Console listing to exist first) — but the actual data categories are fully knowable today (see F) and could be drafted in advance. |
| Content rating | Not started — trivial once a listing exists (fitness/health content, no user-generated public content, no violence/mature content). |
| Health/fitness claims | The app carries an explicit, twice-placed medical disclaimer (`app.js:2015`, `app.js:3366`) stating it is not a medical provider and does not diagnose — this is a real, correctly-scoped mitigation already in place. |
| Subscription disclosure | N/A — no subscription/payment flow exists in this codebase at all. |
| Permissions declarations | N/A pending a wrapper, but the *actual* permission surface (notifications only, no location/camera/mic) is already minimal and easy to declare honestly whenever the time comes. |
| Background location justification | N/A — no location access exists at all, so no justification will ever be needed for it. |
| Target API compliance | N/A until a wrapper exists; a current TWA-generator (Bubblewrap/PWABuilder) will default to a compliant target SDK automatically. |
| AI disclosure | The app's own coaching content is careful never to claim precision it can't back (see this project's own history of hard-coding "never invent a number" rules into every AI-backed Netlify function) — a real strength — but there's no explicit **user-facing** "this feature uses AI" label anywhere in the UI copy reviewed. |

---

## Summary of what's genuinely strong vs. genuinely weak

**Strong, evidenced, worth preserving:**
- Disciplined error handling on every network call, with deterministic non-AI fallbacks.
- A real account-deletion flow that goes further than most hobby projects bother to build.
- No secrets in source, correct server/client credential separation, HTTPS-only.
- A real, working service worker with a sound caching strategy.
- Zero unnecessary device-permission surface (no location, camera, mic, contacts).
- A demonstrated pattern (this session) of catching and fixing real data-loss bugs in the sync layer.

**Weak, evidenced, needs real work before any wider release (on any platform):**
- No Android/mobile-wrapper project exists at all — Play Store submission cannot start from zero here.
- No automated tests for `app.js` itself — the riskiest code in the project is the least tested.
- No crash reporting and no analytics — the team is flying blind on real-world failures and usage.
- Meaningful accessibility gaps (near-zero ARIA usage, unlabeled icon buttons, no progress-bar semantics).
- No CI pipeline enforcing the existing 92 tests before merge.
- Unminified 244 KB single-file JS payload with no build step.

See `RELEASE_BLOCKERS.md`, `GOOGLE_PLAY_CHECKLIST.md`, `TEST_PLAN_ANDROID.md`, and `FIX_ROADMAP.md` for the actionable breakdown, and the bottom of this document for final scores.

---

## Final scores (0–100, not inflated)

| Dimension | Score | Rationale |
|---|---:|---|
| Build readiness | **5** | No Android artifact of any kind exists; nothing to sign or upload. |
| Stability | **55** | Strong error-handling discipline and 92 passing tests, but zero coverage of the actual app logic and no crash reporting means real-world stability is unverified and unmonitored. |
| Security / privacy | **65** | No leaked secrets, correct key separation, HTTPS-only, real deletion flow, real disclaimers — undercut by no `.gitignore`, an unverified support mailbox, and no automated secret-scanning. |
| Offline resilience | **60** | Sound network-first service worker and fully-offline core logging — undercut by coarse whole-object conflict resolution on older state fields and notifications that don't survive the app being fully closed. |
| Accessibility | **20** | Near-total absence of ARIA roles/labels and unlabeled icon-only controls; the one clear positive (`lang="en"`) doesn't offset the scope of the gap. |
| Performance | **45** | No minification/bundling of a 244 KB single-file payload, no perf budget in CI — offset somewhat by a lean feature set and no heavy media assets. |
| Google Play compliance | **10** | No packaging exists to even begin the Play Console process; the content prerequisites that do exist (privacy policy, disclaimers, deletion flow) are in decent shape and will carry forward. |
| **Overall production readiness (as a web PWA — Android/Play readiness specifically is a 5)** | **45** | A thoughtfully-engineered hobby/personal project with real strengths in error handling and data safety, missing the basic production-operations layer (CI, crash reporting, analytics, tests-for-the-app-itself) and real accessibility work that any genuine wider release would need first. |
