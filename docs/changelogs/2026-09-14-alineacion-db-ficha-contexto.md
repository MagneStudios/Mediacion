# Changelog — Alineación DB-ficha de contexto (14/09/2026)

**Rama:** `feat/frontend-pendientes-14-09`
**Plan:** `docs/plan-alineacion-db-ficha-contexto-14-09.md`
**Fuentes de verdad:**
- `docs/decisiones-db/2026-09-14-ficha-contexto-caso.md`
- `supabase/migrations/20260914120000_caso_contexto.sql` (mig 46)

## Resumen

Corrección del mock de la ficha de contexto para alinearlo con la decisión real de DB y el schema de la migración. No es una feature nueva: sigue siendo 100% mock (Backend no construyó el CRUD real), pero corrige la premisa para no seguir construyendo sobre un modelo descartado.

## Cambios

### 1. Privacidad: todo privado, sin toggle

- **Eliminado:** `CaseContextVisibility`, campo `visibility` de `CaseContextEntry<T>`, `SECTION_DEFAULT_VISIBILITY`, `PrivacyToggle.tsx`.
- **Agregado:** `PrivacyNotice.tsx` (banner estático informativo, ícono `lock` fijo, sin `Pressable`).
- **Impacto:** los 6 `*SectionFields.tsx` ya no tienen toggle por ítem. Los 6 screens de sección renderizan `PrivacyNotice` una vez debajo del header.
- **i18n:** `privacy.toggle`/`privacy.private`/`privacy.shared` reemplazados por `privacy.notice`. `subtitle` corregido para no sugerir que se comparte.

### 2. Tipos/campos alineados a columnas reales de DB

| Tipo mock | Cambios |
|---|---|
| `FamilyMember` | + `notas?: string` |
| `ChildActivity` | `ninoId` → `integranteId?` (opcional), `nombre` → `actividad`, `diaSemana` → `dia` |
| `SchoolInfo` | + `curso?: string`, + `notas?: string` |
| `WeeklyScheduleEntry` | `horaInicio`/`horaFin` → `franjaHoraria: string`, `diaSemana` → `dia` |
| `Address` | `etiqueta`/`direccion` → `tipo`, `calle`, `numero?`, `localidad?`, `provincia?`, `cp?`, `notas?` |
| `Restriction` | sin cambios |

- **ScheduleSectionFields:** se quitó el `DateTimePicker` (la tabla real usa `franja_horaria TEXT`, no `TIME`). Reemplazado por un `Input` de texto simple.
- **AddressesSectionFields:** restructurado de 2 inputs a 7 inputs.
- **SchoolSectionFields:** + 2 inputs (`curso`, `notas`).
- **IntegrantesSectionFields:** + 1 input (`notas`).
- **ActivitiesSectionFields:** renombrados labels/variables (`ninoId`→`integranteId`, `nombre`→`actividad`, `diaSemana`→`dia`).

### 3. Enums en frontend, TEXT en DB

Decisión consciente: `dia`, `turno`, `tipo` se mantienen como uniones TypeScript en el frontend (selector cerrado de chips, mejor UX). La DB usa `TEXT` sin `CHECK` — cualquier valor del enum es un string válido para la columna. Documentado en el plan de alineación.

## Archivos modificados

- `types/case-context.ts`
- `services/case-context.service.ts`
- `features/case-context/components/PrivacyToggle.tsx` → eliminado
- `features/case-context/components/PrivacyNotice.tsx` → nuevo
- `features/case-context/components/IntegrantesSectionFields.tsx`
- `features/case-context/components/ActivitiesSectionFields.tsx`
- `features/case-context/components/SchoolSectionFields.tsx`
- `features/case-context/components/ScheduleSectionFields.tsx`
- `features/case-context/components/AddressesSectionFields.tsx`
- `features/case-context/components/RestrictionsSectionFields.tsx`
- `app/case/[id]/context/integrantes.tsx`
- `app/case/[id]/context/actividades.tsx`
- `app/case/[id]/context/colegio.tsx`
- `app/case/[id]/context/cronograma.tsx`
- `app/case/[id]/context/domicilios.tsx`
- `app/case/[id]/context/restricciones.tsx`
- `services/__tests__/case-context.service.test.ts`
- `features/case-context/hooks/__tests__/useCaseContextDraft.test.tsx`
- `i18n/locales/es-AR.json`
- `i18n/locales/en.json`
- `docs/plan-frontend-pendientes-14-09.md` (sección Ítem 2 actualizada)

## Verificación

- `pnpm jest`: 160 suites, 1425 tests — todos pasan.
- `pnpm lint`: 0 errores, 0 warnings.
- `pnpm tsc --noEmit`: solo el error pre-existente de `app/signup/index.tsx` (no relacionado).
