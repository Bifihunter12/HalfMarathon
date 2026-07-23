# RACR — Fix Roadmap

Prioritized sequencing for everything found in `RELEASE_READINESS_AUDIT.md` / `RELEASE_BLOCKERS.md`. Nothing in this document has been implemented — it is a plan, not a change log. Effort estimates assume one engineer already familiar with this codebase.

## Must fix before internal testing (i.e. before a first TWA build even attempts to exist)

1. **Fix manifest icons** (`RELEASE_BLOCKERS.md` CRITICAL-4) — add real PNG icons with a properly padded maskable variant. *0.5 day.*
2. **Write a `README.md`** with real run/test/deploy instructions — currently missing entirely, and a TWA-wrapping engineer (even future-you) will need it. *0.5 day.*
3. **Add a `.gitignore`** — currently absent; low effort, meaningfully reduces the risk of an accidental future secret commit. *15 minutes.*
4. **Produce the first signed TWA build and verify Digital Asset Links** (`GOOGLE_PLAY_CHECKLIST.md` Phase 1) — this is the actual blocking work item; everything Play-specific depends on it existing. *1–3 days.*

## Must fix before closed testing (once internal testers have used a real build)

1. **Add crash reporting** (`RELEASE_BLOCKERS.md` CRITICAL-2) — without this, feedback from a wider tester group is the *only* way bugs surface. *0.5–1 day.*
2. **Add minimal analytics** (`RELEASE_BLOCKERS.md` CRITICAL-3) — closed testing is exactly when you want real usage signal on the newest features (Side Missions, Path, XP/challenges) before a production audience sees them. *1–2 days.*
3. **Fix the highest-impact accessibility gaps**: label the icon-only header/tab-bar buttons with `aria-label`, add `role="progressbar"`/`aria-valuenow` to the Path/Quest/Challenge progress bars. Play's own automated Pre-launch report will flag these regardless — better to have already fixed the obvious ones than to discover them there first. *1–2 days for the highest-traffic screens.*
4. **Extract and test `mergeRunnerState` + the plan generator** (`RELEASE_BLOCKERS.md` CRITICAL-1, scoped to the highest-value subset) — closed testing is exactly the phase where a silent data-loss bug in cross-device sync would otherwise go unnoticed until a real tester reports "my plan disappeared." *2–4 days.*
5. **Add a CI workflow** running `npm test` on every push/PR — cheap insurance against a regression reaching testers unnoticed. *0.5 day.*

## Must fix before production (open/public release)

1. **Full accessibility pass**: touch-target sizing, color-contrast review, `prefers-reduced-motion`, focus-order review across every screen — not just the highest-traffic ones. *3–5 days.*
2. **Resolve the whole-object last-write-wins sync gap** for `raceGoal`/`profile`/`planMeta` (`RELEASE_READINESS_AUDIT.md` Section D) — apply the same union/ledger pattern already proven for `xpEvents`/`sideQuestLog` this session. *2–3 days.*
3. **Minify/bundle `app.js`** (even a simple minifier pass without a full bundler rewrite would meaningfully cut the ~244 KB payload) — matters most for the lower-end Android devices most likely to represent a real free-app user base. *1–2 days, more if a real bundler + build step is introduced.*
4. **Write a Terms of Service** and confirm the `support@zaeralabs.com` mailbox is real/monitored before either document is linked from a public Play listing. *0.5 day + external verification.*
5. **Decide the notification-reliability messaging** — either build real push (Web Push + VAPID + a scheduled server function + per-user subscription storage, a materially larger feature) or make sure the in-app copy never implies reminders work while the app is fully closed, so expectations match reality before a wider audience forms opinions from a broken promise. *Messaging fix: 0.5 day. Real push: 1+ week, separate project.*
6. **Pin the Supabase CDN script to an exact version** instead of the floating `@2` tag, to avoid an unannounced upstream change silently breaking auth/sync in production. *15 minutes.*

## Can wait until after launch

1. Full extraction/testing of every remaining pure function in `app.js` beyond the highest-value subset already covered pre-closed-testing.
2. A real Lighthouse/performance budget wired into CI.
3. List virtualization for very long (50K/100-mile) training plans, if usage data (once analytics exists) shows this is actually a real-world pain point rather than a theoretical one.
4. Time-zone-aware date handling for users who travel mid-plan, if usage data shows this actually occurs and causes confusion.
5. Real push notifications (if not already prioritized into the pre-production phase above).
6. Any subscription/monetization flow and its associated Play disclosure work — entirely out of scope until a monetization decision is made.

## Sequencing rationale

The order above deliberately front-loads **observability** (crash reporting, analytics, CI) before deeper structural fixes, because every later phase — accessibility triage, sync-conflict fixes, performance work — is far more efficient with real crash/usage data in hand than working from source-code inspection alone, which is all this audit could use. The single highest-leverage non-packaging fix is extracting `app.js`'s pure logic into testable modules, since it is both the riskiest untested code in the project and the one most likely to produce a genuinely bad, hard-to-diagnose user-facing bug (silent data loss) if left alone through a period of increasing real usage.
