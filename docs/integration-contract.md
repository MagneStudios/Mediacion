# Frontend ↔ Backend Integration Contract

Audit of `mediacion-app` (React Native / Expo, built against mocks) vs the real NestJS API (`apps/api`) and Supabase schema (`supabase/migrations`), as of `origin/dev` @ `ff4ed0f` (2026-07-24). All `file:line` citations refer to that commit. Note: the local checkout was 30 commits behind `origin/dev` at audit time; `mediacion-app` and most API modules exist only on `origin/dev`.

---

## 0.1 Status re-check — `origin/main` @ `172ce22` (2026-07-30)

Re-verified against the live route table and the deployed stack. Sections 0 and 1–4 are kept as written; this layer corrects them.

**The headline finding of section 0 is no longer true.** It says the dominant risk is that the frontend performs zero network I/O and has no authentication. PR #63 closed that: `mediacion-app` now has a Supabase client, login/signup screens, a session gate, and real API services for cases, positions and profile. Verified on the deployed bundle, which contains the API host and the Kong host and emits `login.html` and `signup.html`.

**Also closed since the 2026-07-29 re-check** — two gaps that section 0 does not list, both still marked BACKEND-MISSING in sections 1–4:

| Gap in sections 1–4 | Now |
|---|---|
| `updateProfile` — no `PATCH /me` (line 107) | `PATCH /me` exists (`me.controller.ts:33`). Allowlist accepts `nombre`, `apellido`, `telefono`, `idioma`; `rol`, `email` and `activo` are deliberately not self-patchable (`profile-allowlist.ts`) |
| `deleteOwnPosition` — no `DELETE /items/:id` (line 133) | `DELETE /items/:id` exists, backed by RLS `items_delete_own` |
| `joinCase` — screen was a no-op placeholder | `POST /casos/unirse` was always there; the frontend is wired as of PR #71 |

**Corrections to section 2**: it states CORS is not enabled in `main.ts`. It is, opt-in via `CORS_ORIGINS` — unset means disabled, so an unconfigured deploy never becomes open. Verified against the deploy: preflight returns 204 with the allowed origin, and a foreign origin receives no CORS headers.

**One caveat on the signature flow.** Section 0 lists it as closed, and the endpoints do exist, but they are **inert until the eight `DOCUSIGN_*` variables are configured**. With them unset the send fails and the acuerdo is compensated back to `borrador`, so the UI must handle a failed send rather than assume success. Per-signer status is still genuinely missing: `firmas.docusign_status` exists in the schema but no endpoint serves it.

**Still genuinely missing** (verified against every controller, not inferred): notification preferences, account deactivation, human-readable `caseCode`, `GET` for invitations, signature inbox, agreement history, notice read-state, and a party-facing activity timeline.

---

## 0. Status re-check — `origin/dev` @ `ced1269` (2026-07-29)

Sections 1–4 below are the original 2026-07-24 audit and are kept verbatim for traceability. Several backend gaps have since been closed. Re-verified against the live route table on `dev`:

**Closed since the audit** (mostly by PR #45, Módulo 4 post-acuerdo):

| Gap in sections 1–4 | Now |
|---|---|
| `getAgreementState` — no `GET` for acuerdos | `GET /casos/:casoId/acuerdo` |
| Signature flow — no sign endpoint | `POST /acuerdos/:id/firmar`, `GET /acuerdos/:id/exportar`, `POST /webhooks/docusign` |
| Mediator request — no controller for `mediaciones` | `POST /casos/:casoId/mediacion`, `PATCH /mediacion/:id` |
| SLA / plazo not reachable | `GET`/`PATCH /casos/:id/plazo`, `PATCH /casos/:id/estado`, `GET /casos/:id/categorias` |
| — (beyond the original contract) | `GET /casos/:casoId/tareas`, `PATCH /tareas/:id`, `POST /tareas/:id/calendario`, `POST /acuerdos/:id/incumplimiento`, `GET /acuerdos/:id/incumplimientos`, `POST /onboarding/biometria`, `POST /onboarding/consentimiento` |

**Still open** — see section 5 for the ordered list. The backend is now close to the PDF contract; the dominant remaining risk is that the frontend performs **zero network I/O**: re-verified on `ced1269`, `mediacion-app` still contains no `fetch`, no `supabase-js`, no `axios` and no `EXPO_PUBLIC_*` config. The whole app runs on in-memory mocks and has no authentication.

---

## 1. Frontend data layer — current state

**The app performs zero network I/O.** There is no `fetch`, no axios, no `supabase-js`, no API base URL, and no `EXPO_PUBLIC_*` env config anywhere in `mediacion-app`. All data flows through an in-memory mock service layer designed as a replaceable boundary:

- Service interfaces + mock impls: `mediacion-app/services/*.service.ts` (cases, positions, negotiation, agreements, mediator, notices, activity, profile). Each file documents that a future `createApi*Service` is intended as a drop-in replacement (e.g. `mediacion-app/services/cases.service.ts:13-19`).
- Fixtures: `mediacion-app/mocks/*.ts`. Shared latency/failure helpers: `mediacion-app/services/mock-utils.ts`.
- Domain types (deliberately schema-aligned, standalone — no import from `packages/db-types`): `mediacion-app/types/*.ts`.
- No auth screens exist. `app/signed-out.tsx` is presentation-only; `profileService.signOutMock()` (`mediacion-app/services/profile.service.ts:22`) fakes sign-out. There is no login, register, or session handling of any kind.

### Screen flow → service surface

| Screen / flow (expo-router) | Hook | Service methods consumed |
|---|---|---|
| `app/(tabs)/index.tsx` (cases dashboard) | `useCases` | `casesService.listCases()` |
| `app/case/create/*` (create + invite wizard) | `useCaseCreationFlow` | `createCase`, `createInvitation`, `getInvitation` |
| `app/case/[id]/index.tsx` (case detail) | `useCaseDetail` | `getCaseDetail`, `simulateInvitationAcceptance` (demo-only) |
| `app/case/[id]/positions/*` | `useOwnPositions`, `usePositionDraft` | `getOwnPositions`, `getOwnPosition`, `createOwnPosition`, `updateOwnPosition`, `deleteOwnPosition` (`services/positions.service.ts:19-23`) |
| `app/case/[id]/negotiation/*` | `useNegotiation`, `useRoundHistory` | `getNegotiationState`, `generateSharedProposal`, `submitOwnProposalResponse`, `startNextRound`, `getRoundHistory` (`services/negotiation.service.ts:41-45`) |
| `app/case/[id]/agreement/*`, `app/(tabs)/signatures.tsx` | `useAgreement`, `useAgreementHistory`, `useSignatureInbox` | `getAgreementState`, `prepareSignatureDocument`, `submitOwnMockSignature`, `getAgreementHistory`, `getSignatureInbox` (`services/agreements.service.ts:30-35`) |
| `app/case/[id]/mediator/*` | `useMediator`, `useMediatorActivity` | `getMediatorState`, `requestMediator`, `getMediatorActivity` (`services/mediator.service.ts:34-36`) |
| `app/(tabs)/messages.tsx`, `app/notices/*` | `useNotices`, `useActivity`, `useUnreadNotices` | `listNotices`, `getUnreadCount`, `markNoticeRead`, `markAllNoticesRead`, `listActivity` (`services/notices.service.ts:17-20`, `services/activity.service.ts:19`) |
| `app/profile/*`, `app/(tabs)/profile.tsx` | `useProfile`, `useNotificationPreferences`, `useAccountActions` | `getProfile`, `updateProfile`, `get/updateNotificationPreferences`, `signOutMock`, `requestAccountDeactivationMock` (`services/profile.service.ts:18-24`) |

---

## 2. Real API surface (`apps/api`)

No global route prefix (`apps/api/src/main.ts:5-9`). Global `AuthGuard` + `RolesGuard` + `AllExceptionsFilter` (`apps/api/src/app.module.ts:44-48`). CORS is **not** enabled in `main.ts` — irrelevant for native RN, but Expo Web / dev tooling will need `app.enableCors()`.

### Auth contract (no /auth routes — Supabase-direct)

- There is **no** `/auth/login`, `/auth/register`, or `/auth/refresh`. The app must use `supabase-js` (`signInWithPassword` / `signUp` / auto-refresh) and send the Supabase **access token** as `Authorization: Bearer <jwt>`.
- The guard verifies the JWT as HS256 with `SUPABASE_JWT_SECRET`, audience `authenticated` (`apps/api/src/auth/hs256-token-verifier.ts:14-20`, `apps/api/src/config/config.ts:59`), then loads the user from `public.usuarios` by `sub` (`apps/api/src/auth/auth.guard.ts:52-72`). Missing row → `401 {code:"user_not_provisioned"}` (`auth.guard.ts:66-70`).
- Provisioning is automatic: DB trigger `on_auth_user_created` inserts into `usuarios` on signup, taking `rol` (default `'parte'`), `nombre`, `apellido` from `raw_user_meta_data` (`supabase/migrations/20260721191658_functions_triggers.sql:78-101`). The app should pass `{ data: { nombre, apellido } }` in `signUp` options.
- Public (no token) routes only: `GET /health` (`health.controller.ts:7-9`), `POST /inversores` (`inversores.controller.ts:13-14`).

### Error envelope (verified)

Every error, without exception, is `{ "error": { "code": string, "message": string } }` via `AllExceptionsFilter` (`apps/api/src/common/filters/all-exceptions.filter.ts:52-58` for HttpException, `:66-71` for unknown → 500 `internal_error`). Known codes: `unauthorized`, `user_not_provisioned`, `forbidden`, `forbidden_role`, `forbidden_estudio`, `not_found`, `caso_not_found`, `item_not_found`, `profile_not_found`, `propuesta_not_found`, `propuesta_already_exists`, `propuesta_not_pendiente`, `propuesta_not_ready`, `accepted_propuesta_not_found`, `acuerdo_already_exists`, `caso_not_acordado`, `both_parties_required`, `invalid_input`, `invalid_token`, `no_updatable_fields`, `conflict`, `internal_error`.

### Route table

| Method & path | Auth / role | Request body | Response shape (source) |
|---|---|---|---|
| `GET /health` | Public | — | `{status:"ok"}` (`health.controller.ts:7-10`) |
| `GET /me` | Bearer | — | `MeProfile`: `id, rol, nombre, apellido, email, telefono, idioma, verif_biometrica, estudio_id, activo` (`auth/authenticated-user.ts:12-24`; 404 `profile_not_found` `me.controller.ts:21-26`) |
| `POST /casos` | Bearer | `{nombre, descripcion?, metodo}` (`casos.types.ts:8-12`) | `CaseCreated`: `{id, estado}` (`casos.types.ts:14`) |
| `GET /casos` | Bearer | — | `CaseSummary[]`: `id, nombre, estado, metodo, created_at` (`casos.types.ts:24-27`) |
| `GET /casos/:id` | Bearer (member) | — | `CaseDetail`: `id, nombre, descripcion, metodo, estado, creador_id, created_at, updated_at` (`casos.types.ts:29-39`) |
| `POST /casos/:id/invitaciones` | Bearer (creator) | `{tipo: "link"\|"codigo"\|"email", email_destino?}` (`invitaciones.types.ts:8-11`) | `{id, tipo, token, estado}` (`invitaciones.types.ts:13-16`) |
| `POST /casos/unirse` | Bearer | `{token}` (`invitaciones.types.ts:18-20`) | `{id, estado}` of the joined caso (`invitaciones.types.ts:22`). Token TTL: 7 days from `fecha_envio` (`invitaciones/invitation-ttl.ts:1`); email invitations enforce caller-email match |
| `POST /casos/:casoId/items` | Bearer (member) | `CreateItemDto`: `{categoria, nombre, descripcion?, valor_min?, valor_max?, puede_ceder?, condiciones_cesion?}` (`items.types.ts:6-14`) | `OwnItem` (all item cols incl. `parte_id`, `privado`, timestamps; `items.types.ts:18-33`) |
| `GET /casos/:casoId/items` | Bearer (owner-scoped) | — | `OwnItem[]` — only the caller's own items (RN-01) |
| `GET /items/:id` | Bearer (owner) | — | `OwnItem` |
| `PATCH /items/:id` | Bearer (owner) | `UpdateItemDto` = `Partial<CreateItemDto>` (`items.types.ts:16`) | `OwnItem` |
| `POST /casos/:casoId/propuestas` | Bearer (parte member) | — (empty) | `PropuestaView`: `{id, caso_id, ronda_id, contenido, fundamentacion, estado, modelo_ia, fecha}` (`negociacion.types.ts:12-25`). Returned **pending**: `contenido.narrative === null` while OpenRouter generation completes async (`negociacion.service.ts:145-160`) |
| `GET /casos/:casoId/propuestas` | Bearer (parte; mediador only from ronda ≥ 3) | — | `PropuestaView[]` (`negociacion.controller.ts:31-38`; mediator gate `negociacion.service.ts:196-200`) |
| `POST /propuestas/:id/responder` | Bearer (parte, not mediador) | `{decision: "acepta"\|"rechaza"}` (`negociacion.types.ts:39-41`) | `PropuestaView`. Rejects with `propuesta_not_ready` until narrative is generated (`propuestas.repository.ts:258-260`). `rechaza` → propuesta `rechazada` + next ronda auto-opened (`propuestas.repository.ts:268-285`); both `acepta` → `aceptada` |
| `POST /casos/:casoId/acuerdo` | Bearer (member) | — | Full `acuerdos` row: `{id, caso_id, contenido, documento_url, docusign_envelope_id, estado, fecha, created_at, updated_at}` (`acuerdos.types.ts:4`, table `20260721191651_tables.sql:231-241`). Requires accepted propuesta; one per caso (`acuerdo_already_exists`) |
| `GET /planes` | Bearer | — | `Plan[]`: `{id, nombre, limite_carpetas, limite_casos, limite_iteraciones_ia, precio, moneda}` (`pagos.types.ts:4-18`). `moneda` (punto #24, 23/08): la moneda del cobro real — hoy siempre `"ARS"`, es lo que viaja a `currency_id` de la preference de MP; el CHECK de `planes.moneda` solo admite `'ARS'` hasta que Producto decida otra cosa |
| `POST /suscripciones` | Bearer | `{plan_id, estudio_id?}` (`pagos.types.ts:20-23`) | `{id, estado}` (`pagos.types.ts:31`) |
| `GET /estudios/:id` | Bearer, rol `estudio`/`admin` | — | `{marca_config}` (`estudios.controller.ts:46-52`) |
| `GET /estudios/:id/casos` | Bearer, rol `estudio`/`admin` | — | `CasosByCarpeta[]` |
| `POST /estudios/:id/carpetas` | Bearer, rol `estudio`/`admin` | `CreateCarpetaDto` | `CarpetaCreated` |
| `PATCH /estudios/:id/marca-config` | Bearer, rol `estudio`/`admin` | branding json | `{marca_config}` |
| `GET /metricas` | Bearer, rol `admin` | — | `MetricasDto` (`metricas.controller.ts:13-18`) |
| `PATCH /config/ia` | Bearer, rol `admin` | `UpdateIaConfigDto` | `IaConfigResult` (`configuracion.controller.ts:13-16`) |
| `GET /auditoria` | Bearer, rol `admin` | query `page?`, `limit?` | `{items, page, limit, total}` (`auditoria/types.ts:6-16`) — **the only paginated endpoint in the API**; all list endpoints for parties return full arrays |
| `POST /inversores` | Public | `CreateInversorDto` | `InversorResult` (`inversores.controller.ts:13-17`) |

---

## 3. Cross-reference: frontend expectation vs real API

Legend: **MATCH** (wire directly, mapping trivial) / **MISMATCH** (exists, shape/path/semantics differ) / **BACKEND-MISSING** (no endpoint) / **FRONTEND-NOT-WIRED** (backend exists, no app code calls it).

### Auth & profile

| Frontend expectation | Verdict | Detail |
|---|---|---|
| Sign-in/out, session (`signOutMock`, `signed-out.tsx`) | FRONTEND-NOT-WIRED | Must add `supabase-js` client + login/register screens + token injection into every API call. No backend work needed (Supabase-direct + `handle_new_user` trigger). |
| `getProfile()` → `MockProfile` (`types/profile.ts:31-40`) | MISMATCH (minor) | `GET /me` returns more (`id, email, telefono, verif_biometrica, estudio_id`) and does **not** return `communicationPreference` / `accessibilityPreference` / `deactivationRequestedAt` — those are frontend-only mock fields (`types/profile.ts:12-17`). Keep them local or add schema. |
| `updateProfile(input)` | BACKEND-MISSING | No `PATCH /me`. RLS allows `usuarios_update_own` (`20260721191704_rls_policie.sql:52`), but the app has no Supabase data client; an API endpoint is the consistent path. |
| Notification preferences (get/update) | BACKEND-MISSING | No table stores per-user opt-ins; `notificaciones` is a delivery log only (frontend already documents this, `types/notice.ts:4-21`). Needs new schema + endpoints, or stays local. |
| `requestAccountDeactivationMock()` | BACKEND-MISSING | No endpoint; `usuarios.activo` exists but nothing toggles it. |

### Casos (list/detail) — semáforo data

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `CaseSummary`: `title, counterpartyName, estado, metodo, roundNumber, slaHours, visualStatus, statusLabelKey` (`types/case.ts:45-55`) | MISMATCH | API `CaseSummary` = `id, nombre, estado, metodo, created_at` only (`casos.types.ts:24-27`). Missing for the client-side semáforo/labels: **`sla_tipo` / `plazo`** (columns exist on `casos`, `20260721191651_tables.sql:125-126`, but are never selected), **`ronda_actual`** (column `:124`, not selected), and **counterparty name** (no `caso_partes`/members endpoint at all). `visualStatus`/`statusLabelKey` are derivable client-side, but only if the API exposes `plazo`/`sla_tipo` + `ronda_actual` + whether a counterparty joined. **Action: extend `CaseSummary`/`CaseDetail` selects or the app cannot render its dashboard.** |
| `CaseDetail.caseCode` (`types/case.ts:57-60`) | BACKEND-MISSING | No human-readable case code column exists (`casos` table has none); app fabricates `CASO-YYYY-NNNN` (`services/cases.service.ts:110`). Either add a column or drop the concept. |
| `getCaseTitle(caseId)` | MATCH | Derivable from `GET /casos/:id` → `nombre`. |
| `simulateInvitationAcceptance` | Remove | Demo-only affordance; replaced by the real join flow. |

### Invitations & join

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `createInvitation({casoId, tipo, emailDestino?})` → `CaseInvitation` (`types/case.ts:62-70`) | MATCH (near) | `POST /casos/:id/invitaciones` returns `{id, tipo, token, estado}` — app type also expects `caseId`, `emailDestino`, `createdAt` (fill client-side). `email_destino` required when `tipo="email"` (`invitaciones.service.ts:30-36`). |
| `getInvitation(caseId)` (re-show link/code) | BACKEND-MISSING | No `GET` for invitations. App must cache the token from the create response, or a read endpoint must be added (RLS `invitaciones_select` exists for direct reads, but app has no Supabase data access). |
| Counterparty join screen (enter code / open link) | FRONTEND-NOT-WIRED | Backend `POST /casos/unirse {token}` is fully built (transactional join, RN-07 activation `nuevo→activo`, email match, 7-day TTL, anti-race lock — `invitaciones.controller.ts:28-38`). **No app screen or deep-link route exists to consume it.** This is the biggest missing frontend flow. |

### Positions / items (RN-01)

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `getOwnPositions` / `getOwnPosition` / `create` / `update` | MATCH (rename) | Maps to `GET /casos/:casoId/items`, `GET /items/:id`, `POST /casos/:casoId/items`, `PATCH /items/:id`. Field mapping: `category→categoria`, `name→nombre`, `valueMin/valueMax→valor_min/valor_max` (nullable on API, non-null strings in app — `types/position.ts:17-30` vs `items.types.ts:8-11`), `canConcede→puede_ceder`, `concessionConditions→condiciones_cesion`, `ownerId→parte_id`. |
| `deleteOwnPosition(caseId, positionId)` | BACKEND-MISSING | **No `DELETE /items/:id` route** (`items.controller.ts` has only POST/GET/GET/PATCH, lines 21-53). RLS `items_delete_own` exists (`20260721191704_rls_policie.sql:168`), so this is an API gap, and the app has a full delete UI (`DeletePositionDialog.tsx`). |

### Negotiation

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `getNegotiationState(caseId)` → rich `NegotiationState` (`types/negotiation.ts:100-110`) | MISMATCH (composition) | No state endpoint. App must compose from `GET /casos/:id` (estado, and — once exposed — `ronda_actual`) + `GET /casos/:casoId/propuestas`. **Gaps**: the API never returns ronda `numero`/`estado` (only `ronda_id` on `PropuestaView`) and never returns the caller's own past response (`respuestas_propuesta` has no read endpoint), so `ownResponse`, `waitingForOtherParty`, `currentRound.number` cannot be derived faithfully today. Recommend a `GET /casos/:casoId/negociacion` snapshot endpoint or extending `PropuestaView` with `ronda_numero` + `own_decision`. |
| `generateSharedProposal` → completed `SharedProposal` | MISMATCH (async) | `POST /casos/:casoId/propuestas` returns a **pending** row (`contenido.narrative === null`); the app must poll `GET /casos/:casoId/propuestas` until narrative is set. Mock returns a finished proposal after fake latency — the hook needs a polling state. Errors: `both_parties_required`, `propuesta_already_exists`, `propuesta_not_ready` (on respond). |
| `SharedProposal` = `{title, summary, terms[], rationale}` (`types/negotiation.ts:66-77`) | MISMATCH (shape) | Real content is `contenido: {meetingPoint: [{categoria, punto, estado:"acordable"\|"negociable"}], narrative}` + top-level `fundamentacion` (`negociacion.types.ts:33-36`, `meeting-point.ts:7-11`). No `title/summary/terms` — the app must re-map its proposal UI onto meetingPoint+narrative, or the API must add a presentational projection. |
| `submitOwnProposalResponse(caseId, proposalId, decision)` | MATCH (near) | `POST /propuestas/:id/responder {decision}`. Decision vocabulary matches (`acepta`/`rechaza`). Returns `PropuestaView`, not `NegotiationState` — app re-fetches. |
| `startNextRound(caseId)` | MISMATCH (semantics) | No endpoint — the backend auto-opens the next ronda inside the `rechaza` transaction (`propuestas.repository.ts:268-285`). Frontend should drop the explicit call and just re-fetch. |
| `getRoundHistory(caseId)` | MISMATCH (composition) | Derivable from `GET /casos/:casoId/propuestas` (estado per propuesta) but lacks ronda `numero`/`completedAt` (see snapshot-endpoint recommendation). |

### Agreements & signatures

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `getAcceptedProposal` → create agreement | MATCH | `POST /casos/:casoId/acuerdo` does this server-side (requires accepted propuesta, `estado_propuesta_aceptada` check). |
| `getAgreementState` / `getAgreement(caseId)` | BACKEND-MISSING | **No `GET` for acuerdos** — only the POST (`acuerdos.controller.ts:13-20`). Signature status polling is impossible today. |
| `prepareSignatureDocument`, `submitOwnMockSignature`, signer status (`firmas`) | BACKEND-MISSING | No document-generation, DocuSign-send, or sign endpoints; no `firmas` read endpoint. `acuerdos.documento_url` / `docusign_envelope_id` / `firmas.docusign_status` exist in schema (`20260721191651_tables.sql:231-250`) but nothing populates or serves them yet. Signature flow must stay mocked or wait for backend. |
| `getSignatureInbox()` (Firmas tab) | BACKEND-MISSING | Needs an "agreements across my cases + my signature status" query; nothing exists. |
| `getAgreementHistory` | BACKEND-MISSING | No event/history endpoint (`auditoria` is admin-only). |

### Mediator, notices, activity

| Frontend expectation | Verdict | Detail |
|---|---|---|
| `requestMediator` / `getMediatorState` (`mediaciones`) | BACKEND-MISSING | Table `mediaciones` exists with SELECT-only RLS (`20260721191704_rls_policie.sql:224`), but there is **no controller** for it. Only mediator-related behavior shipped: mediator read access to propuestas from ronda ≥ 3 (`negociacion.service.ts:196-200`) and mediator item reads via RLS. |
| Notices (read/unread, categories) | BACKEND-MISSING | `notificaciones` is a delivery log with no read-state column; frontend types already flag this (`types/notice.ts:4-21`). Needs new schema + endpoints. |
| Activity timeline | BACKEND-MISSING | Closest table is `auditoria` (admin-only, `@Roles("admin")` `auditoria.controller.ts:13-15`). No party-facing feed. |

### Planes / suscripciones / estudios / admin

| Frontend expectation | Verdict | Detail |
|---|---|---|
| Plans & subscription screens | FRONTEND-NOT-WIRED | `GET /planes` + `POST /suscripciones` are live (seeded catalog in `20260721191707_seed_catalog.sql`); the app has zero plan/paywall UI (only a passing mention in `MediatorSummaryCard.tsx`). |
| Estudio panel (`GET/PATCH /estudios/...`) | FRONTEND-NOT-WIRED (by design) | Role-gated to `estudio`/`admin`; belongs to `apps/panel`, not the party app. |
| Admin (`/metricas`, `/auditoria`, `/config/ia`) | FRONTEND-NOT-WIRED (by design) | Admin-only; not for the party app. |

---

## 4. DB integration state (Supabase direct access)

- **The app never touches Supabase directly today** — no `supabase-js` dependency, no direct table access, nothing bypassing the API. All isolation-sensitive reads (items RN-01) go through API code paths that scope by `parte_id = caller` (`items.controller.ts` → `ItemsService` own-scoped methods).
- When `supabase-js` is added it should be used **for auth only** (session + JWT). If the team later reads tables directly, RLS coverage exists for the party-facing tables (`usuarios`, `casos`, `caso_partes`, `invitaciones`, `items` incl. delete, `rondas`, `propuestas`, `respuestas_propuesta`, `mediaciones` SELECT-only, `acuerdos`, `firmas` — `supabase/migrations/20260721191704_rls_policie.sql:15-250`), but note the API connects with its own `DATABASE_URL` (service role semantics), so RLS is currently exercised by nobody; direct client reads would be its first real consumer and should be validated before use.
- `handle_new_user` trigger provisions `public.usuarios` on signup (`20260721191658_functions_triggers.sql:78-101`) — signup metadata contract: `{rol?, nombre?, apellido?}` (rol defaults to `parte`).

## 5. Remaining work (priority order, re-verified on `ced1269`)

### Blocking — the app cannot talk to the API at all

1. **Frontend — API client + Supabase auth.** Add `supabase-js`, login/register/session screens, token injection on every request, and `user_not_provisioned` handling. The client must honor the `{error:{code,message}}` envelope; only `GET /auditoria` paginates, every other list returns a plain array. Nothing else on this list matters until this exists.
2. **Frontend — replace the mock service layer.** Each `mediacion-app/services/*.service.ts` documents a `createApi*Service` drop-in; implement them against the route table in section 2 plus the endpoints listed in section 0. Field mapping is the bulk of the work (`category→categoria`, `valueMin/valueMax→valor_min/valor_max`, `canConcede→puede_ceder`, `ownerId→parte_id`).
3. **Frontend — build the join flow.** `POST /casos/unirse` is fully implemented server-side but has no screen and no deep-link route. Delete `simulateInvitationAcceptance` when it lands.

### Backend gaps that block specific screens

4. **Extend caso payloads.** `CaseSummary` / `CaseDetail` still select only `id, nombre, estado, metodo, created_at(, descripcion, creador_id, updated_at)` (`apps/api/src/casos/casos.types.ts`). The dashboard needs `sla_tipo`, `plazo`, `ronda_actual` (all existing columns, never selected) and counterparty presence/name from `caso_partes` + `usuarios`. Without this the semáforo and card labels cannot render.
5. **`DELETE /items/:id`.** The delete UI (`DeletePositionDialog.tsx`) and the RLS policy `items_delete_own` both exist; the route does not (`items.controller.ts` has POST/GET/GET/PATCH only).
6. **Negotiation snapshot.** No `GET /casos/:casoId/negociacion`. `PropuestaView` exposes `ronda_id` but never the ronda `numero`/`estado`, and `respuestas_propuesta` has no read endpoint — so `ownResponse`, `waitingForOtherParty` and `currentRound.number` are underivable. Either add the snapshot endpoint or extend `PropuestaView` with `ronda_numero` + `own_decision`.
7. **`GET` for invitations.** No read endpoint, so the app cannot re-show a link/code after creation; it must cache the token from the create response.
8. **`PATCH /me`.** Profile editing has no endpoint (RLS `usuarios_update_own` exists).
9. **Signature inbox.** The Firmas tab needs an "agreements across my cases + my signature status" query; per-acuerdo reads exist now, the cross-case aggregate does not.

### Needs new schema before any endpoint

10. **Notification preferences** — no table stores per-user opt-ins; `notificaciones` is a delivery log only.
11. **Notices read-state** — `notificaciones` has no read/unread column.
12. **Party-facing activity feed** — the closest table is `auditoria`, which is admin-only.
13. **Account deactivation** — `usuarios.activo` exists but nothing toggles it.

### Frontend adaptation (no backend work needed)

14. **Proposal UI shape.** Real content is `contenido: {meetingPoint: [{categoria, punto, estado}], narrative}` + `fundamentacion` — not `{title, summary, terms[], rationale}`. Generation is async: poll `GET /casos/:casoId/propuestas` until `narrative !== null` and handle `propuesta_not_ready`, `propuesta_already_exists`, `both_parties_required`.
15. **Drop `startNextRound`.** The server auto-opens the next ronda inside the `rechaza` transaction; the app should just re-fetch.
16. **`caseCode`.** No human-readable case code column exists; the app fabricates `CASO-YYYY-NNNN`. Either add a column or drop the concept.

### Deployment prerequisite

17. **CORS.** `apps/api/src/main.ts` does not call `app.enableCors()`. Irrelevant for native RN, required for Expo Web.

## 6. `/case/join` UI shell — intentionally unwired

The frontend route `app/case/join.tsx` renders a presentational UI shell (a `JoinCaseForm` component with a token-input field and a submit button). It does **not** call the real `POST /casos/unirse` endpoint. It does **not** navigate to a case detail on success. It does **not** display any fabricated success or failure result.

This is deliberate: the join flow is blocked on the API client + Supabase auth work (items 1–3 in section 5). The UI shell exists as a placeholder so the route is registered and the form structure is ready, but it is **not integrated** with the backend. Any suggestion that the join feature is complete or wired would be inaccurate.
