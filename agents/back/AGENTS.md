# Backend agent context — Proyecto Mediación API

Operating context for AI agents working on the backend (`apps/api`). Read this before touching backend code. Product context (roles, negotiation flow, RN-01 position isolation) is summarized in `agents/front/AGENTS.md` — the same hard rules apply here, enforced server-side.

Last updated: after acuerdos PR1 (#17) merged to `dev`.

## Stack

- **NestJS 11** (`@nestjs/common`/`core`/`platform-express`) on Node >= 22.
- **Kysely** (`kysely` + `pg` Pool) against **Supabase Postgres**. No ORM, no query builder abstractions beyond Kysely itself. The pool sets `connectionTimeoutMillis: 5000` and `statement_timeout: 10000` (`src/database/kysely.provider.ts`).
- **pnpm monorepo**: `apps/api` (the NestJS service), `packages/db-types` (hand-maintained `Database` type consumed by every Kysely query), `packages/shared` (cross-app types like `HealthStatus`), `mediacion-app` (Expo frontend — read-only for backend agents), `supabase/migrations` (SQL migrations, the schema source of truth alongside `mediacion.dbml`).
- **Tooling**: biome (`pnpm biome ci .` at repo root — lint + format, no eslint/prettier), jest 30 with `@swc/jest` (`pnpm test` inside `apps/api`), `tsc -b` for typechecking (`pnpm typecheck` at root). JWT verification uses `jose` (HS256, Supabase JWT secret).
- **Config** (`src/config/config.ts`): `PORT`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`. All validated at startup by `loadConfig`; missing values throw in non-test env and fall back to placeholders when `NODE_ENV === "test"`.

## Repository boundaries

- Backend write scope: `apps/api`, `packages/db-types`, `packages/shared`, `supabase/migrations`. Coordinate migration changes with the db role (`agents/db/`).
- `mediacion-app/`, `agents/front/`, root config are read-only — inspect freely, never edit.

## Architecture conventions

Feature-first ("screaming") modules under `apps/api/src/`, one directory per domain concept, mirroring `casos/` as the reference implementation. Every module follows the same thin-layer shape:

1. **Controller** — route + `@CurrentUser()` extraction only. No business logic. Routes are resource-shaped (`POST /casos`, `GET /casos/:id`, `POST /casos/:casoId/items`, `PATCH /items/:id`, `POST /casos/unirse`, `POST /casos/:casoId/acuerdo`, `GET /planes`, `POST /suscripciones`).
2. **Service** — orchestration plus input assertion via small `assert*` helper functions that throw `HttpException` with an `{ code, message }` body (e.g. `assertValidCreateInput` in `casos.service.ts`, `assertValidTipo`/`assertValidEmailDestino` in `invitaciones.service.ts`, `assertValidRange` in `items/valor-range.ts`). Error codes are snake_case machine-readable strings: `invalid_input`, `caso_not_found`, `invalid_token`, `forbidden`, `forbidden_role`, `forbidden_estudio`, `caso_not_acordado`, `user_not_provisioned`, `conflict`, `internal_error`.
3. **Repository** — the only layer that touches Kysely. Multi-statement writes run inside `this.kysely.transaction().execute(...)` with explicit `.forUpdate()` row locks built by dedicated exported query builders (`invitaciones/caso-lock-query.ts`, `items/item-lock-query.ts`, `negociacion/propuesta-lock-query.ts`) so the lock shape is unit-testable in isolation.

Cross-cutting pieces, all real and load-bearing:

- **Global guards and filter** (`app.module.ts`): `APP_GUARD` → `AuthGuard` then `RolesGuard`, `APP_FILTER` → `AllExceptionsFilter`. Every route is authenticated by default; opt out per-route with `@Public()` (only `GET /health` today). `AuthGuard` verifies the Bearer token (HS256 via `TOKEN_VERIFIER`/`Hs256TokenVerifier`), then loads the user row — a valid token for a user that has no `usuarios` row yields `401 user_not_provisioned`. `RolesGuard` reads `@Roles(...)` metadata and throws `403 forbidden_role`.
- **Error envelope** (`common/filters/all-exceptions.filter.ts`): every response error is `{ "error": { "code", "message" } }`. `HttpException` bodies carrying `{ code, message }` pass through; anything unknown is logged and mapped to `500 internal_error` without leaking details.
- **pg error mapping** (`common/db/pg-error.ts`): repositories never let raw `pg` errors escape. Every `.execute*()` chains `.catch((error) => { throw toDomainError(error); })`. `toDomainError` maps Postgres `23505` (unique violation) and `P0001` (trigger `RAISE EXCEPTION`) to `ConflictError` (`common/errors/domain-errors.ts`, a 409 `HttpException` with `code: "conflict"` and the raw detail tucked into `cause`, never the response body). Everything else re-throws as-is.
- **Membership gating returns 404, never 403** (`casos/membership.service.ts`): `MembershipService.assertMembership(casoId, callerId)` requires an accepted `caso_partes` row and throws `404 caso_not_found` for non-members — a non-member must not be able to distinguish "case exists but is not mine" from "case does not exist". This is the server-side enforcement of RN-01 and every case-scoped service calls it first (`casos`, `invitaciones`, `items`, `acuerdos`).
- **Column allowlists as single source of truth**: read/update surfaces are declared once as `as const` column arrays or explicit field pickers (`propuestaViewColumns` in `negociacion/negociacion.types.ts`, `planColumns` in `pagos/pagos.types.ts`, `pickUpdatableFields` in `items/update-allowlist.ts`) and guarded by **compile-guard specs** — type-level `AssertNever` checks in `*.spec.ts` files (e.g. `pagos.types.spec.ts`) that fail `tsc` if the allowlist and the derived type ever drift. When adding a column, update the allowlist; the guard, not a reviewer, catches omissions. `items` deliberately never exposes another party's rows: list/read queries filter by `parte_id = callerId` (`items.queries.ts`), and the isolation is proven by `items-isolation.integration.spec.ts` and `app-isolation.integration.spec.ts`.
- **DB-enforced invariants**: business rules that must survive concurrent writers live in the schema, not just in service code — e.g. `acuerdos_caso_unique` (`supabase/migrations/20260723210000_acuerdos_caso_unique.sql`, one acuerdo per caso) and the estado-transition triggers from the initial migration set. Application code relies on `toDomainError` to turn those violations into 409s instead of pre-checking racily.
- **Types derive from the schema**: domain types are `Selectable<Database["tabla"]>` picks (`casos.types.ts`, `items.types.ts`, `acuerdos.types.ts`, ...) — never hand-written parallel shapes. Enum literals come off those types (`MetodoCaso = Caso["metodo"]`) with named constants for compared values (`estadoInvitacionAceptada`, `estadoAcuerdoBorrador`).

## Code style contract

- **No comments.** None of the ~100 source files under `apps/api/src` has one. Intent is carried by declarative names (`assertValidCreateInput`, `buildCasoLockQuery`, `isInvitationExpired`, `pickUpdatableFields`) and small single-purpose files (a TTL check, an email match, a token generator each live alone with their own spec).
- **Explicit logic only** — no clever abstractions, no generic helpers speculatively shared across modules. `common/` holds exactly what is genuinely cross-cutting today (pg-error, domain-errors, the exception filter).
- **Spec-required code only**: nothing lands without a requirement behind it, and nothing lands without tests. Strict TDD — RED (failing spec) → GREEN (minimal implementation). Every `x.ts` has an `x.spec.ts` sibling.
- Named constants over magic values (`invitationTtlMs`, `poolStatementTimeoutMillis`, `defaultPort`).

## Module map

- **`auth/`** — global `AuthGuard` (Bearer → HS256 verify → provision check → `request.user`), `RolesGuard`, `@Public()`/`@Roles()`/`@CurrentUser()` decorators, `TokenVerifier` port with `Hs256TokenVerifier` (jose) implementation, `UsersRepository` (`findAuthById`, `findProfileById` against `usuarios`).
- **`casos/`** — the reference module. `POST /casos` (creates caso + `parte_a` membership row transactionally), `GET /casos` (own cases), `GET /casos/:id` (membership-gated detail). `MembershipService` lives here and is imported by every other case-scoped module.
- **`invitaciones/`** — `POST /casos/:id/invitaciones` (only `parte_a` may invite; token from `randomBytes(32).toString("base64url")`) and `POST /casos/unirse`. `joinCase` is a single transaction: lock the pending invitation `forUpdate`, expire it if `fecha_envio` is older than 7 days (`invitation-ttl.ts`), enforce case-insensitive `email_destino` match for `tipo=email` (`email-match.ts`), lock the caso, reject an existing member or a full case (two accepted partes) as `ConflictError`, insert `parte_b`, mark the invitation accepted, activate the caso if `nuevo`. An expired/used/unknown token is always `404 invalid_token`.
- **`items/`** — private position items, the RN-01 surface. CRUD gated by membership + `parte_id = callerId` on every query; `valor-range.ts` asserts `valor_min <= valor_max`; `update-allowlist.ts` whitelists patchable fields; updates lock the row via `item-lock-query.ts`.
- **`me/`** — `GET /me`, own profile via `UsersRepository.findProfileById`.
- **`negociacion/`** — PR1 repositories (`RondasRepository`, `PropuestasRepository`, `RespuestasRepository`, `propuesta-lock-query.ts`, `ConfiguracionRepository.readIaConfig()`) plus the PR2 AI negotiation engine: `POST /casos/:casoId/propuestas` (`negociacion.controller.ts` → `negociacion.service.ts`). `NegociacionService.generatePropuesta` reads both parties' items server-side (the sole crown-jewel surface, RN-01), validates both parties have submitted positions (`422 both_parties_required`) before resolving/creating the active ronda, guards against a duplicate propuesta for that ronda (`409 propuesta_already_exists`), computes a deterministic meeting point (`meeting-point.ts`, RN-03 — overlap midpoint when ranges intersect, `punto: null` with an `estado: "negociable"` marker for disjoint or non-numeric ranges so raw boundaries are never algebraically recoverable), creates the propuesta `pendiente`, then completes narrative generation out-of-band via the `AI_PROPOSAL_GENERATOR` seam (`ai/ai-proposal-generator.ts` interface, `ai/openrouter-proposal-generator.ts` real implementation with a 30s request timeout; specs inject ad hoc jest mocks, no dedicated fake class), logging (not swallowing) any completion failure. `propuestaViewColumns` defines the sanitized proposal read shape. Accepted residual: the overlap-midpoint punto disclosed for `acordable` categorias is partially invertible in asymmetric-bound cases — inherent to disclosing any compromise number, since the product requires a concrete numeric punto for acordable categorias.
- **`pagos/`** — PR1 foundation: `GET /planes` (catalog through the `planColumns` allowlist) and `POST /suscripciones`. `SuscripcionesService.resolveOwner` decides ownership: no `estudio_id` in the body → personal subscription (`usuario_id = caller`); an `estudio_id` → caller must belong to exactly that estudio (`403 forbidden_estudio` otherwise) and the subscription is owned by the estudio.
- **`acuerdos/`** — PR1 foundation: `POST /casos/:casoId/acuerdo` generates a draft agreement. Membership-gated, requires `estado = "acordado"` (`422 caso_not_acordado`), reads the accepted propuesta + respuestas (`propuesta-read.query.ts`), builds deterministic text content (`agreement-content.ts`), inserts a `borrador` acuerdo. The `acuerdos_caso_unique` constraint makes a second generation a 409. `FirmasRepository` exists for the signature rows (PR2).
- **`common/`** — `db/pg-error.ts` (`toDomainError`), `errors/domain-errors.ts` (`ConflictError`), `filters/all-exceptions.filter.ts` (the error envelope).
- **`config/`** — `loadConfig(process.env)` + `APP_CONFIG` token, fail-fast validation.
- **`database/`** — `KYSELY` token, `kyselyProvider` factory (pg Pool + timeouts), insertable-type guard spec, `DATABASE_URL`-gated connection integration spec.
- **`health/`** — `GET /health`, the only `@Public()` route.

## Current state

Merged to `dev`:

- casos + items (PR #13) and earlier foundations (auth, me, config, database, health).
- invitaciones hardening — isolation, TTL, `email_destino` match (PR #14).
- negociacion PR1 — repositories + IA config read (PR #15).
- pagos PR1 — planes catalog + suscripciones creation (PR #16).
- acuerdos PR1 — draft generation + firmas repository (PR #17).

In review: **estudios PR1**. Pending foundations: **admin**, **notificaciones**.

Pending integrations (PR2+), none of which exist in code yet — do not fake them, do not stub providers without a spec:

- **OpenRouter negotiation engine** — proposal generation exists (PR2, local branch, not yet merged to `dev`); still pending: `responder`/RN-04 round iteration, `GET` listing, and the mediador read gate (PR3), plus the RN-01 crown-jewel integration suite (PR4).
- **MercadoPago webhook** (pagos PR2) — payment confirmation for suscripciones.
- **DocuSign signatures** (acuerdos PR2) — `POST /acuerdos/:id/firmar` creates the envelope and the `firmas` rows (`FirmasRepository` + `docusignStatusPending` are already in place for this).
- **SMTP notification providers** (notificaciones), **SLA semáforo**, **admin metrics**.
- `main.ts` currently calls `NestFactory.create(AppModule)` with no options — `rawBody: true` must be added when the pagos (MercadoPago) and acuerdos (DocuSign) webhooks land, since both need signature verification over the raw request body.

## Testing conventions

- **Repository specs** (`*.repository.spec.ts`): class-level tests with fake Kysely chains — hand-built objects mimicking `selectFrom().where().executeTakeFirst()` etc., asserting both the SQL shape (via exported `build*Query` helpers where they exist) and the error mapping.
- **Service specs**: exercise the real service class with mocked repositories/`MembershipService`, covering every assert/throw branch.
- **Controller specs**: real controller, mocked service; verify delegation and `@CurrentUser()` wiring.
- **Compile-guard specs**: type-level allowlist drift detection (see above); the runtime `expect` is trivial, the value is the `tsc` failure.
- **Integration specs** (`*.integration.spec.ts`): gated with `const describeDb = process.env.DATABASE_URL ? describe : describe.skip;` — they run against a real database only when `DATABASE_URL` is set and are skipped (not failed) otherwise. The isolation specs (`app-isolation`, `items-isolation`, `invitaciones-hardening`, `acuerdos-generation`, `kysely-connection`) are the RN-01 proof layer.
- Current suite: **260 passing, 20 skipped (DB-gated), 53/58 suites** without `DATABASE_URL`; run with `pnpm test` (or `pnpm jest`) inside `apps/api`.

### Known environment gotcha (verified 2026-07-23)

`pnpm-workspace.yaml` on `dev` includes `mediacion-app`, whose expo/react-native chain depends on jest 29. Historically a full workspace install could hoist `jest-environment-node@29.7.0` over the API's jest 30, failing every suite with `TypeError: this._moduleMocker.clearMocksOnScope is not a function`. Fixed on `dev` (PR #18) by declaring `jest-environment-node@^30.4.1` as a direct `apps/api` devDependency, so the API always resolves its own v30 environment. If the symptom reappears (e.g. after dependency churn), check that this devDependency is still present before suspecting code. The same PR temporarily excludes `mediacion-app` from `biome ci .` until the frontend team fixes their lint.
