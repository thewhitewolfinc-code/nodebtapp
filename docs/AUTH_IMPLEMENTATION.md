# Authentication visual implementation

Reference and architecture inspection completed before implementation on 30 October 2026.

The subsequent [Clerk integration update](CLERK_AUTH.md) adds an account destination, root protected navigation, pending-verification recovery and six additional auth tests. That record supersedes the earlier account-unavailable screen and test counts described below.

## Reference analysis

All five supplied images in `Design reference/` were inspected. No additional page-specific reference folders were found. `auth-ref-screen.png` governs composition; `Design System.png` governs foundations. The two multi-screen boards inform the wider financial UI without authorizing other screen work.

The auth reference is 941 × 1672: warm white canvas, centered green loop/arrow symbol, two-tone NoDebt wordmark, three short centered purpose statements, a green valley/path illustration, three privacy notes, a lime Google pill, a white outlined Guest pill, and a quiet footer. The illustration and gradients already present in the approved assets are preserved. No generated illustrations or invented financial sample records are introduced.

The system specifies Inter, a green scale, green-tinted neutrals, semantic feedback colors, an 8-point spacing rhythm with 4-point subdivisions, 4/8/12/16/24 radii, restrained elevation, and outline icons. Auth buttons deliberately use the reference's pill shape and lime CTA; the broader system's rectangular green buttons do not override the primary auth reference.

### Palette usage

This is a personal finance tracker for people managing both borrowing and lending, initially in India. The supplied green identity and generous neutral space support a calm, approachable experience with legible decisions. Existing brand equity is preserved.

| Role | Token value | Usage |
| --- | --- | --- |
| Primary green | #13852C | Wordmark and brand emphasis |
| Deep green | #003C2E | Supporting brand structure |
| Lime accent | #C2F568 | Primary auth action, with dark text |
| Canvas / surface / subtle surface | #FAFCF8 / #FFFFFF / #F0F4EF | Background, controls, locale chip |
| Border | #E2E7E1 | Quiet decorative dividers and outline; text identifies controls |
| Primary / secondary / muted text | #101820 / #58616C / #6B746F | Content hierarchy |
| Focus | #176640 | Visible keyboard focus |
| Success / warning / error / info | #137A3B / #805600 / #A32932 / #175A91 | Feedback with explicit text, never color alone |
| Feedback surfaces | #ECF8EF / #FFF5D8 / #FFF0F0 / #EEF6FE | Semantic backgrounds |

Keep neutral surfaces dominant; use roughly 80% neutral, 15% supplied brand/landscape artwork, and 5% lime emphasis as a layout guide rather than a measured pixel claim. Reserve lime for the main auth action and existing mark, avoid colored body paragraphs, and keep shadows out of the field-free auth screen. Auth deliberately stays light in dark OS mode; these light tokens must not be reused unchanged on a future dark surface. Text/focus contrast is recorded in `auth-validation/contrast.json`.

## Foundations and implementation

- `src/design/tokens.ts`: palette, semantic feedback, typography, spacing, radius, stroke, elevation, touch-target and layout tokens. The auth surface intentionally keeps the approved light treatment in either OS theme; existing financial pages keep their current light/dark behavior.
- `src/components/nodebt/action-button.tsx`: reusable primary/outline action, 54dp minimum height, expanding labels, loading indicator, disabled, pressed and keyboard-focus treatments. Existing shared financial cards and inputs are retained rather than adding unused replacements to this field-free screen.
- `src/features/auth/privacy-notes.tsx`: accessible text plus decorative privacy icons.
- `src/app/welcome.tsx`: responsive and scrollable reference composition; exactly Google and Guest entry actions; error/cancellation feedback with live announcements.
- `assets/auth/`: artwork extracted from supplied images. The brand symbol comes from `Logoicon.png`; the reference supplies the landscape and small icons. `scripts/extract-auth-assets.cjs` makes extraction reproducible. All screen copy/buttons remain native text and controls.
- `src/features/auth/session.tsx` and `clerk-session.tsx`: optional Clerk provider, native SecureStore token cache, Google-only browser OAuth, explicit `nodebt://sso-callback`, activation only after a real Clerk session, sanitized failures.
- `flow.ts`: shared request lock and session/ledger scope policy, covered by behavioral tests.
- `ledger-boundary.tsx`: authenticated and pending sessions cannot enter guest financial routes. Signed-in accounts receive an explicit storage-unavailable state and sign-out action until account storage exists.
- Existing financial routes (apart from the startup resolver) moved unchanged into `src/app/(guest)/`; the group layout owns GuestProvider. Public URLs are preserved. The root navigator stays mounted while ledger/session loading occurs.
- `app.config.ts` registers Clerk; `app.json` uses the supplied mark and canvas for the splash. `.env.example` documents only the public key.

Runtime dependencies added: `@clerk/expo` 4.14.4, `expo-auth-session` ~58.0.16, and `@expo-google-fonts/inter` ^0.4.2. Existing Expo Font, WebBrowser and SecureStore modules are reused. The pinned Clerk peer range includes Expo 58.

## Material differences and decisions

The repository's previous plan selects Supabase Auth. The newer user brief explicitly selects Clerk, so this milestone uses Clerk for identity. No Supabase backend, token trust policy, account database, migration, or synchronization behavior was invented. Historical plans remain historical; integrating Clerk identity with a future backend needs a separate security contract.

Only English is configured in the product. The reference's language chip is a static locale label, without a misleading dropdown. No Terms/Privacy destinations or approved legal text were supplied; the footer therefore explains guest data locality rather than asserting consent to invented policies. The reference's “Sync later” note is expressed as “No automatic cloud upload,” which describes actual behavior without promising an implemented cloud feature.

Guest entry uses the original encrypted repository and its idempotent `onboard` command, then opens Home. It does not create financial records. No domain calculations, storage schema, encryption key logic, financial commands, guest migration or cloud uploads were changed.

## External configuration and account boundary

Google sign-in requires a real Clerk application, Native API enabled, Google social connection, approved Google credentials and callback allowlisting. Populate `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` with its real public key; no secret key belongs in the mobile app. Rebuild the native development client after config/dependency changes. Missing configuration leaves Guest usable and produces a clear Google availability message.

There is no account-scoped financial store in this repository. A completed Clerk session is deliberately blocked from all guest financial routes rather than relabeling guest records as account records. The block is an honest incomplete integration state, not account Home or a simulated sign-in. A live Google roundtrip and account financial integration cannot be signed off without configuration and the separate account storage milestone.

## Verification evidence

The baseline passed TypeScript, lint, and all 62 existing tests. Seven additional tests exercise real flow decisions: activation, cancellation/dismissal, incomplete verification, provider/activation failures, concurrent entry exclusion, retry after failure, and guest/account route isolation. They use synthetic SDK outcomes and do not claim to be Google end-to-end tests.

See `auth-validation/README.md` for actual native capture iterations and the final checks. `scripts/compare-auth.cjs` normalizes comparison images to 393 × 698 and generates the side-by-side and overlay. Numeric text contrast is measured using the WCAG sRGB luminance formula. Image overlays are diagnostic evidence, not a pixel-perfect certification.

## API references checked

- [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Expo font loading](https://docs.expo.dev/versions/v58.0.0/sdk/font/)
- [Expo WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/)
- [Expo AuthSession](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/)
- [Clerk useSSO](https://clerk.com/docs/reference/expo/native-hooks/use-sso)
- [Expo Clerk integration](https://docs.expo.dev/guides/using-clerk/)

Installed SDK declarations/source were also checked: `@clerk/expo` 4.14.4 declares Expo `>=54 <59`; nullable browser results and the installed config plugin behavior were taken from that package. The installed stable `useSSO` requires explicit `setActive`; no experimental auto-activation hook is used.
