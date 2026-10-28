# Nodebt

Private borrowing and lending tracking built in the existing Expo 58 / React Native / TypeScript project.

P0's financial engine is retained. P1 connects encrypted native SQLite persistence, guest onboarding, Home/Records/Activity/Insights/Settings, categories, repayments/collections, financial revisions, explicit adjustments, settlement and record lifecycle journeys. **Android encrypted storage and isolated native financial tests now pass; complete device journeys and iOS verification remain pending. This is not a release-ready build.**

- [Approved decisions and readiness](docs/DEVELOPMENT_READINESS.md)
- [Implementation milestones](docs/IMPLEMENTATION_PLAN.md)
- [P1 storage design](docs/P1_STORAGE.md)
- [Native build setup and acceptance checklist](docs/P1_NATIVE_SETUP.md)
- [Verification results and exact changed files](docs/P1_VERIFICATION.md)
- [Technical audit and Android connectivity results](docs/TECHNICAL_AUDIT.md)
- [28 October Android storage verification](docs/P1_ANDROID_VERIFICATION.md)

## Development

Use the existing `Nodebt` directory. Validated runtime: Node 24.22.0 / npm 11.19.1. PowerShell's current script policy requires the `.cmd` launchers.

```powershell
npm.cmd run check
```

This generates app-only route declarations, checks application/test TypeScript, runs Expo ESLint, and executes the financial and real-SQLite repository tests. Tests use isolated synthetic temporary files; they do not create demo financial records in the application. The original 30 financial tests remain unchanged.

## Running the guest tracker

SQLCipher requires a **native development build**. Expo Go and web deliberately show a storage requirement instead of persisting an unencrypted ledger.

The technical audit verified Expo Go connectivity on a physical Android phone over USB and Wi-Fi. It also corrected eager native imports that previously crashed route loading before that explanation could appear. This does not add SQLCipher to Expo Go. `npm.cmd start` now explicitly targets the Nodebt development client.

Java/Android SDK user environment settings have been configured on the audited Windows machine. Reopen the IDE/terminal to inherit them; check `java -version` and `adb devices -l`. See the audit for verified component versions and remaining native acceptance checks.

After completing the JDK/Android SDK and device setup in [P1_NATIVE_SETUP.md](docs/P1_NATIVE_SETUP.md):

```powershell
npm.cmd run android
```

For subsequent JS-only development sessions with the native app already installed:

```powershell
npm.cmd run start:dev
```

Use the EAS development profiles described in the setup guide if local native compilation is unavailable. iOS requires a signed device build or a macOS simulator environment. App identities are development-only; no production app registration or cloud service has been created.

## Data and milestone boundaries

Free supports 6 default categories and 3 custom categories **per direction**. Pro policy supports all 16 borrowing / 14 lending defaults and unlimited custom categories; retained categories and assignments survive expiry. P1 runs guest Free policy and tests Pro/expiry rules without a paid unlock toggle.

Records store an explicit currency and money scale. Initial entry/validation uses INR. Formal loans, credit cards, BNPL, informal borrowing and personal lending share the validated ledger; unsupported interest terms are entered explicitly rather than inferred.

Guest data stays on this device. Do not uninstall/clear an installation containing real records: encrypted export/restore and cloud recovery are later milestones. Keys, financial records and sessions are not stored in browser localStorage. There is no plaintext or mock-financial-data fallback.

Supabase, RevenueCat, AdMob, reminders, App Lock, encrypted file backups and Pro algorithms are not enabled in P1. The original starter screens/tab source are retained under `src/legacy` for reference. Do not run the starter `reset-project` command or `npm audit fix --force` during this implementation.
