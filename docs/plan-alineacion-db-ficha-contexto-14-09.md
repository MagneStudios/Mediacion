# Plan — Alinear ficha de contexto a la decisión real de DB (14/09, follow-up)

## Contexto

El plan original (`docs/plan-frontend-pendientes-14-09.md`, ya implementado, commiteado y mergeado en `feat/frontend-pendientes-14-09`) construyó la "ficha de contexto del caso" como mock, con una hipótesis propia de privacidad: `visibility: 'shared' | 'private'` por entrada, con un `PrivacyToggle` interactivo y defaults donde 4 de 6 secciones eran `shared` por defecto.

Trajimos a la rama la migración real de DB (`supabase/migrations/20260914120000_caso_contexto.sql`, mig 46) y su decisión de producto (`docs/decisiones-db/2026-09-14-ficha-contexto-caso.md`), que dice explícitamente: **"No se modela 'compartido' (todo privado por parte, según instrucción)"** — cada fila de las 6 tablas `contexto_*` es visible solo para su `parte_id`, nunca para la contraparte ni el mediador. Nuestra hipótesis de "shared" no solo no coincide — está descartada por el equipo.

Además, comparando campo a campo contra el schema real, varios tipos mock no calzan con las columnas reales (nombres distintos, campos faltantes, y un caso donde el tipo de dato es directamente distinto — `contexto_cronograma` usa `franja_horaria` TEXT, no un par `hora_inicio`/`hora_fin` TIME como asumimos).

Esta es una corrección, no una feature nueva: sigue siendo 100% mock (Backend no construyó el CRUD real, `§2.5` de `docs/pedidos-post-auditoria-14-09.md` sigue "no implementado"), pero corrige la premisa para no seguir construyendo sobre un modelo que ya se descartó, y para que el día que Backend defina el contrato real, el mock ya hable el mismo idioma que la DB.

**Rama:** `feat/frontend-pendientes-14-09` (misma rama, ya con los merges de `main` #136 y `feat/supabase-db` incorporados). Commit aparte, no se reescribe el commit anterior.

---

## 1 · Quitar el modelo shared/private (todo privado)

- **`mediacion-app/types/case-context.ts`**: eliminar `CaseContextVisibility` y el campo `visibility` de `CaseContextEntry<T>` → queda `{ data: T; ownerId: string }`.
- **`mediacion-app/services/case-context.service.ts`**: eliminar `SECTION_DEFAULT_VISIBILITY` y toda la normalización de `visibility` en `saveSection` (líneas 28-35, 70-71, 75-80); mantener solo el default de `ownerId`.
- **`mediacion-app/features/case-context/components/PrivacyToggle.tsx`**: eliminar el componente interactivo. Reemplazar por un banner estático no interactivo (nuevo, o renombrado a `PrivacyNotice.tsx`), reusando el patrón ya establecido en el repo para "esto es privado, sin opción de elegir":
  - `CaseDetailScreen.tsx` líneas 134-140 / estilos 386-410 (`privacyBanner`: ícono `lock` fijo + texto, sin `Pressable`).
  - `PositionFormFields.tsx` línea 87 (`sectionHint` — hint textual estático).
  - Precedente de tipos: `types/position.ts:28` (`private: true` literal, sin unión).
  - Se renderiza **una vez por pantalla de sección** (en los 6 `app/case/[id]/context/*.tsx`, debajo del header), no por ítem — reduce el ruido de 6 banners repetidos por lista a 1 por pantalla.
- **Los 6 `*SectionFields.tsx`**: quitar el import de `PrivacyToggle`, la función `toggleVisibility`/`onToggle`, el campo `visibility` al crear/editar ítems, y el `<PrivacyToggle ... />` del render de cada fila.
- **i18n** (`es-AR.json` y `en.json`, bloque `caseContext`): reemplazar `privacy.toggle`/`privacy.private`/`privacy.shared` por una sola clave estática, ej. `privacy.notice: "Privado — solo vos ves esta información. La otra parte y el mediador no acceden a ella."`. Corregir también `caseContext.subtitle` (hoy dice "Completá la información para coordinar con la otra parte", lo cual sugiere que se comparte — cambiar a algo como "Cargá información de contexto para tu caso. Es privada.").
- **Tests**: quitar el campo `visibility` de los fixtures en `services/__tests__/case-context.service.test.ts` (5 ocurrencias) y `features/case-context/hooks/__tests__/useCaseContextDraft.test.tsx` (línea 58).

## 2 · Alinear tipos/campos a las columnas reales de `20260914120000_caso_contexto.sql`

| Tipo mock | Tabla real | Cambios |
|---|---|---|
| `FamilyMember` | `contexto_integrantes` | agregar `notas?: string` |
| `ChildActivity` | `contexto_actividades` | `ninoId` → `integranteId` (ahora opcional, la FK real es `ON DELETE SET NULL`); `nombre` → `actividad`; `diaSemana` → `dia`. `horaInicio`/`horaFin` ya coinciden con las columnas `TIME` reales — sin cambios ahí. |
| `SchoolInfo` | `contexto_colegio` | agregar `curso?: string`, `notas?: string` |
| `WeeklyScheduleEntry` | `contexto_cronograma` | **cambio de fondo**: la tabla real no tiene `hora_inicio`/`hora_fin`, tiene `franja_horaria TEXT`. Reemplazar el par `horaInicio`/`horaFin` por `franjaHoraria: string`. Renombrar `diaSemana` → `dia`. |
| `Address` | `contexto_domicilios` | **restructura**: `etiqueta`/`direccion` → `tipo`, `calle`, `numero?`, `localidad?`, `provincia?`, `cp?`, `notas?` |
| `Restriction` | `contexto_restricciones` | sin cambios de campo (`tipo`, `descripcion` ya coinciden) |

**Decisión consciente — enums en frontend, `TEXT` en DB:** `contexto_actividades.dia`, `contexto_cronograma.dia`, `contexto_colegio.turno` y `contexto_restricciones.tipo` son `TEXT` sin `CHECK` en la migración real. **No se baja esto a `string` en el frontend.** Se mantienen como uniones/enum de TypeScript (selector cerrado de chips, mejor UX que un input libre para "día de la semana" o "turno"), igual que ya hace el resto del repo (`apps/api/src/casos/categorias.ts` es enum en TS sobre una columna igual de permisiva). Cualquier valor que emita el enum sigue siendo un string válido para la columna — no hay incompatibilidad, es una capa de validación de UX en el cliente que la DB deliberadamente no fuerza. Esto no es una brecha a cerrar, es un límite de responsabilidad: DB modela almacenamiento, frontend modela UX.

### Impacto en UI por componente

- **`ActivitiesSectionFields.tsx`**: renombrar variables/labels de estado (`ninoId`→`integranteId`, `nombre`→`actividad`, `diaSemana`→`dia`); mantiene el `DateTimePicker` para `horaInicio`/`horaFin` (correcto, coincide con la tabla real).
- **`ScheduleSectionFields.tsx`**: **sacar el `DateTimePicker` de acá** (era una hipótesis nuestra que no coincide con la tabla real) — reemplazar los dos campos de hora por un único campo `franjaHoraria` (Input de texto simple, consistente con `descripcion`; no se justifica un picker/chip-set nuevo para esto ahora). Esto reduce el riesgo documentado de datetimepicker (iOS spinner, mock de jest-expo) a solo 2 componentes en vez de 3.
- **`SchoolSectionFields.tsx`**: agregar dos `Input` nuevos (`curso`, `notas`).
- **`AddressesSectionFields.tsx`**: reemplazar los 2 inputs actuales (`etiqueta`, `direccion`) por 7 (`tipo`, `calle`, `numero`, `localidad`, `provincia`, `cp`, `notas`) — mismo patrón de formulario que ya usan los demás `SectionFields` (`Input` por campo, opcional donde la tabla lo permite).
- **`IntegrantesSectionFields.tsx`**: agregar un `Input` para `notas`. Mantiene el `DateTimePicker` de `fechaNacimiento` (coincide con `fecha_nacimiento DATE`).
- **`RestrictionsSectionFields.tsx`**: sin cambios de campos, solo quitar `PrivacyToggle` (paso 1).

### i18n adicional (además de lo del paso 1)

Agregar en `es-AR.json`/`en.json` bajo `caseContext.*`: `colegio.cursoLabel/cursoPlaceholder`, `colegio.notasLabel/notasPlaceholder`, `cronograma.franjaHorariaLabel/franjaHorariaPlaceholder` (reemplaza `horaInicioLabel`/`horaFinLabel`/`timePlaceholder`), `domicilios.tipoLabel/calleLabel/numeroLabel/localidadLabel/provinciaLabel/cpLabel/notasLabel` (+ placeholders, reemplaza `etiquetaLabel`/`direccionLabel`), `actividades.actividadLabel` (renombra `nombreLabel`), `integrantes.notasLabel/notasPlaceholder`.

## 3 · Documentación

- **`docs/plan-frontend-pendientes-14-09.md`**: corregir la sección "Privacidad" (tabla de defaults shared/private → nota de "todo privado, sin toggle"), los snippets de tipos, y la lista de estructura de archivos (sacar `PrivacyToggle.tsx`, anotar los campos alineados a la migración real).
- **Nuevo changelog** `docs/changelogs/2026-09-14-alineacion-db-ficha-contexto.md`: documenta esta corrección, citando `docs/decisiones-db/2026-09-14-ficha-contexto-caso.md` y la migración `20260914120000_caso_contexto.sql` como fuente de verdad. No se reescribe el changelog anterior (`2026-09-14-pendientes-frontend.md`), que queda como registro histórico de lo que se construyó primero.

## Verificación

1. `pnpm jest` (mediacion-app) — suite completa en verde, incluidos los tests tocados en el paso 1.
2. `pnpm lint` (`expo lint`) — 0 errores/warnings.
3. `pnpm tsc --noEmit` — sin errores nuevos (el único esperado sigue siendo el preexistente de `app/signup/index.tsx`).
4. Confirmar visualmente (o por test) que ninguna pantalla de sección ofrece ya la opción de "compartir" — el banner de privacidad es informativo, no interactivo.
