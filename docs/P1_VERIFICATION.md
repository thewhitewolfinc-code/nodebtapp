# P1 verification and change manifest

Reviewed 27 October 2026. **P1 code is implemented and automated checks pass. P1 is not fully signed off: native SQLCipher/SecureStore and installed-app journey verification are BLOCKED on native environment/target setup.** No subsequent integration/Pro milestone has started.

**Subsequent audit:** this file preserves the original P1 evidence/manifest. [TECHNICAL_AUDIT.md](TECHNICAL_AUDIT.md) has newer results: 60 passing tests, repaired Java/SDK user environment, physical Android Expo Go connectivity over USB/Wi-Fi, corrected native-import startup handling and the Windows CMake/Ninja build diagnosis. The old machine findings below are historical, not a recommendation to reinstall Java or a hypervisor driver.

## Delivered

- Both requirement documents were corrected before category UI implementation: Free 6 defaults + 3 custom categories per direction; Pro all 16 borrowing / 14 lending defaults and unlimited customs; retained categories/assignments after expiry. The mixed formal/informal borrowing and personal-lending audience and global architecture are explicit.
- SQLCipher-native opening guard, securely persisted device key, integrity check, versioned SQLite migration, atomic guest repository commands, immutable transaction revisions and local guest journal. Wrong/missing keys, migration errors and corruption never trigger a destructive reset or plaintext fallback.
- Home, Records, Activity, Insights and Settings; Welcome/guest onboarding; create borrowing/lending records; one-time/monthly schedules; default/custom category selection, rename and archive; record details; repayments/collections and explicit installment allocation; component charges; full revision/void/restore history; reasoned signed adjustments; atomic partial settlements; close/archive/unarchive/reopen and recategorize.
- Existing P0 financial engine retained unchanged. Feature selectors use it to produce balances, cash totals and schedule views. No financial records are seeded in the app; only catalog metadata is seeded.
- Currency and minor-unit scale are explicit on records and journal envelopes. INR/English is the initial configuration, not an ownership/category identifier assumption.

## Verification results

| Check | Result | Evidence / limit |
| --- | --- | --- |
| `npm.cmd run check` | PASS | Typecheck, lint, all 59 tests; no lint warnings. |
| Original financial tests | PASS — 30 | Original suite and four engine files unchanged from P0 checkpoint `4874e29`. |
| P1 persistence/category/form/selector/security tests | PASS — 28 | Real SQLite temporary-file create/pay/collect/revise/restart/rollback/idempotency/concurrency/migration/category/lifecycle/settlement/allocation checks, plus isolated key/capability contracts and input parsing. |
| Forbidden web storage | PASS — 1 | Web opener rejects without touching browser storage. |
| Expo Doctor | PASS — 20/20 | Existing SDK and added native dependencies/configuration pass. |
| `expo prebuild --no-install --platform android` | PASS | Generated `expo.sqlite.useSQLCipher=true` and `android:allowBackup="false"`. Native source stays ignored, configured through plugins. |
| `expo export --platform all --max-workers 2` | PASS | Android/iOS Hermes bytecode and web/server bundles exported successfully. This is not an APK/IPA build. |
| Web platform boundary inspection | PASS | Exported web client has the storage rejection; native device-key and database-opener constants are absent. |
| Existing runtime dependency declarations | PRESERVED | All existing versions unchanged; only five Expo-compatible native modules added. Lockfile root matches manifest. |
| `git diff --check` | PASS | No whitespace errors. |
| Installed Android/iOS app, encrypted-file proof and full UI taps/kill/relaunch | BLOCKED / NOT RUN | Requires working native build environment and native test target. Desktop SQLite fixtures do not prove device encryption or UI behavior. |

Tests use isolated synthetic temporary SQLite files and guarded cleanup. They do not create mock records in the user app. The Node SQLite test connection is deliberately separate from the production native adapter and is never a browser/native plaintext fallback.

The existing non-failing Node module-type warning remains. The existing Expo CLI/Zod advisory and Expo lint-toolchain deprecation remain tracked; no forced SDK downgrade or unrelated dependency replacement was performed.

## Genuine native blockers

- An Android SDK exists at the standard LocalAppData location, but **Java/JAVA_HOME is unavailable**. The generated Gradle wrapper exits before building with that exact error.
- **No connected phone or configured AVD** was found. ADB itself is available through its full SDK path.
- Emulator acceleration check: **Android Emulator hypervisor driver is not installed**. Enabling acceleration can involve administrator access/virtualization configuration/restart; these machine changes were not made automatically.
- This Windows session cannot run the iOS Simulator. A physical signed iOS development build or a macOS simulator target is still needed for iOS sign-off.

Configuration and a step-by-step local/EAS build route are in [P1_NATIVE_SETUP.md](P1_NATIVE_SETUP.md). No EAS account/project/signing setup or remote build was started. After native setup, run the full acceptance checklist there and record device/OS/build versions here before marking P1 verified. Keep Supabase, RevenueCat, AdMob and Pro algorithms gated until then.

## Reviewable commits

| Commit | Change |
| --- | --- |
| `4874e29` | Checkpoint of the previously validated P0 foundation; baseline for this P1 manifest. |
| `f8bffea` | Correct approved category limits/global audience before UI work. |
| `06c39e0` | Encrypted native SQLite repository, migrations, category policy and initial integration tests. |
| `648cce8` | Five-tab guest journeys, financial forms, settlements, selectors, revision history and native error boundaries. |
| `5cb6ab7` | Preserve explicit contract installment allocations through entry/correction UI and storage. |

This report, updated requirements/readiness and the setup/design guides are saved in a separate documentation commit; use `git log --oneline` for its final hash.

## Implementation notes for the next reviewer

- `GuestRepository.execute(operationId, command)` is the only application write boundary. Expected record/parent versions prevent stale financial edits, and idempotent receipts prevent repeat payment application.
- One dedicated keyed connection is serialized so an implicit new connection cannot bypass encryption setup. Review the rationale and schema in [P1_STORAGE.md](P1_STORAGE.md).
- The installed SDK 58 Windows route watcher was observed emitting out-of-root/backslash route paths and incorrect dynamic index types after file additions. `scripts/generate-route-types.cjs` uses the installed Expo generator and an app-root-only context to generate isolated ignored declarations for checks. Typed routing remains enabled; no dependency source was patched. Revalidate this small SDK-specific adapter when upgrading Expo.
- Category labels are initial English implementation defaults with stable IDs. Changing a shipped default catalog needs a versioned migration; paid defaults and custom categories are not deleted on downgrade.
- App Lock, local reminders, CSV/encrypted file backup/restore and cloud recovery remain later milestones. Guest uninstall/device loss can therefore make local data unrecoverable; the current UX discloses this.

## Exact changed files for P1

Manifest compares P0 checkpoint `4874e29` with the final P1 worktree, including these documentation files. Generated `android/`, `.expo/`, `dist/` and dependency installation directories are ignored artifacts, not source changes. `R` entries show both original and retained reference locations.
| Status | Path |
| --- | --- |
| A | `app.config.ts` |
| M | `app.json` |
| M | `docs/DEVELOPMENT_READINESS.md` |
| M | `docs/IMPLEMENTATION_PLAN.md` |
| A | `docs/P1_NATIVE_SETUP.md` |
| A | `docs/P1_STORAGE.md` |
| A | `docs/P1_VERIFICATION.md` |
| A | `eas.json` |
| M | `package-lock.json` |
| M | `package.json` |
| M | `README.md` |
| A | `scripts/generate-route-types.cjs` |
| M | `src/app/_layout.tsx` |
| A | `src/app/(tabs)/_layout.tsx` |
| A | `src/app/(tabs)/activity.tsx` |
| A | `src/app/(tabs)/home.tsx` |
| A | `src/app/(tabs)/insights.tsx` |
| A | `src/app/(tabs)/records.tsx` |
| A | `src/app/(tabs)/settings.tsx` |
| A | `src/app/categories.tsx` |
| M | `src/app/index.tsx` |
| A | `src/app/record/[id]/entry.tsx` |
| A | `src/app/record/[id]/index.tsx` |
| A | `src/app/record/new.tsx` |
| A | `src/app/welcome.tsx` |
| A | `src/components/nodebt/record-card.tsx` |
| A | `src/components/nodebt/ui.tsx` |
| A | `src/config/product.ts` |
| A | `src/domain/categories.ts` |
| A | `src/features/guest/activity-list.tsx` |
| A | `src/features/guest/forms.ts` |
| A | `src/features/guest/provider.tsx` |
| A | `src/features/guest/selectors.ts` |
| R100 | `src/components/app-tabs.tsx` -> `src/legacy/app-tabs.native.reference.txt` |
| R100 | `src/components/app-tabs.web.tsx` -> `src/legacy/app-tabs.web.reference.txt` |
| R100 | `src/app/explore.tsx` -> `src/legacy/expo-explore.tsx` |
| A | `src/legacy/expo-home.tsx` |
| A | `src/storage/database.ts` |
| A | `src/storage/migrations.ts` |
| A | `src/storage/models.ts` |
| A | `src/storage/open.ts` |
| A | `src/storage/open.web.ts` |
| A | `src/storage/repository.ts` |
| A | `src/storage/security.ts` |
| A | `tests/persistence.test.ts` |
| A | `tests/platform-boundary.test.ts` |
| A | `tests/sqlite-helper.ts` |
| M | `tsconfig.json` |
| M | `tsconfig.tests.json` |

Changed-file entries: 49.
