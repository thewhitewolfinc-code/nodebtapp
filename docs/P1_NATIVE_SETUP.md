# P1 native development build and device verification

The Android native build/storage checks now pass, including real SQLCipher/SecureStore initialization and isolated financial persistence through connection and JavaScript runtime reload. Welcome is confirmed on the phone. **Full UI/OS lifecycle/offline-release and iOS verification remain open.** See [P1_ANDROID_VERIFICATION.md](P1_ANDROID_VERIFICATION.md); do not treat a bundle export or a JavaScript reload as all native acceptance tests.

## Why Expo Go and web are blocked

SQLCipher is a compile-time native feature. Setting a SQL key in a binary without SQLCipher does not enable encryption: SQLite can ignore that PRAGMA. Nodebt therefore checks `PRAGMA cipher_version`, applies a 256-bit random device key stored only in SecureStore, verifies keyed schema access/integrity, and only then runs migrations. No missing-key, wrong-key, unsupported-binary, or migration failure deletes/recreates the database.

The web opener always rejects. There is no browser localStorage, IndexedDB, plaintext database or mock-ledger fallback. Use a native development build for financial workflows. An empty guest ledger is real empty encrypted storage, not demo data.

Sources: [Expo 58 SQLite / SQLCipher](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Configuration already supplied

- `expo-sqlite ~58.0.14`, `expo-secure-store ~58.0.2`, `expo-crypto ~58.0.7`, `expo-file-system ~58.0.12`, `expo-dev-client ~58.0.16` installed/aligned through the existing Expo 58 installer.
- `app.json`: SQLCipher enabled for native platforms; Android auto-backup disabled to avoid restoring a database without its device key.
- `app.config.ts`: development app identity `app.nodebt.development` on both platforms. This is a test identity, not an approved production registration. A production EAS build fails without an explicitly supplied `NODEBT_APP_ID`.
- `eas.json`: internal development build and iOS simulator profiles. No Expo project, signing identity, paid build, or cloud resource was created.
- Android CNG generation succeeded. Generated `android/gradle.properties` includes `expo.sqlite.useSQLCipher=true`; the manifest has `android:allowBackup="false"`. Generated native directories remain ignored by Git; use the config plugins to regenerate them.
- `src/storage/open.ts`: one dedicated keyed connection; no automatic devtools registration of financial data. Serialized transactions deliberately use this keyed connection, because the installed SDK's exclusive transaction helper creates a separate native connection which would need its own key.
- Keys use `Crypto.getRandomBytesAsync(32)` (native secure entropy), checked 64-character hex, SecureStore's device-only/unlocked accessibility, and verified readback. No random development fallback, password, secret or key is logged or included in the database journal.

## Current machine findings

Updated by the 27 October 2026 [technical audit](TECHNICAL_AUDIT.md); the earlier P1 environment snapshot is superseded.

- Windows, Node 24.22.0 and npm 11.19.1 work.
- Android Studio exists with OpenJDK JBR 25.0.3. User-level `JAVA_HOME` now points to `C:\Program Files\Android\Android Studio\jbr`; its bin directory was added to user PATH without removing existing entries. Reopen the IDE/terminal to inherit it.
- `ANDROID_HOME` is configured to the existing `%LOCALAPPDATA%\Android\Sdk`; platform-tools was added to user PATH. Android platforms 36.1/37.0 are installed.
- Gradle 9.4.1 launches successfully with JBR. Its requested Temurin 17.0.20.1 compilation toolchain was provisioned; NDK 27.1.12297006, Build-Tools 37.0.0 and CMake 3.22.1 were installed through the existing build using already accepted SDK licenses.
- The user's Motorola edge 60 fusion (Android 17, arm64-v8a) is authorized in ADB. Expo Go 58.0.5 connects to Metro through both USB forwarding and Wi-Fi and renders the expected secure-storage requirement after the startup fix.
- A `Medium_Phone` AVD is now configured and WHPX acceleration reports installed/usable. No emulator boot was needed or tested.
- Consult the audit's native-build/result table for APK installation and encrypted runtime acceptance status. An Expo Go connection does not verify SQLCipher storage.

### Windows C++ path-length correction

The first real build reached Worklets C++ compilation but Ninja 1.10.2 (from CMake 3.22.1) failed creating long generated object paths. Windows `LongPathsEnabled` is already 1. Following [Expo's documented correction](https://docs.expo.dev/troubleshooting/windows-long-paths/), `app.config.ts` now selects CMake **3.31.6 only on Windows** through the SDK-compatible build-properties plugin. Linux/EAS/macOS keep their defaults. Do not move the repository or change packages/security policies to shorten paths.

The user installed CMake **3.31.6** in Android Studio's SDK Tools. Its Ninja reports **1.12.1** and the original native APK build/install succeeded. On another Windows machine, use Settings → Languages & Frameworks → Android SDK → SDK Tools → Show Package Details → CMake → 3.31.6. The SDK CLI was blocked by Windows Application Control on this machine; the policy was preserved and Studio's built-in SDK Manager was used. No further CMake installation approval is pending.

## Option A — Local Android build

1. Use the verified Android Studio Java on this machine, or configure an appropriate JDK on another machine following the [current Expo environment guide](https://docs.expo.dev/get-started/set-up-your-environment/). The installed React Native plugin requests JVM toolchain 17; distinguish its compilation toolchain from the Java used to launch Gradle. Verify `java -version` and `android\gradlew.bat --version` before building. Avoid reinstalling Java or changing Gradle versions solely because the terminal was opened before the environment settings changed.
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

1. Cold start: native encrypted storage opens; Welcome appears once. This now passes on the Android development installation after the native-path/URI fix; retest on other platforms/builds. Expo Go/web instead show the storage requirement and cannot create records.
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
