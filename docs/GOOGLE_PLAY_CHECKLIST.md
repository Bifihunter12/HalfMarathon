# RACR — Google Play Checklist

Companion to `RELEASE_READINESS_AUDIT.md`. This is a realistic path from "no Android artifact exists" to a first internal-testing release, given this project is a vanilla JS PWA with no native wrapper (see the audit's Section 0). Nothing on this checklist has been started as of this audit unless marked ✅.

## Phase 0 — Prerequisites (do these regardless of packaging choice)

- [ ] Fix the SVG-only manifest icons (`RELEASE_BLOCKERS.md` CRITICAL-4) — every downstream packaging tool will want PNGs anyway.
- [ ] Add a `README.md` with real run/test/deploy instructions (currently missing entirely).
- [x] Privacy policy exists (`privacy.html`) — review the `support@zaeralabs.com` contact is real and monitored before it's linked from a public Play listing.
- [x] Medical/health disclaimer exists (`app.js:2015`, `app.js:3366`).
- [ ] Terms of Service — does not exist yet; Play increasingly expects one alongside the privacy policy for health/fitness-adjacent apps.
- [ ] Decide and document the real data-collection list for the Data Safety form now, while it's simple (see below) — don't wait until Play Console forces the question.

## Phase 1 — Package the PWA (recommended: TWA via Bubblewrap or PWABuilder)

This wraps the *existing, unmodified* web app in a minimal native Android shell that loads the live Netlify URL — it is a packaging/distribution layer only, not a rewrite. Netlify hosting, the Netlify Functions backend, and Supabase all stay exactly as they are.

- [ ] Confirm `manifest.json` passes a TWA generator's validation (icons, `start_url`, `scope`, `display: standalone` — the last three are already correct).
- [ ] Run Bubblewrap (`npx @bubblewrap/cli init --manifest=https://tubular-mochi-1a8ae6.netlify.app/manifest.json`) or use PWABuilder's hosted Android package generator.
- [ ] Generate/obtain a real Android signing keystore. **Store it somewhere durable and backed up outside this repo** — losing it means losing the ability to ever update the app on Play again under the same package ID.
- [ ] Set up **Digital Asset Links** verification: publish `.well-known/assetlinks.json` on the live Netlify domain, matching the TWA's package name + keystore SHA-256 fingerprint. Without this, the TWA falls back to showing a browser address bar instead of a true full-screen app — a real, common TWA pitfall.
- [ ] Produce a first signed `.aab` and confirm it installs and opens correctly on a real Android device (not just an emulator) before touching Play Console.

## Phase 2 — Play Console setup

- [ ] Create the app listing (package name, default language, app/game classification: app, free/paid: free unless a monetization plan changes this).
- [ ] Upload the signed `.aab` to the **Internal testing** track first (Play's own recommended first step — smallest audience, fastest iteration).
- [ ] Complete the **Data Safety form**. Based on this codebase's actual data flows (see `RELEASE_READINESS_AUDIT.md` Section F):
  - Collected: account email (if signed in via Supabase), training-plan/profile inputs, workout logs (distance/time/pace/RPE/pain/notes), optional Google Health activity data, AI-coach chat text (sent to OpenAI).
  - Not collected: precise or approximate location, camera, microphone, contacts, SMS, call logs.
  - Shared with third parties: OpenAI (for AI coaching text only, not persisted by this app beyond the in-memory chat session), Supabase (account + synced training data, if signed in), Google (OAuth + Health data, only if the user explicitly connects it).
  - Data deletion: **Yes** — a real in-app account-deletion flow exists (`netlify/functions/delete-account.js`); this is a genuine advantage, most apps have to build this specifically for Play/GDPR compliance and this project already has it.
- [ ] Complete the **Content rating** questionnaire — expect a low/no-mature-content rating (fitness content, no user-generated public content, no chat between users, no violence).
- [ ] Add a short **App access** note for reviewers, since sign-in is optional: explain that the app is fully usable without an account, and provide a test account or magic-link bypass note if the reviewer needs to see the signed-in state.
- [ ] Write the **Store listing** copy honestly — do not claim "GPS tracking," "real-time pace," or similar, since this app deliberately has no location/GPS feature (see the audit's Section F) and false claims here are a direct, avoidable Play policy risk.
- [ ] If any AI-generated content is user-facing (it is — coach responses, workout explanations, celebration messages), consider whether Play's AI-generated content policies require a disclosure in the listing; review current Play policy text at submission time since this area changes.

## Phase 3 — Pre-launch checks Play runs automatically

- [ ] Review the automated **Pre-launch report** Play generates on first internal-track upload (crash/ANR scan across real device farm, accessibility scan, security scan) — expect the accessibility scan to surface real findings given this audit's Section K (near-zero ARIA usage).
- [ ] Confirm target API level meets Play's current minimum requirement at submission time (Bubblewrap/PWABuilder set this automatically to a recent default — verify it wasn't pinned to an older value by the generator's own defaults).

## Phase 4 — Before closed/production tracks

- [ ] Fix the CRITICAL items in `RELEASE_BLOCKERS.md` (crash reporting, some real analytics, at minimum the accessibility gaps the pre-launch report will have already flagged).
- [ ] Confirm the Digital Asset Links file stays correctly served at the production domain (a common regression source if the domain or hosting config ever changes).
- [ ] Re-run the full Node test suite (`npm test`) and manually re-verify the live site, matching this project's own established verification habit, before every promotion between tracks.

## Explicitly out of scope for a first release

- Native GPS/location tracking — this app deliberately doesn't use it; don't add it just to "feel more like a running app" without a real product reason, since it reopens permission/privacy/battery concerns this audit found to currently be a strength (zero location permission surface).
- Subscriptions/IAP — no payment code exists; nothing to disclose until a monetization plan is built.
