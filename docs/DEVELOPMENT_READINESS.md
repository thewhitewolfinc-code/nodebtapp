# Nodebt development readiness

Reviewed: 27 October 2026. This is a repository development record, not a production certification.

## Decision

**APPROVED — begin implementation in this repository.** There is no remaining product decision that prevents starting the financial domain, persistence, or core journeys. The questionnaire is closed. Routine implementation choices use the defaults below; questions are reserved for material conflicts or external account access that cannot be resolved from the project.

The full commercial MVP remains the target. Breaking development into milestones does not defer approved launch features.

## Status review

| Status | Area | Finding / action |
| --- | --- | --- |
| APPROVED | Product and audience | Android and iOS; users with mixed formal and informal debts and money lent to others; India/INR is the initial launch, with globally adaptable architecture; web is a development preview. |
| APPROVED | Core ledger | Private borrowing/lending records; current opening snapshot; explicit principal, interest and fee transactions; dated corrections and revision history; independent liability/receivable totals. |
| APPROVED | Payments and lifecycle | Partial installments, overdue remainders, FIFO unless explicitly allocated, supported principal-only prepayments, increases, adjustments with reasons, forgiveness/write-offs, zero-balance closure, separate archiving and identity-preserving reopening. |
| APPROVED | Commercial rules | Unlimited core records; Free has exactly 6 borrowing defaults and 6 lending defaults plus up to 3 custom categories per direction; Pro unlocks all 16 borrowing defaults, all 14 lending defaults and unlimited custom categories, plus all four planning tools; ₹99/month, ₹699/year; separate ₹1,499 lifetime ad-free purchase. No timed trial. Banners only on Home/Insights. |
| APPROVED | Guest, offline and cloud | Guest first record with skip; optional Google/Apple account; offline edits; visible financial conflicts; reviewed guest import with no automatic financial merge or overwrite; sign-in required before purchase. |
| APPROVED | Privacy and recovery | Device reminders; generic notification content by default; free optional device App Lock; CSV plus authenticated encrypted password-protected backups; no password recovery/backdoor; export before account deletion. |
| APPROVED | Technology | Existing Expo 58 / React Native 0.88 / React 19.3 / TypeScript 6. No project reinitialization or framework migration. |
| APPROVED | Starter checks repaired | Fixed the existing web tab ref type error and hydration lint error; installed Expo-compatible lint tools and Node test types. Application/test typecheck, lint and financial tests pass; see the verification checkpoint. |
| BLOCKED | Live cloud integration only | No Supabase project configuration, OAuth setup, RLS policies, or deployed sync/deletion endpoints exist in this repo. Implement locally first; configure external accounts before enabling cloud behavior. |
| BLOCKED | Live purchases/ads only | Store app identities, signing, RevenueCat products/webhooks, AdMob IDs and consent configuration are not configured. Sandbox validation precedes enabling production integrations. |
| BLOCKED | Public release | Full financial fixtures, device QA, encrypted restore verification, isolation/deletion/sync tests, privacy disclosures, and dependency security review must pass. This does not block local development. |
| DEFERRED | Later product phases | PDF reports (later Pro), other currencies/languages, public web product, bank integration, AI, lending/origination, shared ledgers, email/SMS reminders and collection services. |

## Financial ambiguities resolved without another interview

1. **Recorded facts versus estimates:** interest and late fees never accrue implicitly in the recorded ledger. Supported contract engines may propose explicit entries and schedule changes for review; unsupported terms require manual statement reconciliation and are excluded from forecasts. “Applicable rules” does not mean guessing a lender's contract.
2. **Principal and paid interest:** a component payment can only settle an existing component balance. If an EMI includes interest or fees not yet recorded, the eventual entry form must explicitly review and atomically record that charge and its payment. Do not subtract the entire EMI from principal or infer an APR from it.
3. **Current snapshot:** onboarding needs current principal and any separately known unpaid interest/fees. Unknown breakdowns are marked unreconciled before inclusion in a planner. Never label a total including unknown charges as verified principal.
4. **Past progress:** tracking starts at the opening snapshot. No invented payment history, historic interest, or pre-app repayment percentage.
5. **Money and dates:** integer paise with checked arithmetic; strict calendar dates for due/effective dates; canonical UTC timestamps for revisions. Never determine edit precedence from device clock alone.
6. **History and corrections:** new revision plus expected parent revision, reason and stable transaction ID. Concurrent branches require resolution. Corrections revalidate the complete current ledger and installment allocations. No negative principal, interest, or fee balances; credits/refunds require an explicit supported model later.
7. **Schedules:** one-time or monthly obligations; preserve the original month-end anchor. Scheduling is independent from posting interest. A principal-only prepayment changes principal but never silently pays a scheduled installment or rewrites its future amounts.
8. **Closure:** actual cash, waived principal/charges, and written-off receivables are reported independently. Reconciliation to zero is not presented as cash repayment. Archived outstanding debts remain in total obligations. Settled/closed records suppress reminders; any unpaid schedule residue is resolved as waived/cancelled, not reported as paid cash.
9. **Currency:** preserve explicit currency metadata through imports/backups. Only INR is accepted at launch; unsupported currencies fail validation instead of being relabeled or summed.
10. **Duplicate detection:** flag possible matches for review. Stable IDs/revision IDs support retry deduplication; amount/name similarity never authorizes automatic merging. Guest source data remains until destination validation succeeds.

## Environment evidence

- Existing Git history: initial commit `8d30e2b`; worktree was clean at review start.
- Node `v24.22.0`, npm `11.19.1`; Windows PowerShell requires `npm.cmd` / `npx.cmd` with the current Restricted script policy.
- Dependencies were already installed. Existing Expo-compatible package versions are retained.
- No Android SDK/ADB, Java executable, or `ANDROID_HOME` / `JAVA_HOME` was detected through the checked command/environment paths. Native device/build readiness remains to be established. Windows cannot run Apple's iOS Simulator; use physical iOS hardware and an EAS development build.
- Baseline TypeScript failed in `src/components/app-tabs.web.tsx`; baseline lint could not initialize offline because ESLint/config were absent. Both repairs are included in the first milestone, followed by fresh checks.
- Expo CLI's transitive Zod vulnerability remains a tracked tooling risk: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . Do not run `npm audit fix --force`, downgrade Expo, or force a different Zod major under the CLI. Recheck upstream before release.

## Remaining mandatory gates, not another questionnaire

- Choose/test the exact supported forecasting contract models before shipping calculators; lender-exact variable/daily interest and penalties stay unsupported until implemented and verified.
- Wire and verify encrypted on-device storage and the versioned import/backup schema before storing real financial data.
- Configure Google/Apple developer identities and services before their integration tests; native App Lock, ads, purchases and SQLCipher require native development-build testing.
- Validate provider cost limits before public launch. The agreed Supabase Pro base budget uses the $25/month target before taxes/extras; paid build services, store registration, monitoring overages and revenue-based fees are separate costs to track.
- Privacy/retention disclosures and ad consent need launch-market review. No claim of legal compliance is made by this engineering review.

## Sources checked

- Expo SDK 58: https://docs.expo.dev/versions/v58.0.0/
- Expo SQLite / SQLCipher: https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/v58.0.0/sdk/securestore/
- Expo lint setup: https://docs.expo.dev/guides/using-eslint/
- React hydration-safe external stores: https://react.dev/reference/react/useSyncExternalStore
- Supabase pricing: https://supabase.com/pricing
- Supabase offline-first constraints: https://supabase.com/blog/react-native-offline-first-watermelon-db
- RevenueCat pricing: https://www.revenuecat.com/pricing

## Verification checkpoint

- Expo Doctor: **20/20 checks passed**.
- Application and standalone test TypeScript checks: **passed**.
- Expo ESLint: **passed**, including repaired starter issues.
- Financial domain tests: **30 passed**.
- Existing app web/server export: **passed** with Expo 58.
- Git history and existing runtime dependency declarations preserved; only development tooling dependencies added.
- Native device tests, encryption, cloud integration and purchase/advertising integration have **not** been completed. The app still presents its starter screens; financial domain code is not yet connected to persistence or UI.
- The standalone Node test runner emits a non-failing module-type detection warning; application module configuration is unchanged. Expo currently resolves ESLint 9 for its lint toolchain; npm warns that this major is deprecated, so a compatible lint-toolchain update remains maintenance work.
- GitHub Actions workflow added with Node 24 and pinned current official action releases; its hosted execution awaits a push/PR.

## Approved P1 category and audience correction

- Free: exactly 6 default borrowing categories and 6 default lending categories; up to 3 custom categories per direction.
- Pro: all 16 borrowing defaults, all 14 lending defaults and unlimited custom categories.
- Downgrade preserves custom categories and historical assignments; existing categories remain usable. Creating new custom categories is blocked when the Free limit is already reached, including retained Pro categories. Archiving cannot bypass the limit or erase historical references.
- Initial catalog labels are editable implementation defaults with stable, direction-specific identifiers; the counts and access rules above are approved requirements.
- The audience includes mixed formal/informal borrowers and people who lend money. India/INR is the first configuration, not an assumption embedded in category IDs or ownership architecture.
- P1 does not enable Supabase, paid entitlements, ads or Pro algorithms. Guest access uses the Free policy; Pro/expired-Pro policy is exercised through repository/domain tests, not an unlock toggle in the app.
