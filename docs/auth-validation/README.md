# Authentication validation — 30 October 2026

The screen implementation and guest path are validated for Android development testing. Live Google authentication and account financial storage remain blocked; this is not a release sign-off.

## Visual evidence

[Reference → initial → final comparison](comparison.png) · [50% overlay](overlay.png) · [Final full-resolution capture](final.png)

All app screenshots were captured from the real Medium_Phone Android emulator using ADB. `initial.png` is the first implemented render, not a screenshot of the previous P1 Welcome screen. Comparison panels are bilinearly normalized to **393 × 698** before compositing; source captures are retained at their real resolution. No simulator result was fabricated and no pixel-perfect claim is made.

| Configuration | Executed result / evidence |
| --- | --- |
| Primary: Android API 37, x86_64, 1080 × 1920, 440dpi, text scale 1.0 | [Final](final.png), hierarchy (retained locally). Both auth actions and footer fit above the Android navigation area. |
| Additional: 1080 × 2400, 420dpi, text scale 1.0 | [Larger screen](large-screen.png), hierarchy (retained locally). No clipping or overflow. |
| Additional: 1080 × 2400, 420dpi, text scale 1.5 | [150% text](large-text.png), hierarchy (retained locally). Google wraps and grows; Guest and privacy copy remain readable. The landscape moves below the enlarged copy to preserve contrast. |
| Keyboard focus at 150% text | [Focus](keyboard-focus.png), hierarchy (retained locally). Google receives native focus and a visible green outline. |

The first render placed Guest partly below the fold and cut off the tall foliage. Refinement reduced logo/line-box/spacing overhead, restored the complete supplied side foliage, preserved the official mark's pale lime highlights, removed icon background boxes, and fitted the footer to Android safe areas. Final primary button bounds are `[83,1403]–[998,1551]` and `[83,1574]–[998,1723]`, approximately **54dp** high. Their normalized top positions are about 510dp and 572dp, matching the primary reference's composition closely.

A separate functional refinement changed [initial clipped Google feedback](google-unavailable-initial.png) into [fully visible feedback](google-unavailable.png). Errors scroll into view and use an accessible alert/live region. The Google and Guest controls remain enabled for retry after failure.

Material reference differences remain deliberate: the official supplied icon replaces the slightly different reference rendering; Inter/native text replaces raster lettering; the primary fill is flat lime; English is a fixed locale label; unconfigured legal links are replaced with truthful guest privacy copy; the third privacy note states “No automatic cloud upload.” Android status/navigation bars differ from the iOS reference. These are not included in a numerical image-similarity pass/fail score.

## Functional and automated results

| Check | Actual result |
| --- | --- |
| Application and test TypeScript | PASS — strict project checks. |
| Expo ESLint | PASS — no lint errors or warnings. |
| Node financial/storage/auth tests | PASS — **69/69**, including all 62 original tests plus 7 auth tests. Log (retained locally). |
| Native prebuild / x86_64 debug APK | PASS — successful cached rebuild in 6m 18s, 486 tasks. Build log (retained locally). |
| Real Google availability/error/retry UI | PASS with missing configuration; full message is visible and actions remain available. No Google sign-in success was simulated. |
| Real Guest entry | PASS — original encrypted repository opens Home, marked “Private guest ledger,” with actual empty-ledger zero balances. [Capture](guest-home.png). No financial records were seeded. |
| Process force-stop / cold start | PASS — onboarding remains complete and Home returns with both zero balances. [Capture](cold-start.png), hierarchy (retained locally). Development menu was dismissed before capturing. |
| Guest Home → public Welcome → Guest Home → Welcome | PASS after fixing retained-screen provider lifetime. [Return capture](guest-return.png). Final captures contain no render error, missing guest context, or navigation-container warning. |
| OAuth completion/cancellation/failure, incomplete verification, duplicate entry races, retry and account/guest gating | PASS in focused automated tests using synthetic SDK responses. Real configured OAuth/session scenarios remain unexecuted. |
| Offline Expo dependency version check | Reports dependencies up to date, with Expo's warning that offline validation is less reliable. Not an Expo Doctor pass. |
| Dependency audit | 9 reported issues: 6 low, 3 high, 0 critical. [Audit](dependency-audit.json). Reports include Expo CLI/Zod and deepmerge dependency chains; no compatible automatic fix is offered. No forced SDK/dependency override was applied. |

The financial domain, database schema, encryption/key logic and repository commands have no source edits. Ten financial route files were verified byte-for-byte against HEAD after moving into `(guest)`. Startup resolution changed to preserve returning-guest navigation and allow the public Welcome screen when native storage cannot open.

The initial guest-to-Welcome test exposed a retained-screen context bug: checking the global pathname inside the guest group removed its provider while Home was still mounted underneath Welcome. The group now gates only on session state and retains its provider across public navigation. The complete native roundtrip was rerun successfully.

The build initially encountered an ARM64-only APK on an x86_64 emulator, workstation memory exhaustion, a Windows generated-build-path watcher failure, and a blocked Expo account lookup during manifest generation. These were resolved with the correct ABI build, limited Gradle concurrency, stopping the emulator while compiling, a Metro native-output exclusion, and the local offline CLI mode. None was reported as a passing render before a real auth capture existed.

## Accessibility evaluation

[Measured contrast data](contrast.json): body 6.09:1, primary action label 14.21:1, Guest label 18.03:1, error text 6.50:1, info text 6.62:1, and focus outline 6.76:1 against their actual surfaces. Body/action/error text exceeds AA's 4.5:1 normal-text threshold. Pale decorative dividers are not used as the only indication of an interactive control; labels, button semantics and focus provide identification.

Controls have a 54dp minimum target and expand for larger text. Loading/disabled accessibility state, press feedback and inline live error feedback are implemented. Native focus and 150% text layout were observed. TalkBack announcements, full assistive-technology acceptance, physical-device and iOS QA were not executed.

## Remaining blockers and readiness

- `.env` is present but has no Clerk public key. Supply a real development publishable key, enable Clerk Native API and Google connection, configure provider credentials, and allowlist `nodebt://sso-callback`. Never place secret keys in the app.
- There is no account-scoped financial store/backend trust contract. A real signed-in Clerk session is blocked from guest financial routes and receives the explicit account-storage-unavailable state. Real session restoration, verification tasks, cancellation, errors and sign-out require configured end-to-end testing.
- No guest upload, merge, migration or account financial behavior was added. That work requires its own reviewed isolation contract.
- Approved Terms/Privacy content and destinations are still missing. No consent or legal compliance claim is made.
- The current built APK targets **x86_64 for the emulator**. For an ARM64 phone, create a fresh development build for the connected device. Source/configuration is ready for UI/guest smoke testing; live account authentication and public release are not ready.
- Existing broader P1 financial-device/iOS acceptance and dependency maintenance gates remain outside this auth milestone.

## Reproduce

From `Nodebt`, with the development APK installed on the emulator:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1'
npx.cmd expo start --dev-client --port 8083 --max-workers 2 --offline
```

Use ADB reverse for port 8083, open the dev client, and navigate to `nodebt:///welcome`. `--offline` and `--localhost` cannot be combined in this SDK. CLI offline mode avoids Expo account lookups; it is not a claim that a standalone offline app binary was tested.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/capture-auth-android.ps1 -Name final
node scripts/compare-auth.cjs
npm.cmd run check
```

The capture helper requires a fresh accessibility dump and avoids stale-tree results. It dismisses only the known development menu. Set the display configuration before launching a fresh app process; do not compare screenshots captured midway through Android activity recreation. Capture filenames are validated and outputs stay in this documentation directory.

Publication note: raw Android hierarchy dumps and build/check logs are retained locally and excluded from Git. Published images in this directory show approved reference artwork, read-only sample data or an empty Guest workspace. Real account captures remain private under the ignored .expo directory.
