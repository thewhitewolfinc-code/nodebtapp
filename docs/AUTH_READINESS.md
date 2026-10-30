# Authentication readiness audit

Updated 30 October 2026 after the [Dashboard implementation and Android acceptance work](AUTH_DASHBOARD_VALIDATION.md). That report contains the root cause, changed files, design comparison, private local screenshots and detailed acceptance matrix. The original audit's remote configuration findings are retained below.

## Decision

The incorrect Account landing is fixed. Active Google sessions and valid restored sessions open the protected Dashboard; Account is a separate profile destination. The user confirmed real Google cancellation, successful retry and correct Dashboard identity. Android checks passed for profile navigation, sign-out to Welcome, restored sessions, protected links, saved Guest offline entry, network restoration and explicit account reconnection. Application/test TypeScript, Expo ESLint and **93 tests pass**.

This is development authentication readiness, not production release approval. Remaining device coverage is listed below. Backend design can proceed, but account financial endpoints must not be enabled without server identity and ownership enforcement.

## Fixed

| Finding | Resolution |
| --- | --- |
| Successful authentication opened Account | Added a separate protected Dashboard and centralized entry/guard decisions; Account remains accessible through profile navigation |
| A saved account could briefly see Welcome during a transient signed-out SDK restoration update | Saved account context stays protected until restoration completes or explicit sign-out returns to entry |
| Configured Clerk initialization indefinitely blocked local Guest entry when offline | Known saved Guest context offers explicit offline recovery after the initialization delay; account/unknown contexts cannot use it |
| Provider remount did not reliably restart native Clerk initialization | Retry uses Expo's supported runtime reload without deleting stored tokens or records; Guest and account reconnection were tested |
| Development callback allowlist was empty | Prior audit registered only `nodebt://sso-callback` and independently verified the exact URI |
| Missing browser result could request verification or activate a stale supplied session ID | Browser success is required before activation or follow-up; regression tests retain coverage |
| Future EAS production builds accepted missing/development keys | Production build profile requires explicit app identity and live-key prefix; Clerk still validates the key |

No account financial storage, backend API, sync, Guest import or production instance was implemented. The financial domain, schema, repository and encryption source are unchanged. Credential values and environment files were not inspected or edited by this work. Real Google interaction was performed by the user; agent device checks did not automate authentication dialogs.

## Remote configuration verified in the earlier audit

- Selected application: `app_3L2KODAdwaw7Mfoh6U3f7p9h9cb` (`Nodebt`), development instance only.
- CLI login/linkage/reachability passed Doctor, exit 0.
- Native API enabled; Google enabled and authenticatable.
- No mandatory organization selection or MFA enrollment for the current flow.
- Exact native callback allowlist entry independently verified.
- Production instance remains unconfigured.

The mobile runtime requires only the public publishable-key variable. Doctor's generic warning is not a reason to add a backend secret to mobile code. The new workspace marker stores only an entry/Guest/account choice and never grants authenticated access.

## Remaining backlog

| Gate | Work |
| --- | --- |
| Complete Android coverage | Fresh-data and populated Guest cases remain pending: isolated Android-profile attempts could not reach usable app entry and were cleaned up. Rapid live provider-event stress is not claimed by unit tests or deep-link tests |
| Legacy offline upgrade | Installations without the new workspace marker need one connected identity check before saved Guest recovery is offered; an old account must never be guessed to be Guest |
| Additional account requirements | Live-test hosted verification before requiring MFA, organization selection or additional sign-up steps |
| Account financial APIs | Verify Clerk tokens server-side; derive owner identity from verified claims; enforce ownership for every operation; isolate account storage and implement explicitly reviewed Guest import |
| Public release | Configure production Clerk/live build and update keys, approved production app identities, Google/native callbacks, and account deletion/recovery with the financial-data policy |
| iOS release | Build and repeat Google/callback/restoration/sign-out, secure-storage and offline tests on iOS |

See [current Dashboard acceptance evidence](AUTH_DASHBOARD_VALIDATION.md), [Clerk setup and historical native evidence](CLERK_AUTH.md), [Clerk useSSO](https://clerk.com/docs/reference/expo/native-hooks/use-sso) and [Expo protected routes](https://docs.expo.dev/router/advanced/protected/).