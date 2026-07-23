# Frontend agent handoff — Proyecto Mediación mobile app

Last updated: end of phase 6 (profile, account settings, privacy/help/legal info, mocked session & account actions). Written for a future Claude Code session picking this work back up — read this before touching `mediacion-app/`.

The roadmap changed after phase 5: the plan is now to **finish the full mocked product** before any real backend integration begins. Phase 6 was the first phase under that revised roadmap — do not start wiring a real backend until the user explicitly says the mocked product is complete and asks for it.

## Product context

A mobile app (Android/iOS, Expo + React Native) for resolving family conflicts through negotiation, conciliation, or mediation, with an AI that suggests (never decides) shared proposals. Each party loads private positions with an acceptable range; the AI proposes a sanitized middle ground; if not jointly accepted, a new round opens; from round 3 a human mediator can be requested. Agreements get a **mock** digital signature in this phase — no real DocuSign, no legal validity claims. Roles: **Parte** (mobile, primary user), **Mediador** (from round 3), **Estudio** (web panel, not built yet), **Admin**. Legal basis for real signatures (future): Ley 25.506 (Argentina). Confidential internal project — do not restate commercial/investor details even if encountered elsewhere in the repo.

The core non-negotiable product rule across every phase: **RN-01, absolute position isolation** — a party never sees the other party's raw private data, ever, in any surface.

## Repository boundaries (read this every session)

- **Frontend write scope:** `C:\Users\Usuario\Documents\GitHub\Mediacion\mediacion-app` only.
- Everything else (`apps/api`, `supabase/`, `packages/*`, `apps/panel`, root config, `mediacion.dbml`) is **read-only** for the frontend agent — inspect freely, never edit.
- `agents/front/AGENTS.md` (this file) is a **named exception**, written only because the user explicitly asked for it by path in a given turn — don't treat that as a standing license to write elsewhere outside `mediacion-app/`; ask first.
- Root `pnpm-lock.yaml` changes only when an explicitly approved dependency is installed via `pnpm`/`npx expo install` (never `npm`/`yarn`). Every phase so far shipped with **zero new dependencies** except phase 1's `expo-clipboard`, `expo-localization`, `react-native-svg`, `@expo-google-fonts/*`, `lucide-react-native`, `i18next`/`react-i18next` (all foundational, phase-1-only installs) and phase 2's `expo-clipboard`.
- Never upgrade Expo/React Native/React/Expo Router/TypeScript/i18next.

## Architecture

Expo Router (file-based), TypeScript strict mode, no `src/` wrapper (matches the project's existing root-level convention: `app/`, `components/`, `hooks/`, `constants/` all sit at `mediacion-app/` root).

```
mediacion-app/
  app/                        Expo Router routes (thin — screens compose feature components)
  design-system/
    tokens/                   colors, typography, spacing, radii, elevation, motion
    components/                Button, Input, Card, Badge, StatusPill, Avatar, Icon,
                                SelectableCard, EmptyState, LoadingState, ErrorState,
                                AIProcessingState — all cross-feature, reused everywhere
  features/
    cases/                    dashboard, case-detail, creation wizard, invitations
    positions/                own private-position CRUD
    negotiation/               rounds, shared proposals, responses
    agreements/                final agreement review + mock signatures
    profile/                    own profile, preferences, notifications, mocked session/account  ← new this phase
  services/                    one file per domain, each exports a singleton + a
                                createMockXService() factory — the ONLY place a real
                                backend integration would plug in later
  mocks/                       seed fixtures + deterministic simulation matrices
  types/                       one file per domain, mirrors real backend enum VALUES
                                exactly wherever a real enum exists
  i18n/                        i18next, es-AR default / en fallback, device-locale detection
  utils/                       small pure helpers (eligibility, validation, IDs, dates)
```

Each service (`cases`, `positions`, `negotiation`, `agreements`) is independent and mock-backed, using the **same** established pattern:
- In-memory arrays/records only — cleared on app restart, never persisted to disk.
- `services/mock-utils.ts` provides shared `delay()`, `rejectAfter()`, `createFailureController()` — every service uses these instead of reinventing latency/failure plumbing.
- Every mutation is **build-full-next-state → simulate delay → commit** — a forced/rejected promise never leaves partial state (no half-created records, no flipped-then-reverted status fields).
- A dev-only forced-failure hook per service (e.g. `__mockForceAgreementFailure(op)`), never imported by any screen — exists purely so a future test file can exercise the recoverable-error UI path deterministically.
- Cross-service reads are one-directional and go through the public service API only (e.g. `agreements.service.ts` calls `negotiationService.getAcceptedProposal()`, never reaches into another service's private store).

Hooks (`features/*/hooks/`) wrap each service: a fetch hook with `status: loading|error|empty|success` (or `| null` where "not applicable" is a real, calm state) plus a **focus-based silent refresh** (`useFocusEffect` from `@react-navigation/native`) that never re-flashes a loading spinner once the first load succeeded — this is how "return to a screen and see the new/updated item" works everywhere, with no global state library. Mutations get their own local `idle|pending|error` status per hook, never mixed into the fetch status.

No Context is used anywhere except two short-lived wizard drafts (`CaseCreationProvider`, `PositionDraftProvider`) scoped to their own route layout — everything else is service + hook + local component state. No Redux/Zustand/TanStack Query/XState anywhere in this codebase, deliberately.

## Design-system rules (enforced every phase)

- Warm cream canvas (`#f5f1ec`), white floating cards, charcoal (`#111`) primary actions and headline type. Sage (`#45645e`) is **reserved exclusively** for AI-assisted actions/badges (proposal generation) — never used for case creation, position saving, negotiation responses, document preparation, or signing.
- No resting-card shadows (`design-system/tokens/elevation.ts`'s `shadows.card` is `{}`); shadows exist only on transient overlays (`shadows.overlay`/`shadows.popover`, used by the two `Modal`-based confirmation dialogs).
- Modest radii (8/12/16px), no pill-shaped primary CTAs, no gradients/glassmorphism, no bounce/spring motion, 44×44px minimum touch targets, `Platform.OS !== 'web'` gating on any `useNativeDriver` animation (RN Web doesn't support it — see phase-3.5 corrective task).
- **Never nest a `Pressable`/`Button` inside another interactive `Card`.** RN Web renders `accessibilityRole="button"` Pressables as real `<button>` elements, and a `<button>` inside a `<button>` is invalid HTML — this was a real bug once (`PositionCard`), now avoided by convention: every `Card` that has actions is **non-interactive** (a plain `View`), and every action is a **sibling** `Button`/`Pressable`, never a descendant of another Pressable.
- Copy: Argentine/neutral Spanish (voseo — "Generá", "Podés", "Elegí"), sentence case, no emoji, no ALL-CAPS labels. Explicitly avoid Spain-Spanish forms (vosotros, "tomaos", "necesitáis") — this was corrected once early on and is now a standing rule.
- No hardcoded UI strings anywhere — every label/status/dialog/validation message goes through `i18n/locales/{es-AR,en}.json`. Domain **content** (mock case titles, proposal/agreement fixture text) is the one exception, modeled as "backend-provided content," not UI chrome.

## Privacy constraints (the actual hard rule, not just a style guideline)

- The frontend **never** reads, derives, compares, or displays a counterparty's raw private position data — no `getAllPositions`, no `getCounterpartyPositions`, no `comparePositions` method exists anywhere, and none should ever be added.
- `negotiation.service.ts` and `agreements.service.ts` only ever call `positionsService.getOwnPositions(caseId).length` (a count, nothing else) to gate "has this party entered at least one position" — `agreements.service.ts` doesn't even do that; it derives everything from the already-sanitized accepted `SharedProposal`.
- Shared proposals/agreements are **predetermined sanitized fixtures**, selected only by `caseId` + round number (+ active language) — never interpolated from `valueMin`/`valueMax`/`concessionConditions`/descriptions/`canConcede`. Every service file that touches this boundary has an explicit code comment saying so.
- Simulated counterparty behavior (negotiation responses, signatures) is a **deterministic matrix by caseId** (`mocks/negotiation.ts`, `mocks/agreements.ts`) — no randomness, no timers, no counterparty position/identity fixtures, and the simulated outcome is never revealed before the authenticated party acts first.
- No real AI call (OpenRouter), no real signature provider (DocuSign), no cryptographic signature, no legal-validity claim anywhere in copy — mock signature screens explicitly say "Firma simulada" / "Entorno de prueba" and never "firmado legalmente"/"firma certificada"/"identidad verificada".

## Backend-aligned enum values (verified against `mediacion.dbml`, read-only)

Mirror these **exactly** wherever the backend already defines them — this codebase does not invent parallel vocabularies for persisted state:

```
rol_usuario         admin | parte | mediador | estudio
usuarios.idioma     'es' | 'en'                              (plain text field, NOT the i18n locale code)
usuarios.activo     boolean only — there is no multi-state account-status enum
estado_caso        nuevo | activo | en_negociacion | acordado | cerrado | terminado | vencido
metodo_caso        negociacion | conciliacion | mediacion
tipo_invitacion     link | codigo | email
estado_invitacion   pendiente | aceptada | rechazada | expirada
categoria_item      cuidado_ninos | cronogramas | bienes | economico | personalizado
estado_ronda        activa | completada
estado_propuesta    pendiente | aceptada | rechazada
decision_propuesta  acepta | rechaza
estado_acuerdo      borrador | enviado_a_firma | firmado | con_aviso
```

Known, deliberate gaps between backend shape and this frontend (all documented in-code, not accidental):
- No `firmantes` table exists on the backend — signers are rows in `firmas` (one per `usuario_id`/`acuerdo_id`). The frontend's `SharedSignerStatus` never exposes `usuario_id` or any identifier, only `role: 'authenticated_party' | 'other_party'`.
- No separate "document" entity exists — `acuerdos.documento_url`/`docusign_envelope_id` are just fields on the same row. `types/agreement.ts` has no `SignatureDocument` type; document readiness/completion lives on `SharedAgreement.estado`/`readyAt`/`completedAt` directly.
- `firmas.docusign_status` is free text mirroring a real provider's vocabulary this app never calls — the frontend deliberately does **not** imitate it. `MockSignatureStatus = 'pendiente' | 'firmado'` is an invented, clearly-documented presentation-only type, not a backend enum.
- Transient UI concepts (generating/preparing/submitting/loading) are **never** persisted enum values — always local `MutationStatus` (`idle|pending|error`) in a hook, regardless of how tempting a richer backend-shaped status union looked in early drafts.
- `Table notificaciones` only logs already-sent deliveries (`canal`, `evento`, `estado: pendiente|enviada|fallida`) — there is **no backend schema at all** for per-category user notification opt-ins. `types/profile.ts`'s `NotificationPreferences` (7 booleans) is entirely frontend-invented presentation state.
- There is **no legal-consent timestamp field** anywhere in `usuarios` (no `consentimiento_at`/terms-acceptance column) and **no support/contact-preference schema** either — the profile/legal/help screens never claim to persist either concept against a real backend.
- `usuarios.estudio_id` exists but is irrelevant to the `parte` persona this app has used since phase 1 — `MockProfile` omits it entirely rather than inventing an estudio membership.

## Mocked profile/session/account behavior (phase 6)

`services/profile.service.ts` holds three pieces of in-memory state, all cleared on app restart: `mockProfile`, `mockNotificationPreferences`, and a bare `mockSessionActive` boolean.

- **`mockSessionActive`** is the smallest possible mock "session" — not a token, not a fake user id, not an auth object. Nothing currently gates on it (there's no real route guard in this phase); `signOutMock()`/`restoreMockSession()` just flip it. It exists purely as a placeholder for a future real session check.
- **Sign-out never clears case/position/negotiation/agreement/signature data or the notification/profile preferences** — only the session flag. Confirmed by reading `signOutMock()`: it touches nothing else.
- **Sign-out navigation** (`app/profile/account.tsx`): `router.dismissAll()` then `router.replace('/signed-out')`, in that order — `dismissAll` first collapses the pushed `(tabs)` → `profile` stack back to the root, so the following `replace` swaps out the root entry itself, leaving `signed-out` as the *only* entry in history (no back-swipe/back-button path into the tabs). `app/signed-out.tsx` also sets `headerShown: false` for good measure. "Volver a la demo" calls `restoreMockSession()` then `router.replace('/(tabs)')`.
- **Account deactivation is idempotent by design**: `requestAccountDeactivationMock()` checks `mockProfile.deactivationRequestedAt` first — if already set, it returns `{status:'already_requested', requestedAt: <original value>}` with **no mutation at all**; only the first call ever writes a timestamp. `usuarios.activo` is **never** flipped by a deactivation request — a request is not a real deactivation, and the UI copy never implies otherwise.

### Frontend-only mock presentation concepts (no backend equivalent — documented in `types/profile.ts`)

- `NotificationPreferences` (7 category booleans) — no backend table for per-category opt-ins exists at all today.
- `CommunicationPreference` (`email_summary | in_app_only`) and `AccessibilityPreference` (`system_default | larger_text_preference`) — both invented UI-only preferences. The accessibility preference is **stored and displayed but not wired to any actual rendering change** — deliberately, to avoid a half-built app-wide font-scaling feature; its copy says explicitly that it's demo-only.
- `deactivationRequestedAt` — a presentation-only marker, not a real backend column.

## Completed phases

1. **Foundation** — design-system tokens/primitives ported from the imported Claude Design System (native RN, not literal web copy), i18n (es-AR/en), Expo Router shell, bottom tabs (Casos/Mensajes/Firmas/Perfil), case dashboard + detail shell, typed mock data.
2. **Case creation & invitation** — 5-step wizard (`app/case/create/*`), `CaseCreationProvider` draft Context, `link|codigo|email` invitation flow, dashboard integration.
3. **Private positions** — `app/case/[id]/positions/*`, category/range/concession form, review→save, edit, delete-with-confirmation, strict own-position isolation in the mock service.
4. **Negotiation** — `app/case/[id]/negotiation/*`, round/proposal lifecycle, AI-assisted (sage) proposal generation, accept/reject with confirmation dialog, deterministic simulated counterparty responses, mediator-availability card from round ≥ 3. Replaced the phase-1 embedded AI demo in `CaseDetailScreen`.
5. **Agreement & mock signatures** — `app/case/[id]/agreement/*`, lazy agreement materialization from an accepted proposal only, `borrador → enviado_a_firma → firmado` transitions, mock signature confirmation flow, Firmas tab now a real grouped inbox (Pendientes / Esperando a la otra parte / Completadas / Con aviso).
6. **Profile, account settings & mocked session** (this phase) — `app/profile/*` + `app/(tabs)/profile.tsx` (real overview, replacing the "Próximamente" placeholder) + `app/signed-out.tsx`. Editable presentation preferences (name, language, communication/accessibility preference), 7-category notification toggles, privacy/help/legal informational screens, simulated sign-out and idempotent account-deactivation request. Perfil is no longer a placeholder — only **Mensajes** still is.

A recurring corrective task between phases 3 and 4 fixed RN-Web-specific runtime issues (nested-button HTML validity, `useNativeDriver` on web, `shadow*` → `boxShadow` deprecation, a focus-release utility for React Navigation's web `aria-hidden` warning) — see that session if similar RN-Web warnings resurface. A second, smaller corrective task after phase 5 fixed a `ScrollView` runtime crash in the Firmas tab (`justifyContent` had been placed in the `ScrollView`'s `style` prop instead of `contentContainerStyle`) — the same style/contentContainerStyle split is checked on every new screen since.

## Demo data — the three seeded cases

Every phase's deterministic behavior is anchored to the same three cases, each demonstrating a different path so nothing requires a permanently-stuck dead end:

- **case-1** — `en_negociacion`, round 2 active. Round 1 seeded rejected. Negotiation counterparty always rejects (rounds 1–2), so playing it through reaches round 3 (mediator card) without waiting forever. If brought to agreement (round 3+, default fallback accepts), the simulated other-party **signs immediately**.
- **case-2** — `en_negociacion`, round 1 has a pre-generated pending proposal. Negotiation counterparty **never responds** (permanent "waiting" demo). If ever brought to agreement, the simulated other-party **never signs** either (permanent "waiting for other party" signature demo).
- **case-3** — `acordado`, round 1 pre-seeded fully resolved (both accepted) **and** its agreement is pre-seeded already `firmado` with both signers complete — the "already-completed, read-only" demo, no interaction needed or possible.

## Routes

```
app/(tabs)/{index,messages,signatures,profile}.tsx     bottom tabs — Casos, Mensajes*, Firmas, Perfil
app/case/create/{_layout,index,method,review,invite,success}.tsx
app/case/[id]/index.tsx                                 case detail (folder form — NOT a flat [id].tsx file)
app/case/[id]/positions/{_layout,index,create,review}.tsx
app/case/[id]/positions/[positionId]/edit.tsx
app/case/[id]/negotiation/{_layout,index,history}.tsx
app/case/[id]/agreement/{_layout,index,sign,history}.tsx
app/profile/{_layout,edit,notifications,privacy,help,legal,account}.tsx
app/signed-out.tsx                                      demo landing after simulated sign-out (outside tabs)
```
`*` Mensajes is still the phase-1 "Próximamente" placeholder — Perfil is now fully built. Only stable IDs (`id`, `positionId`) ever appear in route params — no draft text, decisions, values, or tokens. No profile route needs a dynamic segment at all (single authenticated persona, no per-user routing).

## Validation commands (run every phase)

```
pnpm exec tsc --noEmit
pnpm exec expo lint            # project's own eslint-config-expo, not root biome
npx expo-doctor                # not a project devDependency — always via npx
npx expo export --platform ios --output-dir <tmp>
npx expo export --platform web --output-dir <tmp>
```
If `tsc` reports garbled/duplicated content in `.expo/types/router.d.ts`, that's a stale or corrupted **gitignored** typegen cache (seen after route restructuring, and once after two concurrent export runs raced writing the same file) — `rm -rf mediacion-app/.expo/types` and re-run an export to regenerate it cleanly; never hand-edit it.

This sandbox mounts the repo at a lowercase-`documents` path while the real path is capitalized (`Documents`) — Metro's file-watcher hashing fails ("Failed to get the SHA-1 for...") when commands run from the lowercase path. Always `cd` to the `C:/Users/Usuario/Documents/...` (capital D) form before running `expo export`/`expo start`.

**No interactive device/browser/simulator is available in this environment.** Every phase's "manual runtime verification" has actually been static: `tsc`/lint/doctor/export + reading the wired code paths by hand. Say so explicitly if asked to confirm runtime behavior — don't imply a real device was used.

## Known limitations / honest gaps (carried forward, not fixed)

- `NegotiationEligibility`/`AgreementState`'s `waiting_other_party` / "counterparty not ready" branches are implemented and enforced in both UI and service, but have **no permanently-seeded demo case** — seeding one would create a genuine dead end (no UI flow exists to toggle counterparty readiness), so this is verified by code review only.
- Round-3 mediator availability is reachable (case-1, by playing through 2 rejected rounds) but not pre-seeded at app start.
- Seeded **historical** fixture content (already-completed rounds/proposals/agreements) is Spanish-only, fixed at seed time — only **live-generated** content (via `generateSharedProposal`) respects the current `i18n.language` at generation time. Acceptable, documented nuance, not a bug.
- `mockCases`/`mockCaseDetails` (phase 1) and the negotiation/agreement mock stores are separate parallel structures kept in sync only at the specific mutation points that need it (`markCaseAsAgreed`, agreement materialization) — there's no single source of truth object graph. Fine at this scale; would need real consolidation before backend integration.
- Root `biome.json` technically includes `mediacion-app/` in its glob, but the project's own `expo lint` (eslint-config-expo) is what's actually been used for validation every phase — never verified whether root `biome ci .` also passes over `mediacion-app/` cleanly.
- `con_aviso` (`estado_acuerdo`) is modeled and treated as read-only everywhere it's checked, but no flow in this app ever produces it — it exists only for backend-fidelity and defensive handling.
- The accessibility preference (`system_default | larger_text_preference`) is saved and shown but doesn't change any actual text size yet — see the phase-6 section above.
- `mockSessionActive` has no reader anywhere — it's a deliberate placeholder, not dead code (see phase-6 section above), but a future phase adding a real route guard is the natural place to start actually using it.
- Mensajes is still the one remaining phase-1 placeholder tab.

## Files touched in phase 6

**Created:** `types/profile.ts`, `mocks/profile.ts`, `services/profile.service.ts`, `utils/map-language.ts`, `features/profile/hooks/{useProfile,useNotificationPreferences,useAccountActions}.ts`, `features/profile/components/{ProfileHeaderCard,ProfileMenuItem,PreferenceRow,NotificationPreferenceRow,LanguageSelector,PrivacySummaryCard,DemoEnvironmentNotice,AccountActionCard,SignOutDialog,DeactivationDialog,HelpTopicCard,LegalNoticeCard}.tsx`, `app/profile/{_layout,edit,notifications,privacy,help,legal,account}.tsx`, `app/signed-out.tsx`.
**Modified:** `app/(tabs)/profile.tsx` (placeholder → real overview), `design-system/components/Icon.tsx` (added `help-circle`/`file-text`/`settings` glyphs — a small necessary addition beyond the originally enumerated modify-list, flagged to the user in the phase-6 report), `i18n/locales/{es-AR,en}.json` (new `profile.*` namespace).
**Deleted:** none.

## Recommended next step

The roadmap now calls for finishing the mocked product before any backend integration. Profile/account (phase 6) is done; case → positions → negotiation → agreement/signature (phases 1-5) were already done. Remaining candidates for the next mock phase, roughly in likely order:
1. **Mensajes** — the one still-unbuilt tab; likely a mocked messaging/comment thread per case.
2. A dedicated QA/polish pass across all six phases — actual device/simulator testing (impossible in this sandboxed environment), since every phase so far has only had static verification.
3. The Estudio web panel (`apps/panel`, currently a placeholder) — always explicitly out of scope so far.

Only after the user confirms the mocked product is complete should backend integration begin — starting with the smallest/safest service (`cases`) behind its existing interface, per the pattern every service here was already built for.

Confirm which direction with the user before starting; don't assume.
