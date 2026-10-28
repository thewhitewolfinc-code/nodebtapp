# Nodebt technical audit

Audit date: 27 October 2026; resumed verification: 28 October 2026 (Asia/Calcutta). Baseline: `5cd5fd5`. Scope: dependencies, Expo/native configuration, development environment, server startup and physical Android connectivity. No new product milestone, financial rule change or backend integration.

**Status: source checks, Expo Go connectivity and native Android encrypted persistence pass. Full P1 device-journey/iOS sign-off remains open.** The user installed the required CMake package, the Android development APK built and installed, and the resumed investigation fixed a native-path/FileSystem-URI mismatch. Welcome is confirmed by native runtime inspection and by the user. Separate native encrypted financial fixtures pass close/reopen, JavaScript runtime reload and wrong-key tests. See [P1_ANDROID_VERIFICATION.md](P1_ANDROID_VERIFICATION.md) for exact evidence and limits. Expo Go still cannot run SQLCipher; it is not the tracker runtime.

## Issues, root causes and dispositions

| Issue | Root cause | Fix / disposition | Verification |
| --- | --- | --- | --- |
| Expo Go cannot open the guest ledger | SQLCipher is compiled into Nodebt's native binary; Expo Go has no SQLCipher support. A config plugin cannot change the installed Expo Go binary. | Preserve SQLCipher and fail closed. Add an explicit Expo Go check before loading native storage modules, creating a key or opening a database. Use the existing development-build configuration. | Expected storage-requirement screen verified on the physical phone; regression test checks rejection before native imports, including retry. |
| `Cannot find native module 'ExpoCrypto'`, followed by Router missing-default-export / ErrorBoundary errors | The installed Expo Go binary cannot supply this module. Static imports in the guest provider and opener throw while routes are being evaluated, before the startup error boundary can render. The route files already have default exports. | Load native storage modules inside the asynchronous opener after the Expo Go check. Load the secure operation-ID generator only after repository initialization. Preserve secure randomness, synchronous ID reuse and existing financial commands. | Physical cold relaunch renders Nodebt's error screen without the reproduced route-import crash. Test also checks a stale development binary's missing-module failure is sanitized inside the opener. |
| Java/Gradle unavailable in the terminal | Android Studio is installed, but neither process nor user/machine settings defined `JAVA_HOME`; Java was absent from PATH. | Configure user-level `JAVA_HOME` to the verified Android Studio JBR and add its `bin` to user PATH. No existing Java setting or PATH entry was replaced. Restart the IDE/terminal to inherit the settings. | JBR OpenJDK 25.0.3 runs Gradle 9.4.1. Gradle provisioned the requested Temurin 17.0.20.1 compilation toolchain. Native build validation is recorded separately below. |
| ADB/Android SDK unavailable as ordinary shell commands | Existing SDK was outside PATH and `ANDROID_HOME` was unset. | Set user-level `ANDROID_HOME` to the existing SDK and add platform-tools to user PATH, preserving existing entries. | ADB recognizes the authorized phone. No USB driver or firewall change required. |
| First native build lacked SDK components | SDK Build-Tools 37.0.0 and NDK 27.1.12297006 were not installed. | Gradle installed the versions requested by the existing Expo/RN configuration using the SDK's already accepted licenses. | Installation completed. Native compilation result remains a separate check. |
| Worklets C++ build fails with Ninja `mkdir(...): No such file or directory` | Deep generated object paths exceed the capabilities of Ninja 1.10.2 bundled with CMake 3.22.1. Windows long paths are already enabled; changing that registry flag alone would not fix the old Ninja. | Add SDK-compatible `expo-build-properties` and select CMake 3.31.6 only on Windows through `app.config.ts`, following Expo's documented fix. Regenerate Android through CNG and invalidate only verified generated CMake caches. Keep the repository in place; no dependency-source edits, mapped drives or registry changes. | CNG emits `android.cmakeVersion=3.31.6` and retains SQLCipher. Config branches tested for Windows, Linux and macOS; Linux/EAS/macOS retain defaults. Rebuilt native result below. |
| Fixed CMake version absent from SDK; SDK CLI cannot install it | The rebuild stopped with missing CMake 3.31.6. The SDK CLI's Android CLI delegate was blocked by Windows Application Control (`os error 4551`). | The user approved and installed CMake through Android Studio. Security policies remain unchanged. | **RESOLVED**: CMake 3.31.6 / Ninja 1.12.1 execute; native APK build/install succeeded. No blocked-binary/security bypass used. |
| Encrypted native build still fails at startup | SQLite supplies an absolute native directory; FileSystem's native File constructor requires a file URI. The unconverted path throws `URI is not absolute` before key creation. | Normalize only the FileSystem existence-check path, retaining the original SQLite database location and all key/missing-key safeguards. Add path/encoding and key-preservation regression coverage. | **RESOLVED**: real guest database initializes; native financial/encryption/reload checks pass; user sees Welcome. Commit `cbcbf8d`. |
| Ambiguous default start target | Plain `expo start` chooses a target based on installed tooling/session options, which can lead to scanning a development-client link with Expo Go. | Make `npm.cmd start` explicitly use `expo start --dev-client`, matching `start:dev`. Diagnostic Expo Go sessions use an explicit `--go` command. | Metro startup and Android manifest/bundle requests pass. |
| npm audit findings | Zod 3.25.76 and deepmerge 4.3.1 advisories propagate through Expo's toolchain. These versions were present before the SDK patch alignment. | **OPEN upstream dependency risk.** The CLI requires Zod 3; its advisory requires Zod 4.6.6. The deepmerge advisory lists no patched release. npm's force fix proposes an Expo major downgrade. No forced fix, major override or audit suppression applied. | Latest scan: 3 high, 5 low, 0 critical. See advisory and package decisions below. |
| Windows incremental typed-route generation | Installed `@expo/router-server` 58.0.18 still uses platform `path.relative` while checking POSIX `../` prefixes; Windows additions can contaminate generated route declarations. | Existing SDK-guarded generator retained. It uses Expo's own app-root-only generator; application route checks remain enabled. No dependency source patched. Revalidate on an SDK patch/update. | Strict application/test typecheck passes, including after Metro runs. |

Earlier P1 environment findings are historical: Android Studio/JBR, a `Medium_Phone` AVD and working WHPX acceleration are now present. Do not repeat the earlier recommendation to install a missing hypervisor driver. The physical phone is the tested target; no emulator boot is claimed.

## Dependency inventory and compatibility

`npm.cmd ls --all --json` exits 0 with no missing, invalid, extraneous or peer-conflict problems. All 28 original runtime and 5 development dependencies remain; one build-config plugin was added, making 29 runtime plus 5 development declarations. Six original packages received SDK-recommended patch updates on 28 October; the Expo SDK/RN/TypeScript architecture is unchanged. Manifest and lockfile root agree. New patch requirements were resolved with Expo's installer rather than suppressing compatibility checks.

| Package | Installed |
| --- | --- |
| `expo` | 58.0.20 |
| `expo-build-properties` (added for Windows native build) | 58.0.11 |
| `react`, `react-dom` | 19.3.0 each |
| `react-native` | 0.88.0 |
| `expo-router` | 58.0.27 |
| `@expo/ui` | 58.0.24 |
| `expo-constants` | 58.0.13 |
| `expo-crypto` | 58.0.7 |
| `expo-dev-client` | 58.0.16 |
| `expo-device` | 58.0.5 |
| `expo-file-system` | 58.0.12 |
| `expo-font` | 58.0.10 |
| `expo-glass-effect` | 58.0.5 |
| `expo-image` | 58.0.17 |
| `expo-linking` | 58.0.14 |
| `expo-secure-store` | 58.0.2 |
| `expo-splash-screen` | 58.0.11 |
| `expo-sqlite` | 58.0.14 |
| `expo-status-bar`, `expo-symbols` | 58.0.4 each |
| `expo-system-ui` | 58.0.6 |
| `expo-web-browser` | 58.0.7 |
| `react-native-gesture-handler` | 3.3.0 |
| `react-native-reanimated` | 4.7.1 |
| `react-native-safe-area-context` | 5.10.1 |
| `react-native-screens` | 4.30.0 |
| `react-native-web` | 0.21.4 |
| `react-native-worklets` | 0.13.0 |
| `@types/node` | 24.19.2 |
| `@types/react` | 19.3.0 |
| `eslint` | 9.39.5 |
| `eslint-config-expo` | 58.0.4 |
| `typescript` | 6.0.3 |

The initial 27 October registry `outdated` review reported newer releases for `@types/node` 26.6.5, ESLint 10.13.0, React/React DOM 19.3.1, gesture-handler 3.4.0, worklets 0.13.1 and TypeScript 7.0.2. Keep Node typings on the actual Node 24 runtime and retain the current Expo-compatible stack. A newer registry version alone is not an incompatibility. In particular, Reanimated 4.7.1 declares RN 0.86–0.88 and worklets 0.13.x support; the installed pair satisfies it. The subsequent SDK-required patch alignment passes Expo's compatibility check.

The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) lists versions below 4.6.6 as affected. A Zod 4 override would violate the CLI's declared Zod 3 range. Recheck for an official SDK 58-compatible CLI/Expo fix before release. This finding does not explain the observed native-module import crash, and it is not represented as resolved.

## Configuration review

- Expo Router entry is `expo-router/entry`, route files are under `src/app`, and domain/storage/features/UI code is outside the route tree. Starter references remain outside active routes.
- No custom Babel/Metro configuration is required. Installed Expo CLI loads Expo's default Metro configuration and Babel preset. Resolver aliases, React Compiler, Hermes Android/iOS export and web/server export validate successfully. No generic Metro replacement or dependency-source patch was added.
- TypeScript stays strict, extending Expo's base. Tests have a separate checked configuration. No `@ts-ignore`, disabled checks, security bypass or weakening of compiler options was added.
- ESLint uses the SDK's flat `eslint-config-expo` configuration. Package peers and SDK checks pass.
- SQLCipher remains enabled through the config plugin; native introspection and generated Android properties agree. Auto-backup remains disabled. Device key accessibility, cipher capability checks, keyed schema access and integrity verification are preserved.
- Development package/bundle identity remains `app.nodebt.development`, schemes `nodebt` / generated `exp+nodebt`; production requires an explicit approved identity. EAS profiles remain development-only and no external build/service was started. CMake selection is explicitly Windows-only so EAS/Linux builds do not require the Windows-specific SDK package.
- Existing Git-tracked configuration contains no `.env`, private key or signing-keystore file. This is a configuration review, not a historical secret scan or security penetration test.

## Validation results

| Check | Result | Limit |
| --- | --- | --- |
| `npm.cmd run check` | PASS, 62 tests | Application/test TypeScript and lint pass; 30 original engine tests unchanged. |
| Full npm dependency tree | PASS | No installed dependency problems. |
| `npx.cmd --no-install expo install --check` | PASS | Dependencies up to date for SDK 58. |
| `npx.cmd --yes expo-doctor@latest` | PASS, 20/20 | Does not execute installed-phone journeys. |
| Public/prebuild/introspected Expo config | PASS | Native runtime/build checks still required. |
| `npx.cmd --no-install expo export --platform all --max-workers 2` | PASS | Android/iOS Hermes and web/server bundles; not an APK/IPA. |
| Metro LAN startup, `/status`, Android manifest and development bundle | PASS | HTTP 200; manifest SDK 58.0.0 and expected Android identity/plugins. |
| Physical Android → Expo Go over USB forwarding | PASS | Expected Nodebt secure-storage screen after cold launch. |
| Physical Android → Expo Go over Wi-Fi LAN | PASS | Expected secure-storage screen; no firewall changes. |
| Native Android debug build/install | PASS — original build | APK built with the corrected CMake/Ninja tools and installed on the physical phone. SDK patch rebuild/install is recorded separately in the Android verification report. |
| SDK-patched Android debug build/install | PASS | Gradle completed in 12m 7s and in-place APK installation succeeded. Post-update runtime confirmation is separate. |
| Native SQLCipher/SecureStore financial persistence | PASS — scoped native integration | Separate encrypted audit database; payments/corrections/categories, exact close/reopen and JavaScript runtime reload; wrong-key/unkeyed access rejected. Full OS-kill/reboot and UI journeys remain separate gates. |
| npm advisory scan | OPEN | Three high and five low findings from Zod/deepmerge toolchain chains; no critical findings. Neither underlying package version changed in the SDK patch alignment. |

Non-failing warnings observed: Node's existing module-type detection warning for TypeScript tests, conflicting tool-provided NO_COLOR/FORCE_COLOR values, and dependency-generated Kotlin/AGP deprecated API warnings. None were hidden or treated as proof of failure. Do not switch the entire project to ESM or edit dependency/native source merely to suppress them.

## Physical-device evidence and repeatable steps

Test target: Motorola edge 60 fusion, Android 17, arm64-v8a; installed Expo Go 58.0.5. USB debugging was explicitly enabled/authorized by the user. Device serial and private screen contents are not included in this report. Screenshots/accessibility dumps used for the audit remain ignored local artifacts.

For normal development, **open the installed Nodebt development app**:

```powershell
cd 'D:\Karthikeyan\Whitewolf\Product Dev\NoDebt App\Nodebt'
# Reopen the IDE/terminal after the environment-variable update.
java -version
adb devices -l
npm.cmd run android -- --device
# After the native build is installed, JS-only sessions:
npm.cmd start
```

If the current terminal still has old environment values, update only its process before building:

```powershell
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

For a diagnostic Expo Go connection only, stop other Metro instances using that port, run `npx.cmd expo start --go --lan --port 8081`, and scan its QR code in Expo Go. Over USB, `adb reverse tcp:8081 tcp:8081` and opening `exp://127.0.0.1:8081` avoids Wi-Fi routing issues. The expected outcome is the development-build requirement, **not** an editable ledger. No tunnel service or firewall bypass is necessary for the verified setup. Do not clear/uninstall an app containing guest records.

## Changed source and documentation

- `package.json`: explicit development-client start target.
- `package.json`, `package-lock.json`, `app.config.ts`, `app.json`: SDK-compatible build-properties plugin, Windows-only CMake/Ninja correction, six recommended SDK 58 patches and explicit FileSystem/WebBrowser config plugins. Other original package versions retained.
- `src/storage/open.ts`, `src/storage/security.ts`: early unsupported-client rejection, deferred native-module loading within the error boundary and native-directory/file-URI normalization for the existence check.
- `src/features/guest/provider.tsx`: defer native secure UUID loading until encrypted repository initialization; keep stable operation IDs on retry.
- `tests/native-startup.test.ts`: regression coverage for Expo Go and unavailable-native-module startup failures.
- `tests/storage-path.test.ts`: native path/encoding and existing-database missing-key regression coverage.
- `docs/TECHNICAL_AUDIT.md`, `docs/P1_NATIVE_SETUP.md`, `docs/P1_VERIFICATION.md`, `docs/DEVELOPMENT_READINESS.md`, `docs/IMPLEMENTATION_PLAN.md`, `README.md`: current evidence, setup and readiness references.

No financial-engine, repository command, migration, approved category rule, currency rule, backend, billing, ads or Pro-calculation code changed.

## Readiness gate

Expo Go connectivity, native Android startup and encrypted persistence are verified within the documented scope. Full technical sign-off still requires the remaining device-journey/platform acceptance and resolution or explicit release disposition of upstream dependency risks. Keep P1 sign-off separate from public-release readiness. The next product milestone is P2 only after P1 acceptance and the user's approval; no P2 implementation is part of this audit.

Audit commits: `4660e33` (startup boundary), `d9cef3f` (Windows native build), `3c6eb6a` (initial evidence), `cbcbf8d` (native path/URI fix), `1e939b7` (SDK-compatible patches/plugins). The user approved and completed the CMake installation. No installation approval is pending, and no Windows security policy was changed. The initially missing ADB interface reappeared after the user enabled USB debugging on 28 October. Remaining P1 acceptance concerns full device journeys and iOS, rather than CMake installation or encrypted Android startup.

Sources: [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/), [SQLCipher support and capability check](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#sqlcipher), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo Go detection API](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#isrunninginexpogo), [Metro](https://docs.expo.dev/guides/customizing-metro/), [TypeScript](https://docs.expo.dev/guides/typescript/), [Router setup](https://docs.expo.dev/router/installation/). Version/peer/native implementation details were also checked against installed package source and live npm metadata.

Native path diagnosis/fix: [Expo Windows long-path troubleshooting](https://docs.expo.dev/troubleshooting/windows-long-paths/) and [Expo 58 BuildProperties](https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/).
