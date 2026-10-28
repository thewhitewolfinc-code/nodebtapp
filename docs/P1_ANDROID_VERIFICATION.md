# P1 Android storage verification — 28 October 2026

## Outcome

The encrypted-storage startup bug is fixed. The installed Nodebt development app opens its real encrypted guest database and renders Welcome. Native financial integration tests pass on the Motorola edge 60 fusion through the standard React Native debug runtime. This unblocks Android guest development; full P1 device-journey acceptance and iOS verification remain open.

The SDK-compatible patch APK also built successfully (12m 7s; 486 tasks) and was installed as an in-place update, preserving app data. Post-update native financial tests and a full OS process force-stop/cold relaunch pass. Onboarding remains saved, Home renders, and the real guest ledger remains empty.

## Root cause and fix

Expo SQLite 58 returns a native absolute filesystem directory on Android. Expo FileSystem's `File` constructor passes its input through Java's URI API and requires an absolute `file://` URI. The original existing-database check passed the raw SQLite directory directly to `File`, causing `IllegalArgumentException: URI is not absolute` before key creation. SecureStore and native cryptography were available; missing native modules were not this remaining startup failure.

`nativeDirectoryFileUri` in `src/storage/security.ts` converts the native path to a file URI, encoding spaces, Unicode and reserved path characters. Existing file URIs are preserved, and unsupported relative/non-file paths fail closed. `src/storage/open.ts` uses it only for the FileSystem existence check. SQLite still opens the same original database directory. No database was reset, relocated or decrypted to plaintext; key generation, key readback verification, missing-key safeguards and calculation rules are unchanged.

Commit: `cbcbf8d fix(storage): normalize native SQLite paths before FileSystem checks`.

## Verified results

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Application/test TypeScript, lint and unit/integration suite | PASS — 62 tests | 30 original financial tests remain unchanged; two regression tests cover native-path conversion and missing-key preservation. |
| SDK compatibility | PASS | Recommended SDK 58 patches aligned; React Native 0.88 and TypeScript 6 retained. |
| Expo Doctor | PASS — 20/20 | No disabled checks or exclusion overrides. |
| Full npm dependency tree | PASS | No missing/invalid/peer-conflict problems. |
| Android Hermes export after path fix | PASS | Bundling is distinct from native installation. |
| Windows native toolchain | PASS | CMake 3.31.6, Ninja 1.12.1; SQLCipher flag true and Android backup false. |
| Original Android arm64 development build/install | PASS | Gradle completed in 3m 59s; APK installed successfully on the physical phone. |
| SDK-patched Android arm64 build/install/runtime | PASS | Gradle completed in 12m 7s; `adb install -r` succeeded without clearing or uninstalling the app. Fresh native integration and restart checks also pass on this APK. |
| Actual guest startup | PASS | Guest repository opens, schema initializes, 30 default category definitions load, no financial records are seeded. |
| Native isolated financial tests | PASS | Borrowing/lending, partial repayment/collection, corrected immutable history, idempotent retry, schedule projection and category policy. |
| Native SQLCipher file check | PASS | File header differs from plaintext SQLite; wrong-key and unkeyed schema access fail. A subsequent correct-key reopen preserves all data. |
| Native connection close/reopen | PASS | Full records/revisions/categories/settings/schedules snapshot matches exactly. |
| JavaScript runtime reload | PASS | A separately reloaded native runtime retrieves the audit key from SecureStore and reproduces the exact snapshot digest. The real guest ledger also reopens. |
| Welcome render | PASS — runtime inspection and user confirmation | Active React tree contains Welcome and excludes the storage error; the user confirms seeing Welcome on the phone. Full touch journeys remain separate. |
| Guest onboarding and category direction UI | PASS — partial touch smoke test | Continue as guest opens the real new-record form; exactly six Free defaults appear for each direction. No financial form was saved. |
| Five-tab navigation | PASS — empty-state touch smoke test | Home, Records, Activity, Insights and Settings render on the updated APK. Search/filter controls and zero-state summaries appear; the app is returned to Home. This does not cover financial form-save journeys. |
| OS process force-stop/cold relaunch | PASS | ADB reports COLD launch after `am force-stop`; SecureStore retrieves the isolated audit key and the complete snapshot digest matches, with two records and five revisions. Real guest onboarding stays true and its ledger stays empty. |
| Device reboot/standalone offline cold start | NOT RUN | Debug cold launch uses Metro to load JavaScript. No claim of standalone offline startup or device reboot acceptance. |
| Complete Android form/keyboard/accessibility/lifecycle acceptance | PENDING | Requires the checklist in P1_NATIVE_SETUP.md. |
| iOS native build and device acceptance | PENDING | Not claimed from Windows/Android results. |

## Native test isolation and financial fixtures

Tests ran in separate encrypted `nodebt-audit-<uuid>.db` files through the production repository, the unchanged financial engine and the same keyed-connection setup. They did not inject fake entitlements into the app or insert sample records into the real guest database. Audit keys stayed in the app's SecureStore; no key/password/financial payload was returned in diagnostics.

- Create one borrowing and one lending fixture, each with INR 10,000 principal and no interest.
- Repay INR 3,000; expect INR 7,000 owed. Retry the same operation ID; expect no duplicate payment.
- Collect INR 2,500; expect INR 7,500 receivable, independent from borrowing totals.
- On the borrowing schedule, retain the unpaid INR 2,000 as overdue and leave the next INR 5,000 installment unchanged.
- Correct the repayment to INR 2,000 with an explicit reason; expect INR 8,000 owed, preserving the original INR 3,000 revision. The fixtures contain two records and five revisions.
- Verify exactly six Free default categories per direction; accept three custom categories per direction and reject the fourth. A separately injected test-service Pro policy can create an additional custom category, which remains after switching that test policy back to Free. This does not enable Pro in the app.
- Compare the complete snapshot before/after native close/reopen and JavaScript runtime reload using a SHA-256 digest computed on the device. Repeat the integration suite on the SDK-patched APK, then force-stop its OS process, cold-launch it and confirm the exact digest again. Verify correct-key reopen after negative key tests.
- Remove only the isolated audit databases and audit-only SecureStore keys after verification. The actual guest database and device key are untouched. At verification time, the guest ledger had zero financial records and 30 catalog definitions.

Local diagnostic probes/results are ignored `.expo` artifacts. They use the standard local debugger's required same-origin connection and expose only sanitized result flags, fixture totals and counts. No security policy or runtime permission barrier was disabled.

## SDK patch alignment

The fresh 28 October compatibility check required patch releases published since the previous review. Expo's installer aligned `expo` 58.0.20, `@expo/ui` 58.0.24, `expo-dev-client` 58.0.16, `expo-file-system` 58.0.12, `expo-router` 58.0.27 and `expo-web-browser` 58.0.7. Explicit FileSystem/WebBrowser config-plugin entries satisfy the installer when using dynamic `app.config.ts`. This is SDK 58 maintenance, not a framework migration or new integration.

The current npm scan reports 3 high and 5 low findings, propagated from Zod and deepmerge in Expo's toolchain. The underlying Zod 3.25.76 and deepmerge 4.3.1 versions were already present before these patch updates. The [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) currently lists no patched release; the [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) requires a version outside the CLI's declared Zod 3 range. npm's force fix proposes an Expo major downgrade; it was not applied. These remain tracked release risks, not successful security fixes.

## Next acceptance work

Use the installed **Nodebt development app**, with Metro running via `npm.cmd start`. Expo Go still cannot run SQLCipher. Keep actual financial data out of an unverified development installation until recovery workflows are available.

Complete the remaining full financial screen/touch/keyboard, standalone offline, device reboot and accessibility checklist, then run the corresponding iOS development-build checks. Process force-stop/relaunch has passed; it does not replace these remaining tests. Initially Windows saw only the media-transfer interface; after the user enabled USB debugging, ADB again recognized the phone as an authorized device. User confirmation alone was not treated as proof until ADB showed the device.

During final verification the existing Metro process listened on port 8081 but did not answer HTTP requests, leaving the development app blank. Restarting only the verified Nodebt Metro process restored `/status`, Android bundling and debugger connectivity. No app data was cleared, dependency was changed or timeout/security check disabled. Notification overlays were dismissed without reading their contents; other-app/lock-screen UI inspection was blocked by the diagnostic guard.

Supabase, RevenueCat, AdMob and Pro calculators remain unstarted. P2 implementation still requires P1 acceptance and the user's approval.
