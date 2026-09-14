# Plan — Frontend: 3 ítems disponibles ahora (post-auditoría 14/09)

## Paso inmediato de esta sesión

1. Crear la rama `feat/frontend-pendientes-14-09` desde `dev`.
2. Commitear este mismo archivo de plan como `docs/plan-frontend-pendientes-14-09.md` en esa rama — punto de partida documentado antes de tocar código.
3. La implementación de los 3 ítems (detallada abajo) queda para una sesión/turno posterior, no se hace todavía.

## Contexto

`docs/pedidos-post-auditoria-14-09.md` §3 identificó 3 ítems que Frontend puede empezar **ya**, sin esperar a Backend ni DB:

1. Desbloquear la invitación al caso fuera del estado `nuevo` (parcial → cerrar del lado FE).
2. Formulario incremental de "ficha de contexto del caso" (mock, sin backend real).
3. Aviso visual de moderación de lenguaje ofensivo (mock, sin backend real).

Los tres derivan de `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` (§7, §9) y `docs/AJUSTES-PACTUM-2026-09-10.md` (§5). El objetivo de esta rama es cerrar la porción de FE de cada uno y dejar puntos de extensión explícitos y documentados para cuando Backend/DB expongan lo que falta (endpoints de reenviar/regenerar invitación, CRUD real de ficha de contexto, detección real de lenguaje ofensivo).

**Rama base:** `dev` (al día con `main`). **Rama nueva:** `feat/frontend-pendientes-14-09`.

**Orden de implementación dentro de la rama:** Ítem 3 → Ítem 1 → Ítem 2 (de menor a mayor superficie; cada uno es revisable por separado aunque compartan una sola rama/PR).

## Refinaciones post-revisión (14/09)

Cierre de revisión sobre este plan: aprobable y ejecutable, con 6 ajustes concretos que resuelven ambigüedades que el plan original había dejado abiertas a propósito. Ya están incorporados en las secciones de cada ítem más abajo; se listan acá como changelog de la revisión:

1. **Ítem 1 (crítico) — fix de consistencia del mock es doble, no uno solo.** No alcanza con que `getInvitation` filtre `estado === 'pendiente'`; `simulateInvitationAcceptance` (`cases.service.ts:289`) también tiene que flippear `mockInvitations[caseId].estado` a `'aceptada'` en el mismo momento en que flippea el estado del caso. Si solo se toca uno de los dos, un caso `activo`/`acordado` va a mostrar un badge de invitación `pendiente` falso — la línea exacta se confirma al implementar, el diagnóstico ya está validado contra el comportamiento real de `cases.backed-service.ts`.
2. **Ítem 1 — `InvitationSection` autónomo.** El componente posee su propio `invitation`/`invitationStatus` y llama `casesService.getInvitation` él mismo, en vez de recibirlos por props. Se elimina ese estado de `CaseDetailScreen.tsx` (hoy en líneas ~42-43 y ~69-78). Necesario porque el componente ahora se renderiza en dos lugares (flujo `nuevo` y card en `secondary`) — que se autogestione evita duplicar el fetch en los dos call sites.
3. **Ítem 1 — `canInviteCounterparty` incluye `acordado` tal como está definido.** Confirmado sin cambios: tras el fix #1, un caso `acordado` va a mostrar "No hay invitación pendiente para este caso" (la invitación ya fue aceptada), que es el comportamiento correcto.
4. **Ítem 2 — `canShowCaseContext(estado) = canInviteCounterparty(estado)` menos `nuevo`, explícito.** Reemplaza la ambigüedad "probablemente no en `nuevo`, a confirmar" del borrador original — queda como una sola fuente de verdad derivada (misma noción de "el caso ya tiene contraparte enganchada"), no una condición paralela.
5. **Ítem 2 — defaults de `visibility` documentados por sección** — **SUPERADO el 14/09 por la decisión real de DB** (`docs/decisiones-db/2026-09-14-ficha-contexto-caso.md`, ver `docs/plan-alineacion-db-ficha-contexto-14-09.md`): no existe "compartido", todo es privado por parte. Se dejó el punto original acá solo como registro histórico de la hipótesis previa; el modelo vigente es el de la sección "Privacidad" más abajo, sin campo `visibility`.
6. **Ítem 3 — corrección de ubicación.** `ProposalOutcomeNotice.tsx` vive en `features/negotiation/components/`, no en `design-system/` — es solo la referencia de forma a imitar. `InlineWarning.tsx` sí se crea nuevo en `design-system/components/`, con `accessibilityRole="alert"`.

No se toca el contrato `CasesService` en esta rama (confirmado). Orden 3→1→2, todo en `feat/frontend-pendientes-14-09`, una sola PR.

## Riesgos — `@react-native-community/datetimepicker`

- **Validar versión compatible con Expo SDK 54 / RN 0.81.5** antes de `expo install` — revisar la matriz de compatibilidad en docs.expo.dev/versions/v54.0.0 (`AGENTS.md` lo pide explícitamente). Un mismatch de versión rompe el build nativo, a veces sin error claro en JS.
- **iOS renderiza el picker como spinner inline** (no se autocierra) — necesita un patrón explícito de Confirmar/Descartar envolviéndolo en un sheet/modal. **Android usa diálogo nativo** que se cierra solo al confirmar. Los dos componentes que usan fecha/hora (`ActivitiesSectionFields.tsx` — `horaInicio`/`horaFin`, coincide con columnas `TIME` reales —, y el campo `fechaNacimiento` de `FamilyMember` en `IntegrantesSectionFields.tsx`) necesitan manejar ambos comportamientos por plataforma. **Actualizado el 14/09:** el picker se sacó de `ScheduleSectionFields.tsx` — la tabla real `contexto_cronograma` usa `franja_horaria TEXT`, no columnas de hora, ver `docs/plan-alineacion-db-ficha-contexto-14-09.md`.
- **`jest-expo` va a requerir mockear el módulo nativo** en los tests de `ActivitiesSectionFields`/`IntegrantesSectionFields` — sin el mock, esos tests fallan o cuelgan al intentar montar el picker real.

---

## Ítem 3 — Aviso de moderación de lenguaje

**Alcance confirmado:** solo `PositionFormFields.tsx` (`concessionConditions` y `description`). `BreachNoticeForm.tsx` y `case/create/index.tsx` quedan para una extensión futura trivial (mismo hook, mismo componente).

**Decisión:** heurística mínima en cliente (lista corta de términos, matching por palabra completa), marcada explícitamente como placeholder de baja fidelidad — no un `disabled` estático, porque el requisito es demostrar el flujo completo tipear → advertir → reformular. Nunca bloquea el submit.

### Archivos nuevos
- `mediacion-app/types/moderation.ts` — `ModerationSeverity`, `ModerationFinding`, `ModerationResult`.
- `mediacion-app/hooks/use-debounced-value.ts` — `useDebouncedValue<T>(value, delayMs)`.
- `mediacion-app/features/moderation/heuristics/es-profanity-list.ts` — lista + `matchProfanity(text)`.
- `mediacion-app/features/moderation/hooks/useLanguageModeration.ts` — debounce (300–500ms) + heurística local; expone `{ result, status: 'idle' | 'checking' }`. Comentario explícito: reemplazar el cuerpo de `runCheck` por `moderationService.analyze(text)` cuando exista el endpoint, sin tocar la firma.
- `mediacion-app/design-system/components/InlineWarning.tsx` — presentacional, va en `design-system/components/` (no en `features/negotiation/`); modelado en su forma sobre `features/negotiation/components/ProposalOutcomeNotice.tsx` (que es solo la referencia a imitar, no se mueve), usa `semanticColors.status.warningBg/warningFg` ya existentes, `accessibilityRole="alert"`, nunca color solo. Exportar desde el barrel de `design-system`.
- Tests: `InlineWarning.test.tsx`, `use-debounced-value.test.ts` (fake timers), `useLanguageModeration.test.ts`.

### Integración
En `mediacion-app/features/positions/components/PositionFormFields.tsx`, junto a `concessionConditions` (líneas ~177-187) y `description` (líneas ~116-124): `useLanguageModeration(valor)`, y si `result.flagged`, `InlineWarning` debajo del input con copy tipo "Este texto podría no ser adecuado para compartir con la otra parte. Te sugerimos reformularlo."

Nuevo `describe('moderación de lenguaje: aviso en concessionConditions/description', ...)` en el test del formulario, verificando que un término de la lista dispara el aviso tras el debounce y texto limpio no lo hace.

---

## Ítem 1 — Desbloquear invitación fuera de "nuevo"

**Criterio confirmado de `canInviteCounterparty(estado)`:** `true` para `nuevo`, `pendiente_suscripciones`, `activo`, `en_negociacion`, **`acordado`**; `false` para `expirado`, `terminado`, `cerrado`, `vencido`.

### Cambios
- `mediacion-app/utils/case-actions.ts` — nueva función `canInviteCounterparty`, mismo estilo que `canTerminateCase`/`canSetCaseDeadline`. Test en `mediacion-app/utils/__tests__/case-actions.test.ts` cubriendo todos los `EstadoCaso`.
- `mediacion-app/features/cases/CaseDetailScreen.tsx`:
  - El copy de "espera inicial" (`awaitingCounterparty.title/description`, líneas ~221-231) sigue condicionado estrictamente a `estado === 'nuevo'`, sin cambios.
  - La tarjeta de invitación (ver/copiar/compartir + badge de estado) se extrae a un componente nuevo `InvitationSection.tsx` y pasa a condicionarse a `canInviteCounterparty(detail.estado)`. Se renderiza dentro del flujo de `nuevo` (reemplazando el bloque actual) y, para el resto de los estados elegibles, como ítem más de `secondary` en `ResponsiveColumns` (mismo patrón que `CaseDeadlineCard`/`MediatorSummaryCard`).
  - La sección de "simular aceptación" (mock, `isBackendLive`) sigue condicionada solo a `estado === 'nuevo'`, sin cambios.
- `mediacion-app/features/cases/components/InvitationSection.tsx` (nuevo): **autónomo** — posee su propio estado `invitation`/`invitationStatus` y llama `casesService.getInvitation(caseId)` él mismo (no recibe la invitación por props). Ese estado se elimina de `CaseDetailScreen.tsx` (hoy en líneas ~42-43 y ~69-78); el padre solo le pasa `caseId` y `detail.estado`. Encapsula badge + `InvitationResultCard` + manejo de `invitation === null`:
  - `estado === 'nuevo'` y `null` → comportamiento actual (botón "ver invitación").
  - `estado !== 'nuevo'` y `null` → mensaje "No hay una invitación pendiente para este caso" (sin botón repetible que puede volver a resolver `null` en silencio) — éste es el estado esperado para `acordado` una vez aplicado el fix del mock de abajo.
  - Botones **"Reenviar"** y **"Regenerar código"** siempre visibles pero `disabled` con `disabledReason` fijo ("Disponible próximamente"), siguiendo el patrón exacto de `AgreementExportAction.tsx` (`disabled?`/`disabledReason?` decididos por el padre). **No se toca el contrato `CasesService`** en esta rama — nada de `resendInvitation`/`regenerateInvitationCode` todavía; solo el punto de extensión documentado en el componente.
- **Fix crítico, doble, en `cases.service.ts`:** hoy `simulateInvitationAcceptance` (línea ~289) flippea `estado` del *caso* pero no queda claro que también flippee `mockInvitations[caseId].estado` a `'aceptada'`. Los dos tienen que pasar juntos: (a) `getInvitation` del mock filtra por `estado === 'pendiente'` — igual que `cases.backed-service.ts` — y (b) `simulateInvitationAcceptance` escribe `'aceptada'` en la invitación mock en el mismo momento que avanza el caso. Sin el punto (b), un caso `activo`/`acordado` muestra un badge de invitación `pendiente` falso, porque `getInvitation` nunca deja de encontrarla en ese estado. Confirmar la línea exacta al implementar.

### Tests
En `CaseDetailScreen.test.tsx`, nuevo `describe`: caso `activo` con invitación aún `pendiente` → tarjeta visible en `secondary`; caso `acordado` (invitación ya `aceptada` tras el fix del mock) → mensaje "No hay invitación pendiente", no un badge `pendiente` falso; `expirado`/`terminado`/`cerrado`/`vencido` → invitación no se muestra (regresión); `nuevo` → sin cambios (regresión de tests existentes). `InvitationSection.test.tsx` (mockeando `casesService.getInvitation` directamente, ya que el componente ahora lo llama él mismo): botones reenviar/regenerar `disabled` con `disabledReason` visible como texto; verificar el fetch propio al montar.

---

## Ítem 2 — Ficha de contexto del caso (mock, incremental)

**Confirmado:** ruta nueva tipo wizard bajo `/case/[id]/context/`, consistente con los wizards existentes (`app/case/create/`, posiciones). **Confirmado:** horarios exactos (no franjas) para actividades — se agrega `@react-native-community/datetimepicker` (compatible con Expo vía `expo install`) para `ActivitiesSectionFields.tsx` (`horaInicio`/`horaFin`) y `FamilyMember.fechaNacimiento`. Es la única dependencia nueva de todo el plan — ver riesgos de esta librería en la sección al principio del documento (versión vs. Expo SDK 54, spinner iOS vs. diálogo Android, mock en jest-expo) antes de instalarla. **Actualizado el 14/09:** el cronograma semanal (`ScheduleSectionFields.tsx`) **no** usa el picker — la tabla real `contexto_cronograma` modela un único campo `franja_horaria TEXT`, no un par de horas exactas; ver `docs/plan-alineacion-db-ficha-contexto-14-09.md`.

**Visibilidad:** ¿qué se muestra en la card condicional del detalle de caso? — `canShowCaseContext(estado) = canInviteCounterparty(estado)` **menos** `'nuevo'` (ver `utils/case-actions.ts`). Es decir: `pendiente_suscripciones`, `activo`, `en_negociacion`, `acordado`; nunca en `nuevo` (no tiene sentido cargar horarios de los chicos antes de que el caso tenga contraparte) ni en los estados terminales que ya excluye `canInviteCounterparty`.

**Persistencia:** el `Context`/`Provider` (`useCaseContextDraft`) maneja el estado de edición en curso; cada sección se autoguarda en `case-context.service.ts` al confirmar el paso (no solo al final), igual que el patrón mock de posiciones — sobrevive a salir/entrar del flujo dentro de la misma sesión de la app (no hay storage persistente en disco en todo el repo hoy; consistente con eso).

**Privacidad:** todo privado por parte, sin toggle ni opción de compartir. Alineado con la decisión de DB (`docs/decisiones-db/2026-09-14-ficha-contexto-caso.md`): cada fila es visible solo para su `parte_id`, nunca para la contraparte ni el mediador. El modelo `CaseContextEntry<T>` ya no tiene campo `visibility` — queda `{ data: T; ownerId: string }`. Se reemplazó el `PrivacyToggle` interactivo por un `PrivacyNotice` estático (banner informativo, ícono `lock` fijo, sin `Pressable`), reusando el patrón de `CaseDetailScreen.tsx` (`privacyBanner`) y `PositionFormFields.tsx` (`sectionHint`). Se renderiza una vez por pantalla de sección (debajo del header), no por ítem.

### Tipos nuevos (`mediacion-app/types/case-context.ts`)
```ts
export type FamilyMember = {
  id: string; nombre: string; parentesco: string; fechaNacimiento?: string; notas?: string;
};
export type ChildActivity = {
  id: string; integranteId?: string; actividad: string;
  dia: 'lunes'|'martes'|'miercoles'|'jueves'|'viernes'|'sabado'|'domingo';
  horaInicio: string; horaFin: string; lugar?: string;
};
export type SchoolInfo = {
  nombre: string; direccion?: string; curso?: string; notas?: string; turno: 'manana'|'tarde'|'doble';
};
export type WeeklyScheduleEntry = {
  id: string; dia: ChildActivity['dia']; franjaHoraria: string; descripcion: string;
};
export type Address = {
  id: string; tipo: string; calle: string; numero?: string; localidad?: string;
  provincia?: string; cp?: string; notas?: string;
};
export type Restriction = { id: string; tipo: 'viajes'|'trabajo_por_turnos'|'distancia'|'otro'; descripcion: string };

export type CaseContextSectionId =
  'integrantes'|'actividades'|'colegio'|'cronograma'|'domicilios'|'restricciones';

export type CaseContextEntry<T> = { data: T; ownerId: string };

export type CaseContext = {
  caseId: string;
  integrantes: CaseContextEntry<FamilyMember>[];
  actividades: CaseContextEntry<ChildActivity>[];
  colegio: CaseContextEntry<SchoolInfo> | null;
  cronograma: CaseContextEntry<WeeklyScheduleEntry>[];
  domicilios: CaseContextEntry<Address>[];
  restricciones: CaseContextEntry<Restriction>[];
  completedSections: CaseContextSectionId[];
};
```

### Estructura de archivos
```
mediacion-app/types/case-context.ts
mediacion-app/services/case-context.service.ts        (contrato + createMockCaseContextService, patrón positions.service.ts)
mediacion-app/mocks/case-context.ts                    (datos mock por caseId, análogo a mocks/cases.ts)
mediacion-app/features/case-context/hooks/useCaseContextDraft.tsx
mediacion-app/features/case-context/components/CaseContextProgress.tsx
mediacion-app/features/case-context/components/DynamicList.tsx        (agregar/editar/eliminar ítems repetibles, genérico)
mediacion-app/features/case-context/components/PrivacyNotice.tsx      (banner estático informativo, sin toggle)
mediacion-app/features/case-context/components/{Integrantes,Activities,School,Schedule,Addresses,Restrictions}SectionFields.tsx
mediacion-app/app/case/[id]/context/_layout.tsx        (monta el Provider, análogo a app/case/create/_layout.tsx)
mediacion-app/app/case/[id]/context/index.tsx           (resumen: secciones completas/faltantes)
mediacion-app/app/case/[id]/context/{integrantes,actividades,colegio,cronograma,domicilios,restricciones}.tsx
```

`CaseContextService`:
```ts
export type CaseContextService = {
  getContext(caseId: string): Promise<CaseContext>;
  saveSection<K extends CaseContextSectionId>(caseId: string, sectionId: K, entries: CaseContext[K]): Promise<CaseContext>;
};
```
Firma genérica por sección (no un método por sección), para que agregar una sección nueva no toque el contrato. Mock con `delay`/`createFailureController` de `mock-utils.ts`, mismo patrón que `positions.service.ts`.

### Acceso desde `CaseDetailScreen`
Nueva tarjeta condicional en `secondary` de `ResponsiveColumns` ("Ficha de contexto del caso", progreso `X de 6 secciones`), visible según `canShowCaseContext(detail.estado)` (ver definición arriba).

### Tests
`case-context.service.test.ts` (CRUD mock, aislamiento por `caseId`), `useCaseContextDraft.test.tsx` (merge parcial, reset), `DynamicList.test.tsx` (agregar/editar/eliminar), un test de integración liviano por pantalla de sección (guardar → `completedSections` se actualiza → navega al índice), y test de la nueva tarjeta condicional en `CaseDetailScreen.test.tsx`.

---

## Verificación end-to-end

1. `pnpm --filter mediacion-app typecheck` y `pnpm --filter mediacion-app test` (o los scripts equivalentes del repo) en verde, incluyendo los tests nuevos listados arriba.
2. `pnpm --filter mediacion-app lint` sin warnings nuevos.
3. Correr la app (Expo) y probar manualmente los 3 flujos:
   - Posición con `concessionConditions` que contenga un término de la lista heurística → aparece `InlineWarning`, no bloquea el submit.
   - Caso `activo`/`en_negociacion` con invitación aún `pendiente` → tarjeta de invitación visible en el detalle con botones reenviar/regenerar deshabilitados y `disabledReason` visible; caso `acordado` (invitación ya `aceptada`) → mensaje "No hay invitación pendiente", no un badge falso; caso `expirado`/`terminado`/`cerrado`/`vencido` → invitación no aparece.
   - Entrar a "Ficha de contexto del caso" desde el detalle, completar una sección (ej. integrantes), salir y volver → los datos siguen ahí (persistidos en el mock); el indicador de progreso refleja la sección completada.
4. Confirmar que no se rompió ningún test existente de `CaseDetailScreen.test.tsx`, `InvitationResultCard.test.tsx` ni `PositionFormFields`-relacionados (regresión).

---

## Fuera de alcance de esta rama (documentado, no implementado)

- Endpoints reales de reenviar/regenerar invitación (Backend — `docs/pedidos-post-auditoria-14-09.md` §2.6).
- CRUD real de ficha de contexto + conexión al prompt del motor de IA (DB + Backend — §1.1/§2.5).
- Detección real de lenguaje ofensivo + tabla de trazabilidad (DB + Backend — §1.2/§2.3).
- Moderación en `BreachNoticeForm.tsx` y `case/create/index.tsx` (extensión trivial futura con el mismo hook).
