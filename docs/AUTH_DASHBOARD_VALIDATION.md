# Dashboard navigation and authentication validation

30 October 2026. Scope: front-end account entry, Guest isolation, session restoration, offline recovery and Android visual validation. No account financial API, sync, import, production Clerk instance or new authentication dependency was implemented. Environment files and credential values were not inspected or changed by this work.

## Root cause and corrected architecture

There was no authenticated dashboard route. The startup resolver, Welcome redirect and protected-route fallback explicitly pointed signed-in users to `/account`. The SSO callback reused Welcome, inheriting the same destination. This was an application routing decision, not a failed Google provider roundtrip.

A separate protected `(account)` navigator now owns `/dashboard` and `/account`, with Dashboard as its anchor. `navigationFor` provides the shared destinations and route permissions. The SSO callback resolves verified state instead of reusing Welcome. Root protected screens remove stale entry and Guest history when account access becomes active; the ledger boundary independently checks the same policy before mounting Guest storage. Pending verification has its own `/verify` destination and cannot enter Dashboard or Guest.

| State / choice | Destination |
| --- | --- |
| Active verified Clerk account with saved account checkpoint | `/dashboard` |
| Additional verification required | `/verify` |
| Auth unknown, workspace unreadable, or saved account awaiting restoration | Session-check screen |
| Explicit sign-out and saved entry choice | `/welcome` |
| Verified signed-out session with saved Guest choice | `/home` |
| Explicit saved-Guest recovery while Clerk is unavailable | `/home` in `guest-offline` mode |

The Android test exposed a transient signed-out update before the saved account was restored. A saved account now stays on the session-check screen through that update. If Clerk settles without an active session, the user can explicitly sign out and return to Welcome; the app does not silently reinterpret that account as Guest.

## Dashboard and financial boundary

Dashboard uses the actual Clerk profile name, with a neutral fallback. Account displays the same identity and email. A profile action opens Account; Back returns to Dashboard. Separate borrowing and lending cards use em dashes and unavailable labels, not invented zero balances. Recent activity has an explicit unavailable state. There are no Add Debt, Add Lending, transaction or import actions in the account area.

Account screens do not import the Guest repository, financial selectors or Guest provider. Existing financial domain calculations, encryption, database schema and repository source remain unchanged. Choosing Guest still uses the existing encrypted repository and idempotent onboarding command. Sign-out clears the Clerk session and saves the entry choice; it does not delete the Guest ledger or automatically open it.

## Offline behavior

A SecureStore workspace marker records only `entry`, `guest` or `account`. It contains no identity, token or financial data and never grants account access. Account intent is durably saved before launching either browser authentication flow. Restored account access is held until its account checkpoint is saved. Writes serialize; failures block unsafe recovery.

After an eight-second initialization delay, a known saved Guest workspace offers an explicit **Open saved guest workspace** action. Unknown or saved-account contexts never receive this action. Recovery mounts only the existing Guest provider. If Clerk later resolves signed out, Guest stays on Home; an active or pending account immediately takes precedence and removes Guest access. Google is unavailable while identity remains unresolved. Offline Welcome provides an explicit Retry connection action so users can reconnect before starting Google sign-in.

**Retry connection** uses Expo 58's supported runtime reload, retaining the same bundle and persisted data. Merely remounting the provider was rejected after inspecting the SDK's native singleton and observing unreliable recovery. An unreadable marker fails closed and offers retry. Existing installations without a marker need one connected identity check before offline recovery can be offered safely; this avoids guessing whether an old installation last used an account.

## Files changed

- Routing: `src/app/_layout.tsx`, `index.tsx`, `sso-callback.tsx`, `welcome.tsx`, new `(account)/_layout.tsx`, `(account)/dashboard.tsx`, `(account)/account.tsx`, and `verify.tsx`. The old root Account route moved into the protected group.
- Auth: `src/features/auth/session.tsx`, `clerk-session.tsx`, `flow.ts`, `ledger-boundary.tsx`; new `entry.tsx`, `navigation.ts`, `workspace-state.ts`, `workspace.tsx`, `startup.tsx`.
- UI: `src/components/nodebt/ui.tsx` adds an optional safe Back fallback; Guest Home adds an offline recovery notice.
- Regression tests: `tests/auth-navigation.test.ts`.
- Documentation: this report, `AUTH_READINESS.md`, `CLERK_AUTH.md`, and the application README.

## Visual review

The actual folder is `Design reference`, rather than the brief's `Design preference`. All five references had already been reviewed; the design system and dashboard board were inspected again against the Android captures. The dashboard follows their Inter typography, warm neutral background, green identity, outline icons, profile access, separate summary cards, rounded surfaces and section hierarchy. Borrowing uses a muted danger icon; lending uses brand green. The existing official brand mark is reused.

Account uses the same Page/Card/Badge/Button components and spacing. The startup review found misleading default copy about opening local records and an On-device badge while account identity was unresolved; these were replaced with session-check copy and a Private access badge. Expo's deprecated initial-route option was replaced with its current anchor setting after native runtime feedback.

Reference artwork includes sample balances, a net-position panel, charts and functional Add actions. Those are intentionally absent from the account experience because account financial storage is unavailable and the approved financial rules keep obligations and receivables separate. No pixel-perfect match to reference sample data or unsupported features is claimed. Responsive behavior inherits the existing grid breakpoint, large-text stacking, scroll containers and shared light/dark tokens; the new dashboard was additionally checked at 840 x 1800 pixels and 130% font scale: summary cards stack, the profile action stays reachable and text wraps without horizontal clipping. Settings were restored afterward. iOS and further viewport/theme coverage remain to be accepted.

## Local screenshot evidence

Actual Android screenshots and accessibility hierarchies are stored in the ignored `.expo/post-login-validation` directory because the account captures contain real profile details. They are local review artifacts, not files to publish. No authentication dialog was automated.

- [Fresh Google Dashboard](../.expo/post-login-validation/google-success-dashboard.png)
- [Fresh Google Account](../.expo/post-login-validation/google-success-account.png)
- [Authenticated restart](../.expo/post-login-validation/restored-dashboard.png)
- [Blocked Guest record deep link](../.expo/post-login-validation/blocked-account-guest-link.png)
- [Blocked Welcome deep link](../.expo/post-login-validation/blocked-account-welcome-link.png)
- [Android Back exits to launcher](../.expo/post-login-validation/dashboard-back-exit.png)
- [Final account offline startup](../.expo/post-login-validation/final-account-offline.png)
- [Account reconnected](../.expo/post-login-validation/final-account-reconnected.png)
- [Compact layout at 130% text](../.expo/post-login-validation/compact-large-text-dashboard.png)

Validation scripts wait for fresh accessibility dumps and expected text before capturing. Transient Android null-root dumps are retried; stale dump files are removed. Early attempts affected by emulator disconnection or ambiguous screen-label assertions are not acceptance passes. No existing app data was cleared to simulate a fresh installation.

## Acceptance results

The existing Medium Phone Android emulator was used at 1080 x 2400 and default density/text scale. Its app data was retained. The user had previously completed a real Google sign-in; the existing active account was used for native account checks. No synthetic identity was substituted.

| # | Requested scenario | Result and evidence |
| --- | --- | --- |
| 1 | Fresh installation opens Welcome | Not passed on device. Two isolated ephemeral Android-profile attempts failed before usable app entry (initial optional development discovery permission, then unstable/null accessibility roots). The original installation was not cleared. Fresh-context routing has automated coverage. |
| 2 | Google success opens Dashboard | Existing real active account opens Dashboard. The user completed a fresh Google retry on the final code; the agent then captured Dashboard and verified navigation. |
| 3 | Correct identity | Actual Clerk name appears on Dashboard; Account displays the same real name/email. The user confirmed the intended name after the fresh Google sign-in. |
| 4 | Android Back | Profile Back returns to Dashboard; Dashboard Back exits to Android launcher. No stale auth screen appeared. |
| 5 | Force-stop/reopen | Passed with the existing valid signed-in session: Dashboard restored. An additional cold emulator boot also restored it. |
| 6 | Sign-out | Passed via actual Account Sign out button; Welcome persists through force-stop/reopen. Guest was not entered automatically. |
| 7 | Google cancellation | The user cancelled the real Google flow and confirmed Welcome returned. Automated activation/cancellation tests also pass. |
| 8 | Google retry | The user retried real Google sign-in successfully; the agent captured the resulting Dashboard and Account. |
| 9 | Continue as Guest | Passed on device: opens Guest Overview through the existing encrypted repository. |
| 10 | Guest records after restart | Existing empty Guest workspace restored on device. Populated persistence passes isolated real-SQLite tests; a populated real-app restart is not claimed. No sample records were inserted into the user's ledger. |
| 11 | No Guest records in account | Account has no Guest storage/provider/selector dependency. Actual Dashboard shows unavailable account balances rather than local totals; populated real-app cross-mode acceptance remains to be run. |
| 12 | Signed-in deep links / Back | Guest record creation and Welcome deep links returned to Dashboard; profile Back and Dashboard exit passed. No guest financial screen appeared. |
| 13 | Signed-out account protection | Dashboard deep link after sign-out returns Welcome. Account deep link while Guest returns Guest Overview. |
| 14 | Rapid state transitions | Serialized checkpoint/request-gate and restoration transition tests pass. Native Back/deep-link transitions pass; a rapid live provider-event stress test is not claimed. |

Offline device checks passed for saved Guest cold startup with Wi-Fi and cellular data disabled: session-check screen offers explicit saved-Guest recovery, which opens the local Overview. Returning connectivity leaves Guest on Overview. The account offline test showed the session-check screen with no Guest recovery action. Emulator network settings were restored afterward. The final runtime-reload Retry action was exercised from the offline Guest entry state: connected Guest Home restored and Welcome's Google action became enabled. After the fresh Google sign-in, final-code account cold startup was tested offline again: no Guest recovery was offered. Restoring connectivity and tapping Retry connection restored the authenticated Dashboard.

The device temporarily disconnected and some early automation attempts used ambiguous labels. Those failed attempts are excluded. Checks were rerun with explicit coordinates derived from fresh accessibility bounds and unique target-screen text.

Additional captures:

- [Signed-out Welcome](../.expo/post-login-validation/signed-out-welcome.png)
- [Signed-out restart](../.expo/post-login-validation/signed-out-restored-welcome.png)
- [Guest Overview](../.expo/post-login-validation/guest-home.png)
- [Guest restart](../.expo/post-login-validation/guest-restored.png)
- [Saved Guest offline recovery](../.expo/post-login-validation/guest-offline-recovery.png)
- [Guest Home offline](../.expo/post-login-validation/guest-offline-home.png)
- [Guest after network restoration](../.expo/post-login-validation/guest-after-network-return.png)
- [Offline Welcome retry](../.expo/post-login-validation/offline-welcome-retry.png)
- [Connected runtime recovery](../.expo/post-login-validation/guest-runtime-reloaded.png)

## Isolated Android test limitation

Two temporary ephemeral Android OS profiles were created to attempt fresh app data and a populated Guest fixture without modifying the primary installation. The first attempt stopped at the development client's optional nearby-device discovery permission. The retry did not yield a stable interactive accessibility root. Neither reached record creation, so no synthetic financial record was inserted. Both ephemeral profiles were removed when returning to the primary Android profile; a separate check confirmed no acceptance profile remained. The primary account was still signed in afterward. These attempts do not count as fresh-install or populated native persistence passes.

## Automated validation and remaining gates

Application TypeScript, test TypeScript and Expo ESLint pass. **Full suite: 93 passed, 0 failed** after the final code change (31 auth/build/routing tests and 62 existing tests). The new routing suite has 13 tests covering active/restored Dashboard entry, verification isolation, unknown-state protection, logout choice, offline eligibility, network restoration, durable account intent, failed/invalid storage, write ordering, checkpoint publication, in-flight action protection and transient signed-out restoration. Existing financial/storage tests remain intact.

Fresh Google cancellation, retry and the intended identity are accepted by the user on the final code; subsequent Dashboard, profile, protected-link, cold-restart and account reconnection evidence was captured by the agent. Fresh-install, populated native Guest persistence/isolation, rapid live provider-event stress and iOS remain explicitly unverified. The isolated fresh-data attempts are described above. Backend design can proceed against the isolated account boundary; account financial APIs and production release remain gated.

## Backend recommendation

The separate account UI is an appropriate entry point for the next backend design milestone. Do not enable account financial endpoints until verified Clerk tokens establish server identity, every operation enforces ownership, account storage is isolated, and Guest import has an explicit reviewed flow. Production configuration, deletion/recovery policy and iOS acceptance remain separate gates. This work does not implement or enable those capabilities.

Reference contracts: [Expo protected routes](https://docs.expo.dev/router/advanced/protected/), [Expo 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Expo 58 runtime reload](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#reloadappasyncreason), [Clerk useSSO](https://clerk.com/docs/reference/expo/native-hooks/use-sso). Installed SDK source was also inspected for provider persistence and initialization behavior.