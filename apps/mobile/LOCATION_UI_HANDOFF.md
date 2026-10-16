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

## Release ownership

Commit/push are left to the parent/developer. Native build/signing, store privacy/disclosure review and store publication remain the developer's responsibility. No production system, store setting or backend checkout was modified.
