# Changelog — Proyecto Mediación

## 2026-09-14 — Los 3 pendientes de frontend de la auditoría, cerrados

**Origen:** `docs/pedidos-post-auditoria-14-09.md` §3 ("Frontend — 3 ítems, los tres con un frente disponible ya"), cruzado contra `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` §7/§9 y `docs/AJUSTES-PACTUM-2026-09-10.md` §5.
**Rama:** `feat/frontend-pendientes-14-09` (desde `dev`, con el merge de `main` #136 ya incorporado). Toca solo `mediacion-app/`.
**Plan de implementación:** `docs/plan-frontend-pendientes-14-09.md`.

Los tres ítems que el doc marcaba como "disponibles ahora" — sin esperar a Backend ni DB — quedaron implementados y con mock, con el punto de extensión hacia el backend real documentado en cada uno.

---

### §3.1 — Invitación disponible fuera del estado "nuevo"

Antes, `canInviteCounterparty` no existía: `CaseDetailScreen.tsx` mostraba la tarjeta de invitación únicamente cuando `estado === 'nuevo'`, con la lógica inline (`isAwaitingCounterparty`). Ahora:

- **`canInviteCounterparty(estado)`** en `utils/case-actions.ts`: `true` para `nuevo`, `pendiente_suscripciones`, `activo`, `en_negociacion`, `acordado`; `false` para `expirado`, `terminado`, `cerrado`, `vencido` — mismo criterio que ya usaban `canTerminateCase`/`canSetCaseDeadline`.
- **`InvitationSection.tsx`** (nuevo, `features/cases/components/`): componente autónomo — hace su propio `casesService.getInvitation(caseId)` al montar, en vez de recibir la invitación por props desde `CaseDetailScreen`. Se renderiza tanto en el flujo de `nuevo` como, para el resto de los estados elegibles, como tarjeta en `secondary` de `ResponsiveColumns` (mismo patrón que `CaseDeadlineCard`).
- Cuando no hay invitación pendiente en un estado que no es `nuevo` (ej. `acordado`, ya aceptada), muestra "No hay invitación pendiente para este caso" en vez de repetir el botón "ver invitación" que puede volver a resolver `null` en silencio.
- Botones **"Reenviar"** y **"Regenerar código"** ya están en la UI, siempre visibles pero `disabled` con `disabledReason` ("Disponible próximamente") — siguiendo el patrón de `AgreementExportAction.tsx`. **No se tocó el contrato `CasesService`**: los endpoints reales (`resendInvitation`/`regenerateInvitationCode`) siguen sin existir, eso es trabajo de Backend (§2.6 del doc de pedidos).

**Fix de consistencia del mock, necesario para que lo de arriba no muestre un badge falso:** `getInvitation` del mock (`cases.service.ts`) ya filtraba por `estado === 'pendiente'`, pero `simulateInvitationAcceptance` solo flippeaba el `estado` del *caso*, no el de la invitación guardada en `mockInvitations`. Resultado: un caso `activo`/`acordado` mostraba la invitación como `pendiente` aunque ya se había aceptado. Ahora `simulateInvitationAcceptance` también escribe `estado: 'aceptada'` en la invitación mock en el mismo momento en que avanza el caso — mismo comportamiento que ya tenía `cases.backed-service.ts` contra el backend real.

---

### §3.2 — Ficha de contexto del caso (mock, incremental)

Requisito de `CAMBIOS-PACTUM-v2` §9: ficha por caso, cargable de forma incremental (integrantes, actividades, colegio, cronograma, domicilios, restricciones), con partes privadas y compartidas. No existía nada — ahora:

- **Tipos** (`types/case-context.ts`): `FamilyMember`, `ChildActivity`, `SchoolInfo`, `WeeklyScheduleEntry`, `Address`, `Restriction`, y `CaseContextEntry<T>` (`{ data, visibility, ownerId }`) — la visibilidad se modela **por entrada**, no por sección entera, para que por ejemplo un domicilio pueda ser privado mientras otros son compartidos.
- **Servicio mock** (`services/case-context.service.ts`): `getContext(caseId)` / `saveSection(caseId, sectionId, entries)`, firma genérica por sección — agregar una sección nueva no toca el contrato. Sigue el mismo patrón de `positions.service.ts` (`delay`/`createFailureController` de `mock-utils.ts`).
- **Wizard incremental** bajo `app/case/[id]/context/`: `_layout.tsx` monta `CaseContextDraftProvider` (`features/case-context/hooks/useCaseContextDraft.tsx`), y una pantalla por sección (`integrantes`, `actividades`, `colegio`, `cronograma`, `domicilios`, `restricciones`), cada una con su propio `*SectionFields.tsx` component.
- **Defaults de privacidad por sección**, documentados (no ad-hoc): `integrantes`/`actividades`/`colegio`/`cronograma` = `shared` (necesitan verse para coordinar); `domicilios`/`restricciones` = `private` (información potencialmente sensible — el propio doc del cliente menciona casos de riesgo/seguridad). Editable campo a campo desde el default.
- **Horarios exactos**, no franjas: se agregó `@react-native-community/datetimepicker` para `ScheduleSectionFields` y el campo `fechaNacimiento` de `FamilyMember` — única dependencia nueva de toda la rama, mockeada en los tests vía `test-helpers/mocks/datetimepicker.ts`.
- **`CaseContextCard.tsx`** en el detalle del caso, con indicador "X de 6 secciones completas", visible según `canShowCaseContext(estado) = canInviteCounterparty(estado)` menos `nuevo` (no tiene sentido cargar horarios antes de que el caso tenga contraparte).
- El CRUD real (conectado a DB/Backend, ver §1.1/§2.5 del doc de pedidos) sigue sin existir — esto es 100% mock, con el punto de extensión en `case-context.service.ts`.

**Fix de una race condition encontrada en revisión:** cada pantalla de sección guardaba dos veces — una vez en cada `onChange` (fire-and-forget) y otra vez al confirmar, reenviando un snapshot local que podía haber quedado desactualizado si el guardado de `onChange` todavía no había resuelto. Si el guardado de "confirmar" pisaba al de "onChange" por orden de resolución, la última edición se perdía en silencio. Se agregó `useSectionSaveQueue` (nuevo hook), que serializa todos los guardados de una sección en una cola — "confirmar" ya no reenvía nada, solo espera a que la cola drene.

**Otro fix de la misma revisión:** los 5 `*SectionFields` generaban IDs con `` `${prefijo}-${Date.now()}` `` inline en vez de usar `generateMockContextEntryId()` (el helper que ya existía en `utils/mock-id.ts` sin ningún caller) — sin sufijo random, dos ítems creados en el mismo milisegundo podían colisionar y pisarse en la lista. Ahora los 5 usan el helper.

---

### §3.3 — Aviso de moderación de lenguaje ofensivo

Requisito de `CAMBIOS-PACTUM-v2` §7: detectar antes de mostrar/procesar, avisar para reformular, sin bloquear. Alcance de esta rama: solo `concessionConditions` y `description` en `PositionFormFields.tsx` (los campos de texto libre de una posición, visibles para la contraparte en negociación) — `BreachNoticeForm.tsx` y la descripción de creación de caso quedan para una extensión trivial futura con el mismo hook.

- **`InlineWarning.tsx`** (nuevo, `design-system/components/`): presentacional, `accessibilityRole="alert"`, usa `semanticColors.status.warningBg/warningFg` ya existentes.
- **`useLanguageModeration.ts`** (`features/moderation/hooks/`): debounce + heurística local (`es-profanity-list.ts`, lista corta de términos, matching por palabra completa) — marcada explícitamente como placeholder de baja fidelidad en el propio código, con el punto de extensión documentado para cuando exista `POST /moderacion/analizar` (backend, ver §1.2/§2.3 del doc de pedidos). Nunca bloquea el submit.
- **`useDebouncedValue.ts`** (`hooks/`): hook genérico, único caller hoy es `useLanguageModeration`.
- La detección corre 100% en el cliente; no hay ninguna llamada de red ni registro de trazabilidad — eso es explícitamente Backend/DB (tabla de eventos de moderación, `docs/pedidos-post-auditoria-14-09.md` §1.2).

---

### Fix adicional de la revisión (fuera de los 3 ítems, encontrado al pasar)

**`PrivacyToggle.tsx`** usaba `View` con `onTouchEnd` en vez de `Pressable`/`onPress` para el toggle de privacidad — único lugar de todo el repo con ese patrón, y no respondía a click de mouse (web, o el simulador iOS con mouse). Corregido a `Pressable`/`onPress`, consistente con el resto de la app.

Se dejaron sin tocar, a propósito, dos hallazgos menores de la misma revisión (no bugs, limpieza de forma): duplicación de ~150 líneas de boilerplate entre los 6 `*SectionFields.tsx` (candidato a un wrapper compartido, no implementado para no arriesgar más cambios de los pedidos), y la complejidad del debounce en `useLanguageModeration` para una heurística que en rigor es síncrona.

---

### QA

- `pnpm jest` (mediacion-app) — **160 suites, 1425 tests**, 0 fallas.
- `pnpm lint` (`expo lint`) — 0 errores, 0 warnings.
- `pnpm tsc --noEmit` — limpio salvo el error preexistente de `app/signup/index.tsx` (no relacionado con esta rama).
- Merge de `main` (#136, fix de lint de `apps/api`) incorporado sin conflictos — no toca `mediacion-app/`.

---

### Lo que queda (Backend/DB, no en esta rama)

- Endpoints reales de reenviar/regenerar invitación (`docs/pedidos-post-auditoria-14-09.md` §2.6) — los botones ya están en la UI, deshabilitados.
- CRUD real de ficha de contexto + conexión al prompt del motor de IA (§1.1/§2.5) — hoy es 100% mock.
- Detección real de lenguaje ofensivo + tabla de trazabilidad (§1.2/§2.3) — hoy es heurística local sin registro.
