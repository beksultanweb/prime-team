# Location UI developer handoff

## Mobile changes

- Profile → Геопозиция now has one explicit native location switch, no location-consent checkbox. Switching on is the opt-in action; explanatory copy remains visible.
- «Условия геопозиции» is a collapsed button/accordion with an accessible expanded state. It displays the complete, unmodified server `status.notice`, including while tracking is enabled.
- Switch-on still calls `enableLocationTracking` → `prime_core.mobile_location.enable_tracking` with `accept=1` and the displayed notice hash. OS foreground/background permission requests are unchanged. Refreshing status, opening the disclosure, and receiving changed terms never opt in automatically.
- `LocationStatus.attendance` is typed with the existing attendance shape. `legal_consent_required` displays an actionable link to the current platform origin's `/legal-consent` and prevents new opt-in until cleared. Turning tracking off remains possible. Fresh server attendance supersedes stale local prerequisite information.
- Platform `LegalConsentGate` and its separate document acceptance flow are unchanged. This screen never accepts platform legal documents.
- Hash mismatch still fails closed before acquiring/uploading a location. The error now asks the user to review the disclosure in the profile and turn the location switch on again. The 07:00–21:00 Asia/Almaty policy and five-minute target interval are unchanged.

## Tests and reproduction

From the repository root after installing workspace dependencies:

```sh
npm run test:location
npm run test:auth
# Or all current mobile node tests:
node --test apps/mobile/tests/*.test.cjs
```

`test:location` now includes `location-screen.test.cjs`. It uses the existing `node:test` + TypeScript transpilation/VM pattern, with real React hooks and `react-test-renderer` 19.1.0. Native controls, OS APIs and tracking services are boundary doubles; the actual screen is rendered and its switch, accordion, refresh and legal link handlers are exercised, rather than only checking source regexes. The renderer is pinned to the app's React version; Yarn's existing react-is/scheduler resolutions are retained.

Verified locally with Node v26.7.0 and isolated scratch dependencies (no remote checkout modified): **30 tests passed, 0 failed** (22 location/runtime/UI, 8 auth). `git diff --check` passed. RED runs first demonstrated the checkbox/accordion failure, missing legal action/blocking, stale legal prerequisite and old hash-mismatch copy; implementation followed each failing behavior. Existing policy, permission-denial, revocation, account/session and queue tests remain green.

React 19 prints a known `react-test-renderer is deprecated` warning; assertions still pass. No full workspace TypeScript check, native build, emulator or device/store validation was performed. Before release, test iOS/Android permission prompts, VoiceOver/TalkBack accordion navigation, browser authentication/return from `/legal-consent`, explicit re-opt-in after changed terms, and the 07:00/21:00 boundaries on devices.

## Backend issue remains open

The reported notice hash includes **all companies**, so unrelated company changes can invalidate consent. The `prime_core` backend lives **outside this GitHub repository** and was **not changed** here. This mobile change does not fix hash scope or bypass mismatches. Backend owners must separately review deterministic disclosure/hash scoping, preserving invalidation when applicable terms actually change; until then, users may still need explicit re-opt-in after unrelated company changes.

## Conservative background/network follow-up

### Implementation and actual budget

- `last_attempt`, `next_attempt`, capped failure count and manual-recovery time are persisted in the existing encrypted config. A reservation is saved **before** OAuth/status work, so errors, an empty subsequent callback and JS/headless reload cannot reset the normal five-minute wall-clock network budget. Consecutive network failures wait 5, 10, then 15 minutes (cap); successful work resets it. This is event-driven, not a promised scheduler.
- Empty/invalid native deliveries with no unexpired queue do not refresh OAuth or request `get_status`. Idle foreground polling during the cooldown returns before OS permission/service checks. Foreground acquisition when due is deliberately the exception to “point first”: it preflights authorization before requesting a new OS position, to detect revocation before acquisition. A failed/missing fix still consumes the reserved attempt; a failed position request cannot erase offline backoff.
- Newest valid native fix is selected **before** advancing sampling state. An unsent queued fix can be replaced by a newer one without sliding the network deadline; acknowledged observations require at least five elapsed minutes, not merely a slot boundary. An older queued retry never suppresses due foreground acquisition. Queue is still one point, upload age at most ten minutes; newly received fixes still use the existing stricter one-minute freshness validation. Expired encrypted data is ineligible and pruned on subsequent work, not by an exact background deletion timer.
- Every actual upload is preceded by a successful current auth/status check for availability, consent, user and notice hash; `legal_consent_required` now also stops native/foreground collection fail closed. Refresh success followed by a failed status request **does not authorize an upload**. Local disable/logout/site switching still aborts in-flight work and clears local authorization/queue. No new automatic opt-in or document acceptance.
- Routine healthy limit per installation: **12 attempt cycles/hour**, normally **24 location API calls/hour** (`get_status` + `record_points`), or **168 cycles / 336 location API calls** over an uninterrupted 07:00–21:00 window. These are calculated upper budgets, not observed server/device throughput. OAuth token refresh may add a request when needed. After sustained failures, the cap permits **4 attempt cycles/hour**; a failed status produces no record request. Fewer callbacks/fixes can mean fewer requests, missed confirmations or no delivery.
- Explicit profile “Обновить состояние” may bypass a failed-attempt cooldown once; further manual bypasses are five minutes apart, persisted across reload. It never bypasses auth/consent/permissions or sample freshness. Automatic app-resume/30-second UI timer ticks do **not** force recovery. Profile status loads/manual refreshes, opt-in/revoke and other app traffic are outside the routine location budget; the profile refresh additionally fetches UI status. A user can therefore exceed the routine totals with explicit actions. The wall clock must be reasonably correct; backward clock changes conservatively postpone attempts.

### SDK54 native options and limits

The existing Expo SDK54 / `expo-location ~19.0.8` contract was checked against Expo's SDK54 source, not the current redirected docs:

- Source: `https://github.com/expo/expo/blob/sdk-54/packages/expo-location/src/Location.types.ts` (`LocationAccuracy`, `LocationOptions`, `LocationTaskOptions`, `LocationTaskServiceOptions`).
- Balanced accuracy and five-minute deferred/batched delivery were **already configured**; they are retained. Android alone receives `timeInterval` and the visible foreground-service notification with supported `killServiceOnDestroy: true`. No unsupported “silent” notification option was invented. iOS alone receives its background indicator and explicit `pausesUpdatesAutomatically: false`.
- Zero distance threshold and no iOS automatic pausing intentionally preserve stationary second IN/OUT observations. Backend confirmation still requires two observations 5–15 minutes apart; no backend changes. OS delays/backoff can exceed that span, in which case confirmation must wait for a later suitable pair.
- Native subscription starts only if not already started, not on each event. No geofencing rewrite, SDK/dependency upgrade, native hardware GPS power-down claim, exact iOS timer, killed-app wake guarantee or measured battery saving. The demonstrated improvements are bounded network/JS/native-query work, not battery measurements.

### Verification and release gate

Strict RED→GREEN slices demonstrated persisted burst throttling, empty callback/newest-first behavior, capped backoff/recovery, platform option selection, user-facing refresh/copy, idle native-query reduction, same-slot newest queue retention, frequent offline coalescing, position failure/backoff preservation, and legal-prerequisite fail-closed behavior. Regression tests also cover record failure, revocation before new acquisition, sample intervals, freshness and prior consent/auth/window gates. The native task handler is exercised with `AppState = background`, on iOS and with Android-specific options; headless module reload shares only persisted storage.

```sh
NODE_PATH=/opt/data/cache/scratch/prime-team-location-test-deps/node_modules node --test apps/mobile/tests/*.test.cjs
```

Follow-up result: **42 tests passed, 0 failed**, with the existing React renderer deprecation warnings. Full output: `/opt/data/cache/scratch/prime-team-energy-tests.log` (scratch artifact, not committed). `git diff --check` also passes. Parent verification additionally exported Android and iOS Hermes JavaScript bundles successfully with Expo SDK54 / Node22 in an isolated DEV build directory, using `EXPO_PUBLIC_PRIME_SITE_URL=https://dev.primegc.kz`. These exports are build checks, not signed store binaries. Full workspace typecheck, signed native build and physical-device UAT were not performed here.

Before pilot: physical iOS and Android locked/background stationary IN→second IN, transitions OUT, deferred/burst deliveries, low-power/Doze modes, airplane mode longer than queue/backoff, manual recovery, permission/consent/legal/hash revocation, expired OAuth, site/logout cancellation and 07:00/21:00 boundaries. Measure OS callback counts, actual API request totals and energy usage on devices against baseline before claiming battery improvement. Keep GPS attendance rollout gated pending that UAT.

## Release ownership

Commit/push are left to the parent/developer. Native build/signing, store privacy/disclosure review and store publication remain the developer's responsibility. No production system, store setting or backend checkout was modified.
