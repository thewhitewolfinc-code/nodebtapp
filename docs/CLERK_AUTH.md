# Clerk authentication integration

> Current follow-up: [Dashboard navigation and Android validation](AUTH_DASHBOARD_VALIDATION.md). Its routing, offline implementation and evidence supersede the historical results below.

Updated 30 October 2026. This extends the earlier [authentication design milestone](AUTH_IMPLEMENTATION.md).

The subsequent [readiness audit](AUTH_READINESS.md) fixes the missing native callback registration, rejects uninitialized browser results, adds production-profile key checks, and records the remaining acceptance/release gates.

## Existing application

The selected Clerk application is **`app_3L2KODAdwaw7Mfoh6U3f7p9h9cb`**. The installed `@clerk/expo` **4.14.4** is retained. No `clerk init`, accountless application, SDK upgrade, or new test user was introduced.

The user confirmed Native API and Google were enabled, then completed Clerk CLI login in their own terminal. The project was linked to the exact selected application, and Doctor verified that it is reachable. Its development publishable key was restored into a **new, ignored `.env.local`** using a filtered CLI configuration stream. Existing environment files were not read, printed or overwritten. No backend secret was written. Expo subsequently confirmed loading and exporting the public-key variable.

## Implemented behavior

- Welcome retains the approved Google and Guest actions. Google uses the installed SDK's stable `useSSO` hook and explicitly activates only an SDK-created session. Cancellation remains retryable.
- `ClerkProvider` remains at the application boundary through `AuthSessionProvider`. Native tokens use Clerk's SecureStore-backed token cache. The app uses `process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; no key is hardcoded.
- Successful sign-in and restored active sessions open `/dashboard`; `/account` is a separate profile destination displaying the real Clerk user's name/email and a working sign-out action. Sign-out returns to Welcome, with retryable errors.
- Loading, signed-out, signed-in and verification-required states are distinct. Pending requirements cannot be described as completed authentication or expose guest records.
- An incomplete Google result or pending session offers **Finish sign-in securely**. The installed SDK's `useHostedAuth` hook opens Clerk's hosted flow for instance-specific MFA, missing fields or session tasks. The SDK validates its PKCE/state exchange and activates the native session. This recovery path is implemented and typechecked; live instance-specific scenarios remain untested.
- Both flows use `nodebt://sso-callback`. The SDK owns callback completion. App routes do not activate an incoming session ID from an arbitrary URL.
- Root `Stack.Protected` rules remove guest navigation history when account authentication becomes active. The nested ledger boundary independently prevents guest storage from mounting for account/pending sessions. Guest onboarding waits for session restoration.
- Google, Guest, hosted follow-up and sign-out share a synchronous request gate across retained route instances, preventing overlapping entry actions around callbacks.
- Missing configuration provides clear availability feedback. Web stays a design preview; this authentication flow targets the native Android/iOS app.
- `.clerk/` is ignored to keep local CLI links and claim material private. This update adds no dependency or native module.

## Financial data boundary

Authentication does not create an account financial store, backend, sync service, guest import, merge, or purchase entitlement. An account session cannot reuse the device guest ledger as its account database. Account explains the limitation and provides sign-out to return to local Guest tracking. The financial domain, storage schema, repository and encryption logic are unchanged.

## Application setup completed

Commands run from **Nodebt**, not its parent workspace. As required by the supplied guide, the user first authenticated the CLI in their own terminal:

```powershell
cd Nodebt
npx.cmd --yes clerk@latest auth login
```

After that login, the agent linked only the selected application and reran diagnostics:

```powershell
npx.cmd --yes clerk@latest link --app app_3L2KODAdwaw7Mfoh6U3f7p9h9cb
npx.cmd --yes clerk@latest doctor
```

The initial diagnostic could not find `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. The restored variable now lives in `Nodebt/.env.local`; both this file and local `.clerk/` state are ignored. Future build environments must supply the selected application's publishable key under that same variable name. Do not paste keys into chat or replace a working key blindly.

The mobile SDK needs the publishable key. Doctor exits successfully after linking but still lists an environment-variable warning, including the public key and `CLERK_SECRET_KEY`; Expo independently confirms loading the public-key variable. This warning is **not** an instruction to put a backend secret in the mobile app. Never give a secret key an `EXPO_PUBLIC_` prefix or import one into mobile code. The generic `clerk env pull --print` output was captured privately, filtered to the single development publishable key, and discarded; only that public variable was written using exclusive new-file creation.

The readiness audit directly verified Native API and Google enabled on the selected development instance. It found the native callback allowlist empty, registered `nodebt://sso-callback`, and independently verified that exact entry. The configured development package/bundle identifier remains `app.nodebt.development`. Production identities and OAuth configuration are a separate release step.

## Run and verify

The configured Metro server responded with HTTP 200 at `http://localhost:19000/status`. Port 8083 became unavailable; no unverified process was stopped. The installed development client already contains Clerk and the required Expo modules; these JavaScript-only changes add no new native build requirement.

To start the usual development workflow from `Nodebt`:

```powershell
npm.cmd run start:dev -- --port 19000
```

Connect the installed NoDebt development client to Metro. For a fresh device without the native client, follow [native setup](P1_NATIVE_SETUP.md). Expo Go does not provide this project's SQLCipher guest ledger.

Manual acceptance:

1. Complete your own Google sign-in; confirm Your account displays the correct identity.
2. Close and reopen the app; confirm the same account session is restored.
3. Try a guest financial deep link while signed in; confirm Dashboard appears without exposing guest records.
4. Sign out; confirm Welcome, then confirm existing records remain when Guest is selected.
5. Cancel a Google flow and retry. If extra verification is required, finish the hosted follow-up and confirm fully signed-in status.

The user could not perform a Google sign-in during this session, so the live authenticated sign-in/restart test remains pending. No account or synthetic user was created as a substitute. The emulator initially had unavailable Android services and an unresponsive System UI. After a data-preserving reboot and choosing Wait on the system prompt, the framework recovered. The real native Clerk SDK loaded its development configuration, the existing empty guest dashboard opened, and Welcome rendered with **both Google and Guest enabled**. No Google authentication was initiated.

Fresh evidence: [native Welcome screenshot](ui-validation/clerk-ready.png) and button accessibility hierarchy (retained locally), captured at 1080 × 2400, default density and 100% text scale. The app is left on Welcome connected to Metro on port 19000.

## Local validation

- Application and test TypeScript checks passed; Expo ESLint passed.
- Native Clerk initialization and Welcome button readiness passed on the Android emulator after recovery. This is not a completed Google OAuth or authenticated-session restoration test.
- **80 tests passed, 0 failed** after the readiness audit, including 18 auth/build tests covering activation, cancellation, follow-up, stale/uninitialized browser results, failures, request locking, session restoration, pending requirements, guest/account isolation and production-profile configuration.
- Android production JavaScript export passed before and after public configuration was restored: **1597 modules**, with the configured output under ignored `.expo/clerk-android-configured`. Bytecode was disabled for this local bundling diagnostic; it is not a signed release or a new APK.
- The ordinary `npm run check` attempt encountered a host memory allocation failure. Its checks completed sequentially with bounded Node heaps and test concurrency 1, without skipping cases. Existing Node module-format warnings remain.
- Clerk CLI **4.1.0** Doctor verifies CLI authentication, project linkage and reachability of the exact application and exits 0. Its remaining environment warning is recorded above; production is not configured. Earlier sandbox-network and approval-timeout failures were overcome by the successful retry.

Sources checked: [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart), [useSSO](https://clerk.com/docs/reference/expo/native-hooks/use-sso), [session tasks](https://clerk.com/docs/guides/configure/session-tasks), [Clerk CLI](https://clerk.com/docs/cli), [Expo protected routes](https://docs.expo.dev/router/advanced/protected/) and [Expo 58 WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/). Installed SDK declarations and implementation were checked for SSO and hosted-auth contracts; experimental auto-activation hooks were not introduced.
