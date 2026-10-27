# P1 native development build and device verification

The application code and desktop checks are implemented. **Native SQLCipher / SecureStore and full UI verification remain blocked until a native build is running on an Android or iOS test target.** Do not treat an exported JavaScript bundle as an installed native build.

## Why Expo Go and web are blocked

SQLCipher is a compile-time native feature. Setting a SQL key in a binary without SQLCipher does not enable encryption: SQLite can ignore that PRAGMA. Nodebt therefore checks `PRAGMA cipher_version`, applies a 256-bit random device key stored only in SecureStore, verifies keyed schema access/integrity, and only then runs migrations. No missing-key, wrong-key, unsupported-binary, or migration failure deletes/recreates the database.

The web opener always rejects. There is no browser localStorage, IndexedDB, plaintext database or mock-ledger fallback. Use a native development build for financial workflows. An empty guest ledger is real empty encrypted storage, not demo data.

Sources: [Expo 58 SQLite / SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Configuration already supplied

- `expo-sqlite ~58.0.14`, `expo-secure-store ~58.0.2`, `expo-crypto ~58.0.7`, `expo-file-system ~58.0.11`, `expo-dev-client ~58.0.15` installed through the existing Expo 58 installer.
- `app.json`: SQLCipher enabled for native platforms; Android auto-backup disabled to avoid restoring a database without its device key.
- `app.config.ts`: development app identity `app.nodebt.development` on both platforms. This is a test identity, not an approved production registration. A production EAS build fails without an explicitly supplied `NODEBT_APP_ID`.
- `eas.json`: internal development build and iOS simulator profiles. No Expo project, signing identity, paid build, or cloud resource was created.
- Android CNG generation succeeded. Generated `android/gradle.properties` includes `expo.sqlite.useSQLCipher=true`; the manifest has `android:allowBackup="false"`. Generated native directories remain ignored by Git; use the config plugins to regenerate them.
- `src/storage/open.ts`: one dedicated keyed connection; no automatic devtools registration of financial data. Serialized transactions deliberately use this keyed connection, because the installed SDK's exclusive transaction helper creates a separate native connection which would need its own key.
- Keys use `Crypto.getRandomBytesAsync(32)` (native secure entropy), checked 64-character hex, SecureStore's device-only/unlocked accessibility, and verified readback. No random development fallback, password, secret or key is logged or included in the database journal.

## Current machine findings

- Windows, Node 24.22.0 and npm 11.19.1 work.
- An Android SDK exists at the standard `%LOCALAPPDATA%\Android\Sdk` location; it includes platform-tools, emulator and Android 36.1/37.0 platforms. It was not on the shell's initial PATH.
- `android\gradlew.bat --version` fails: **JAVA_HOME is not set and no java command is available**.
- `adb devices -l` found no connected devices.
- `emulator -list-avds` found no configured virtual devices.
- `emulator -accel-check` reports **Android Emulator hypervisor driver is not installed**.
- No installed APK/IPA, physical-device taps, encrypted database file inspection, or native kill/relaunch test is claimed.

Completing an emulator setup may require administrator access, virtualization configuration and a restart. A connected Android phone avoids the emulator-driver requirement, but local compilation still needs a working JDK and Android build toolchain. These machine-level setup steps were not performed automatically.

## Option A — Local Android build

1. Install/configure OpenJDK 17 (the installed React Native Gradle plugin uses JVM toolchain 17), and complete Android Studio/SDK setup following the [current Expo environment guide](https://docs.expo.dev/get-started/set-up-your-environment/). Gradle 9 requires JVM 17 or newer ([official runtime requirement](https://docs.gradle.org/current/userguide/upgrading_major_version_9.html)); verify `java -version` and `android\gradlew.bat --version` before building.
2. Set `JAVA_HOME` to the actual installed JDK directory. Set `ANDROID_HOME` to your SDK directory and add `platform-tools` to PATH. Do not use a placeholder path as an actual environment value.
3. Connect and unlock an Android phone, enable USB debugging and approve its authorization prompt; confirm it appears in `adb devices -l`. Alternatively configure and start a compatible accelerated Android virtual device.
4. From the existing `Nodebt` directory, run:

   ```powershell
   npm.cmd run check
   npx.cmd expo prebuild --no-install --platform android
   npm.cmd run android
   ```

5. Once the development app is installed, future JS-only sessions can use:

   ```powershell
   npm.cmd run start:dev
   ```

   Open the Nodebt development app, not Expo Go. Rebuild the native app after changing SQLCipher/native config or adding native packages.

## Option B — EAS native development build

Use this when local native compilation is unavailable. It requires the user's Expo account and applicable platform signing/device registration. Review any build quota/cost before starting a remote job.

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build:configure
npx.cmd eas-cli@latest build --platform android --profile development
```

The existing EAS profiles should be preserved during configuration. Install the resulting development APK on the test phone, then run `npm.cmd run start:dev` in this repository. Account/project setup and builds have not been run in this task.

For physical iOS, use the same `development` profile with `--platform ios` after Apple signing/device setup. The `development-simulator` profile is for an iOS Simulator on macOS; Windows cannot run that simulator. Do not substitute an Expo Go session as an iOS SQLCipher test.

## Required native acceptance pass (Android and iOS)

Use an isolated development installation with synthetic test entries. Do not uninstall or clear an installation containing real guest records; complete backup/recovery belongs to P2.

1. Cold start: native encrypted storage opens; Welcome appears once. Expo Go/web instead show the storage requirement and cannot create records.
2. Add an interest-free **Money I Owe** record: INR 10,000 principal, monthly INR 5,000 due on the 10th for two installments. Use a real date at/before today for the opening snapshot.
3. Add **Money Owed to Me**: INR 10,000 principal in a lending category. Confirm independent borrowing and lending totals.
4. Record a partial INR 3,000 repayment and INR 2,500 collection. Expect INR 7,000 owed and INR 7,500 receivable. A due installment's unpaid INR 2,000 stays outstanding/overdue after its date; the next installment stays INR 5,000.
5. Correct the repayment to INR 2,000 with a reason. Expect INR 8,000 owed. Also test explicit allocation to a later installment on a separate scheduled record: the oldest unpaid installment must remain unpaid. The original INR 3,000 revision remains visible as superseded; the correction has a new revision. Void and restore an entry and verify balances/history.
6. For a manual-interest record, explicitly recognize INR 1,000 interest and save a payment of INR 4,000 principal plus INR 1,000 interest. Verify principal falls by INR 4,000, cash paid is INR 5,000 and no duplicate interest is added.
7. Save a reasoned signed adjustment and additional borrowing/lending. Overpayment, missing reason, invalid dates and invalid component allocations must fail without a partial save.
8. On a separate new INR 10,000 test record, record a partial settlement: actual INR 8,000 cash and INR 2,000 forgiveness/write-off against an INR 10,000 balance. Confirm recorded balance zero and cash total INR 8,000. Close, archive and reopen the same identity; retain all revisions and lifecycle entries.
9. Category management: exactly six selectable default categories per direction in guest mode; create three custom categories separately in each direction; fourth is blocked. Rename/archive/unarchive without losing assignments. Pro/expiry policy is covered through isolated repository tests; no paid unlock UI exists in P1.
10. Kill/relaunch the app and restart the test device. Expect exactly the same records, revisions, category assignments and balances. Enable airplane mode, add/pay/correct, kill/relaunch again, then reconnect; nothing should disappear or duplicate.
11. Inspect the native encrypted database through a controlled test-only mechanism: header is not a plaintext SQLite header, an unkeyed/wrong-key open fails, correct device key opens successfully, and SQLCipher integrity checks pass. Do not copy a real device key into logs, screenshots or the repo. Check journal/WAL/SHM handling as well.
12. Exercise unavailable SecureStore, missing key with existing database, wrong key, corruption and interrupted upgrade in an isolated test build. Require an actionable error without reset/plaintext fallback. Verify screen-reader labels, large text, keyboard scrolling, system theme, hardware Back and five-tab navigation.

Record device/OS/build versions and results in `P1_VERIFICATION.md`. **P1 remains open until the native acceptance pass succeeds.** Supabase, RevenueCat, AdMob and Pro algorithms remain outside this milestone.