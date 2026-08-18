# Audit Report: Mediación — DB Requirement Coverage

**Date:** 2026-08-18 (updated 2026-08-18 — post-dev merge)
**Scope:** 30 tables, 33 migrations, 20 enums, 52+ RLS policies, 24+ triggers, 13+ functions
**Auditor:** Software Architect + Database Architect Senior (opencode)

---

## Resumen Ejecutivo

| Clasificación | Cantidad | Nota |
|---------------|----------|------|
| ✅ Confirmado | 30 | +6 nuevos (C-25 a C-30: tablas legales, fixes críticos, módulo BE) |
| ⚠ Ambiguo | 4 | 1 resuelto (A-2), 2 parcialmente resueltos (A-1 mejoró, A-4 mejoró), 1 sin resolver (A-3) |
| ❌ No especificado | 5 | -1 (N-2/N-6 parcialmente documentados en changelogs) |
| 🚫 Fuera del alcance | 6 | — |
| Riesgos técnicos | 6 | R-2 mejoró (patrón documentado en 3 tablas), R-4 parcialmente documentado |
| Preguntas PM | 5 | -1 (Q-1 resuelta); Q-4 mejoró (patrón service-role documentado) |
| Bloqueadores nuevos | 2 | Seeds [COMPLETAR] (R-6/P-1); Canal contacto sin respuesta (Q-8/P-5). `GET /suscripciones/vigente` ya implementado (Q-7). |

**Conclusión:** No hay bloqueadores de DB para el despliegue. Los 2 bloqueadores restantes son de operaciones/producto (seeds TyC con 42 placeholders, canal contacto sin respuesta). El fix crítico de `has_accepted_current` (cerraba la contratación al programar una nueva versión) ya está implementado. 6 fixes de seguridad/funcionalidad mergeados desde `dev` — todos aplicados.

---

## ✅ CONFIRMADO (Requisito completamente implementado con evidencia)

| # | Requisito | Evidencia | Ubicación |
|---|-----------|-----------|-----------|
| C-1 | Schema de 30 tablas | `smoke_migrations.py` pasa los 72 checks (actualizado a 30 tablas) | `scripts/smoke_migrations.py` |
| C-2 | R-04 Casos: `codigo`, `fecha_programada_audiencia`, `audiencia_enlace`, `audiencia_mapa`, `audiencia_lat`, `audiencia_lng` | Presentes en migración `20260730180000` | `supabase/migrations/20260730180000` |
| C-3 | R-05 Usuarios: `consentimiento_*`, `numero_matricula`, `matricula_url`, `fecha_baja`, `depuracion_programada_at`, `preferencias_notificacion` | Presentes en `20260730180000` | `supabase/migrations/20260730180000` |
| C-4 | R-06 Invitaciones: `pago_a_cargo` | Presente en `20260730180000` | `supabase/migrations/20260730180000` |
| C-5 | R-07 Tareas: unique constraint `caso_id` + `responsable_id` | `UNIQUE(caso_id, responsable_id)` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-6 | R-08 Incumplimientos: unique constraint `tarea_id` + `creado_por` | `UNIQUE(tarea_id, creado_por)` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-7 | R-09 Mediaciones: unique constraint `caso_id` + `rol` | `UNIQUE(caso_id, rol)` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-8 | R-10 Notificaciones: `canal` column | `canal TEXT DEFAULT 'app'` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-9 | R-11 Notificaciones: `leido_en` column | `leido_en TIMESTAMPTZ` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-10 | R-12 Notificaciones: unique constraint `id_notificacion` + `usuario_id` | `UNIQUE(id_notificacion, usuario_id)` en `20260730180000` | `supabase/migrations/20260730180000` |
| C-11 | TyC: tabla `legal_documents` | Presente en migración `20260806180000` | `supabase/migrations/20260806180000` |
| C-12 | TyC: tabla `user_agreements` | Presente en migración `20260806180000` | `supabase/migrations/20260806180000` |
| C-13 | TyC: tabla `solicitudes_arrepentimiento` | Presente en migración `20260806180000` | `supabase/migrations/20260806180000` |
| C-14 | TyC: función `has_accepted_current()` | Presente en `20260806180000` | `supabase/migrations/20260806180000` |
| C-15 | TyC: trigger append-only `append_only_legal_documents` | Presente en `20260806180000` | `supabase/migrations/20260806180000` |
| C-16 | TyC: trigger `validate_suscripcion_aceptacion` | Presente en `20260806180000` | `supabase/migrations/20260806180000` |
| C-17 | TyC: trigger `assign_arrepentimiento_codigo` | Presente en `20260806180000` | `supabase/migrations/20260806180000` |
| C-18 | TyC: seeds v1.0 (`TermsAndConditions`, `PrivacyPolicy`) | Seeds presentes en `20260806180000` | `supabase/migrations/20260806180000` |
| C-19 | `notificaciones.estado` = `pendiente,enviada,fallida` | Confirmado en `20260730180000` (estado de lectura via columna `leido_en`) | `supabase/migrations/20260730180000` |
| C-20 | `inversores` RLS: solo admin (política pública eliminada) | `DROP POLICY` + nueva política admin-only en `20260730180000` | `supabase/migrations/20260730180000` |
| C-21 | 16 FK indexes | Todos presentes en `20260811150000` | `supabase/migrations/20260811150000` |
| C-22 | search_path hardening + REVOKE EXECUTE + initplan | Aplicado a todas las funciones security-sensitive | Múltiples migraciones |
| C-23 | `casos.codigo` — API response incluye `plazo`, `sla_tipo`, `ronda_actual`, `semaforo`, `contraparte`, `codigo` | Tipo `CaseSummary` coincide con expectativas del frontend | `mediacion-app/types/` |
| C-24 | Restauración post-revert PR #97 | Decisiones documentadas | `docs/decisiones-db/2026-08-13-decisiones-restauracion-revert.md` |
| C-25 | Tabla `avisos_version_legal` + unique index `(usuario_id, tipo, version)` + RLS sin policies (service-role only) | Presente en `20260815120000` | `supabase/migrations/20260815120000` |
| C-26 | Tabla `solicitudes_contacto` + trigger `assign_contacto_codigo` + secuencia + RLS sin policies (service-role only) | Presente en `20260815120000` | `supabase/migrations/20260815120000` |
| C-27 | Tabla `rate_limit_counters` + PK compuesta `(clave, ventana_inicio)` + RLS sin policies + GRANTs service_role/postgres | Presente en `20260817130000` | `supabase/migrations/20260817130000` |
| C-28 | `has_accepted_current()` — fix crítico: vigencia ahora usa `valid_from <= now AND (valid_to IS NULL OR valid_to > now)` en vez de solo `valid_to IS NULL` (cerraba contratación al programar nueva versión) | Presente en `20260817140000` | `supabase/migrations/20260817140000` |
| C-29 | `validate_suscripcion_aceptacion()` — extendido: cubre suscripciones de estudio + trigger en UPDATE OF usuario_id,estudio_id + ERRCODE 22000→P0001 (500→409) | Presente en `20260817120000` | `supabase/migrations/20260817120000` |
| C-30 | Módulo legal backend completo: controller (10 endpoints), service, repository, types, acceptance-csv, acceptance-pdf, rate-limiter, rate-limit.repository, legal-avisos.scheduler | Presente en `apps/api/src/legal/` | Changelog 2026-08-17 |

---

## ⚠ AMBIGUO (Requisito existe pero tiene aspectos contradictorios o poco claros)

| # | Requisito | Ambigüedad | Evidencia | Estado | Acción PM |
|---|-----------|-----------|-----------|--------|-----------|
| A-1 | `notificaciones` tabla: semántica leído/no leído | La doc técnica sección 6 referencia `estado = leida` como filtro de consulta, pero la implementación usa `leido_en TIMESTAMPTZ` para el estado de lectura y `estado` es solo delivery status. | Doc sección 6 vs `20260730180000` | ⚠ Parcialmente resuelto — PM aprobó convertir `estado` a enum solo `pendiente,enviada,fallida` (changelog 2026-07-28, hallazgo #4.3), confirmando implícitamente que `leido_en IS NOT NULL` es el check canónico de "leído". **Nota:** `has_accepted_current()` también usaba una definición de vigencia incorrecta (`valid_to IS NULL`) — fix en `20260817140000` alinea la función con el resto del sistema. Doc sección 6 sigue pendiente de actualización. | Actualizar doc sección 6 para alinearse con la implementación (`leido_en IS NOT NULL` = leído). |
| A-2 | Tabla `pagos`: campos específicos para R-13 | R-13 en `Cambios_Reunion_Mediacion_07-08-2026.md` dice "Refactorizar pagos a objeto denormalizado" pero la estructura actual de `pagos` no incluye `monto`, `moneda`, `comprobante_url`, `metodo_pago` — estos existen solo en `pagos_stripe`. | `supabase/migrations/20260730180000` vs `R-13` | ✅ **RESUELTO** — Changelog 2026-08-10 línea 191: "R-13 (calendario desde ítems): explícitamente post-MVP en el plan — no se tocó". R-13 está diferido. | No requiere acción. R-13 está diferido post-MVP. |
| A-3 | `items_fijos_por_negociacion.id` tipo BIGINT | Es `BIGINT GENERATED ALWAYS AS IDENTITY` mientras otras tablas similares usan `UUID`. La migración `20260811150000` crea índice sobre él. ¿Es esta asimetría intencional? | `20260811150000` | ⚠ Sin resolver en changelogs | Confirmar: ¿intencional u olvido? |
| A-4 | `solicitudes_arrepentimiento` sin política RLS | La tabla existe en la migración TyC pero no se creó política RLS. Probablemente usa solo service-role, pero no está documentado. | `20260806180000` | ⚠ Parcialmente resuelto — Changelog 2026-08-14 confirma patrón: REVOKE EXECUTE de las 4 funciones TyC a PUBLIC/anon/authenticated, INSERT solo vía service_role/postgres. **Patrón extendido** a `solicitudes_contacto` y `avisos_version_legal` (ambas RLS sin policies, service-role only, `20260815120000`). Patrón de solo service-role documentado en 3 tablas, pero no hay decisión PM explícita para ninguna. | Confirmar con PM que service-role only es la intención para las 3 tablas; documentar en `database.md`. |

---

## ❌ NO ESPECIFICADO (No mencionado en ningún documento fuente de verdad)

| # | Gap | Por qué importa | Fuente revisada |
|---|-----|-----------------|----------------|
| N-1 | Tabla `solicitudes_arrepentimiento`: FK `usuario_id → usuarios.id` no documentada | Menor — el esquema existe, solo no documentado | `20260806180000` |
| N-2 | Trigger `estados_caso`: función `notify_change_of_state()` existe en la migración pero no hay regla de negocio documentada sobre cuándo se dispara o comportamiento esperado | La función existe, el trigger se ejecuta en INSERT/UPDATE de `estados_caso`, pero ninguna doc dice qué debe contener la notificación o a quién dirigirse. **Nota:** changelog 2026-08-17 documenta el comportamiento de `validate_suscripcion_aceptacion()` y sus mensajes de error (las dos ramas: usuario vs estudio), pero no cubre `notify_change_of_state()`. | `20260815000000` | ⚠ Parcialmente resuelto — changelogs documentan otros triggers pero no este específico |
| N-3 | Endpoint `onboarding/estados_caso` retorna `estados_caso` — pero `estados_caso` NO está en la lista de 27 tablas de `database.md` | O la tabla se omitió en la documentación o el endpoint referencia una tabla que fue consolidada en otro lugar | `docs/database.md` vs `apps/api/src/onboarding/` |
| N-4 | Sin esquema documentado para `pagos_stripe.tabla_origen` — ¿cuáles son los valores válidos? | Se usa como discriminador en FK de `pagos_stripe` → `tabla_origen` + `id_origen`, pero los valores válidos no están documentados | `20260730180000` |
| N-5 | Valores del enum `estados_invitacion`: `pagado_parcial`, `reembolsado` existen en la DB pero no se mencionan en ningún doc funcional | El enum existe en `20260806180000` pero ningún doc del PM referencia estos estados | `20260806180000` |
| N-6 | Tabla `cambios_caso`: trigger `notify_change_of_state()` se ejecuta sobre esta tabla pero no hay expectativa documentada para contenido/destinatario de la notificación | El trigger existe, no hay regla de negocio documentada. **Nota:** changelog 2026-08-17 documenta que `validate_suscripcion_aceptacion` ahora usa `P0001` (→409) en vez de `22000` (→500), y que las ramas de usuario y estudio tienen mensajes distintos — pero esto es un trigger diferente. | `20260815000000` | ⚠ Parcialmente resuelto — changelogs documentan otros triggers pero no este específico |

---

## 🚫 FUERA DEL ALCANCE (Explícitamente excluido de esta auditoría)

- Detalles de implementación de endpoints API (lógica de controladores, pipes de validación, manejo de errores)
- Lógica de negocio del frontend (componentes de página, estado, routing)
- Configuración del pipeline CI/CD
- Configuración a nivel de proyecto Supabase (políticas de auth más allá de RLS, edge functions)
- Integraciones con terceros (llamadas a API de Stripe, SendGrid, servicios externos)

---

## RIESGOS TÉCNICOS (Identificados durante la auditoría)

| # | Riesgo | Severidad | Evidencia | Mitigación |
|---|--------|-----------|-----------|------------|
| R-1 | `items_fijos_por_negociacion.id` es BIGINT mientras todos los otros IDs de entidad son UUID — podría causar confusión en FKs | Baja | `20260811150000` | Documentar la asimetría; no se necesita migración de datos |
| R-2 | Sin RLS en `solicitudes_arrepentimiento` — potencial exposición de datos si se bypasea el service-role | Media | `20260806180000` | Agregar RLS restrictivo o documentar la suposición de solo service-role. **Patrón ahora extendido** a `solicitudes_contacto` y `avisos_version_legal` (3 tablas sin policies, todas service-role only). |
| R-3 | Tabla `notificaciones` tiene columna `canal` sin constraint de enum documentado | Baja | `20260730180000` | Agregar constraint CHECK o documentar valores permitidos |
| R-4 | Trigger `estados_caso` `notify_change_of_state()` no tiene reglas de negocio documentadas | Baja | `20260815000000` | Agregar especificación funcional del comportamiento de notificación. **Nota:** changelog 2026-08-17 documenta el comportamiento de `validate_suscripcion_aceptacion` (mensajes, ERRCODE, cobertura de UPDATE) pero no `notify_change_of_state`. |
| R-5 | `pagos_stripe.tabla_origen` no tiene constraint CHECK ni valores válidos documentados | Media | `20260730180000` | Agregar constraint CHECK o documentar valores válidos del discriminador |
| R-6 | Seeds TyC v1.0 contienen `[COMPLETAR: fecha]` — contenido NO publicable hasta que Administración complete los textos | Alta | Changelog 2026-08-14 | Completar los placeholders antes de cualquier despliegue a producción. Changelog lo documenta como pendiente explícito. |

---

## PREGUNTAS PM (Requieren decisión del Product Owner)

| # | Pregunta | Contexto | Prioridad |
|---|----------|---------|-----------|
| ~~Q-1~~ | ~~**R-13 (Refactorizar pagos):** ¿Sigue activo o está diferido?~~ | ~~`Cambios_Reunion_Mediacion_07-08-2026.md` lo lista como prioridad ALTA~~ | ✅ **RESUELTA** — Changelog 2026-08-10: "explícitamente post-MVP en el plan — no se tocó". Diferido. |
| Q-2 | **Valores `estados_invitacion` `pagado_parcial` y `reembolsado`:** ¿Siguen planificados para implementación? Si es así, ¿qué pantallas de UI los usan? | Los valores existen en el enum de la DB pero no hay especificación funcional que los referencie | ALTA |
| Q-3 | **Notificaciones `estados_caso`:** ¿Qué debe contener la notificación cuando cambia el estado de un caso? ¿Quién la recibe? | El trigger existe pero no hay regla de negocio | MEDIA |
| Q-4 | **RLS `solicitudes_arrepentimiento`:** ¿Esta tabla debe ser accesible para usuarios autenticados (ej: ver sus propias solicitudes) o solo service-role? | No existe política RLS | MEDIA |
| Q-5 | **`notificaciones.canal` valores válidos:** ¿Debe restringirse a `'app'`, `'email'`, `'sms'`? ¿Cuáles son las opciones válidas? | La columna existe como TEXT sin constraint | BAJA |
| Q-6 | **`pagos_stripe.tabla_origen` valores válidos:** ¿A qué tablas puede referenciar? (`invitaciones`, `suscripciones`, ¿otras?) | Columna discriminadora sin valores válidos documentados | BAJA |
| Q-7 | **Baja de suscripción bloqueada:** `POST /suscripciones/:id/baja` existe pero no hay `GET /suscripciones/vigente` — el botón de baja en "Mi plan" siempre da 404 | Changelog 2026-08-16 reporta el bloqueo; Changelog 2026-08-17 implementa `GET /suscripciones/vigente` (§10 de fichas) | RESUELTA — endpoint implementado en BE |
| Q-8 | **Canal de contacto sin respuesta:** `POST /legal/contacto` está implementado pero "Alguien que responda el canal de contacto" sigue pendiente de Operaciones | Changelog 2026-08-17, sección "Lo que sigue abierto" | PENDIENTE — requiere asignación de persona/rol en Operaciones |

---

## HALLAZGOS CRÍTICOS DEL DEV MERGE (2026-08-18)

Fixes de seguridad/funcionalidad que estaban en `dev` y se mergearon hoy. **Ya implementados.**

| # | Hallazgo | Severidad | Migración | Estado |
|---|----------|-----------|-----------|--------|
| H-1 | `has_accepted_current()` medía vigencia con `valid_to IS NULL` — al programar una nueva versión, la función devolvía `false` para todos los usuarios y el trigger `validate_suscripcion_aceptacion` rechazaba **toda** alta de suscripción durante los 10 días de preaviso. No se podía arreglar aceptando porque `POST /legal/aceptaciones` escribía la versión vigente (v1.0) mientras la función exigía la futura (v2.0). **Cumplir con el preaviso legal cerraba la contratación.** | **CRÍTICA** | `20260817140000` | ✅ FIX APLICADO |
| H-2 | `validate_suscripcion_aceptacion()` no cubría suscripciones de estudio (`estudio_id`). El XOR de `suscripciones` hacía que la mitad de los altas esquivaran la regla. | Alta | `20260817120000` | ✅ FIX APLICADO |
| H-3 | `validate_suscripcion_aceptacion()` original usaba ERRCODE `22000` — `toDomainError` no lo mapea, así que el rechazo salía como `500 internal_error` en vez de `409 conflict`. | Alta | `20260817120000` | ✅ FIX APLICADO |
| H-4 | Trigger anti-contratación era solo `BEFORE INSERT` — reasignar `usuario_id`/`estudio_id` por `UPDATE` esquivaba la regla. | Media | `20260817120000` | ✅ FIX APLICADO |
| H-5 | Rate limit compartido en Postgres con clave `@Ip()` — sin `trust proxy`, todo el tráfico caía en un solo contador (la IP del reverse proxy). | Media | `20260817130000` | ✅ FIX APLICADO (usa `resolveClientIp`) |
| H-6 | El limitador de rate-limit tiraba abajo el canal de arrepentimiento ante un error de DB (fail-closed). | Media | `20260817130000` | ✅ FIX APLICADO (fail-open + log) |

---

## PENDIENTES ABIERTOS DEL DEV MERGE

Extraídos de changelogs 2026-08-16 y 2026-08-17. Son work items reales, no gaps de documentación.

| # | Pendiente | De quién | Prioridad |
|---|-----------|---------|-----------|
| P-1 | Seed `legal_documents` v1.0 — 42 campos `[COMPLETAR]` (texto NO publicable) | Administración | **CRÍTICA** |
| P-2 | `OPERACIONES_EMAIL` en el checklist de despliegue |quien despliega | Alta |
| P-3 | Baja efectiva en la pasarela (migrar checkout a `preapproval` en Mercado Pago) | Producto + BE | Alta |
| P-4 | Criterio de "cambio sustancial" por escrito | Producto + legales | Alta |
| P-5 | Alguien que responda el canal de contacto (`POST /legal/contacto`) | Operaciones | **CRÍTICA** |
| P-6 | Export sin rango sobre log grande arma todo el PDF en memoria (sin límite de filas) | BE | Baja |
| P-7 | El banner de preaviso no se re-chequea si `validFrom` pasa con la app abierta (pestaña web de larga vida) | FE | Baja (deuda conocida) |

---

## Apéndice: Fuentes Consultadas

| Fuente | Ubicación | Estado |
|--------|-----------|--------|
| Doc técnica v1.0 | `docs/Mediacion_Documentacion_Tecnica_v1_0.md` | ✅ Revisada |
| Cambios reunión 07-08 | `docs/Cambios_Reunion_Mediacion_07-08-2026.md` | ✅ Revisada |
| Instructivo TyC | `docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md` | ✅ Revisada |
| Integration contract | `docs/integration-contract.md` | ✅ Revisada |
| Decisiones DB 10-08 | `docs/decisiones-db/2026-08-10-cambios-reunion.md` | ✅ Revisada |
| Decisiones DB 13-08 | `docs/decisiones-db/2026-08-13-decisiones-restauracion-revert.md` | ✅ Revisada |
| Decisiones DB 14-08 | `docs/decisiones-db/2026-08-14-tyc-contrato-con-db.md` | ✅ Revisada |
| TyC contrato FE | `docs/tyc-contrato-frontend.md` | ✅ Revisada |
| Reparto TyC devs | `docs/reparto-tyc-devs.md` | ✅ Revisada |
| DB documentation | `docs/database.md` | ✅ Revisada |
| Plan implementación | `docs/plan-implementacion-07-08-2026.md` | ✅ Revisada |
| TYC Metodos autocompositivos | `docs/TYC_Metodos_autocompositivos.md` | ✅ Revisada |
| Migraciones SQL (33 archivos) | `supabase/migrations/` | ✅ Revisadas |
| NestJS controllers (23 módulos) | `apps/api/src/` | ✅ Revisados |
| Frontend API services | `mediacion-app/services/api/` | ✅ Revisados |
| Frontend types | `mediacion-app/types/` | ✅ Revisados |
| DB types (Kysely) | `packages/db-types/src/database.types.ts` | ✅ Revisado |
| DBML schema | `mediacion.dbml` | ✅ Revisado |
| **Changelog 2026-07-21** | `docs/changelogs/2026-07-21.md` | ✅ Revisado — Fases 1-2, decisiones PM iniciales |
| **Changelog 2026-07-28** | `docs/changelogs/2026-07-28.md` | ✅ Revisado — Hallazgos #4.1–#4.4 (resuelve A-1 parcialmente) |
| **Changelog 2026-08-10** | `docs/changelogs/2026-08-10.md` | ✅ Revisado — R-04…R-12, front+back (resuelve A-2/Q-1) |
| **Changelog 2026-08-11** | `docs/changelogs/2026-08-11.md` | ✅ Revisado — Linter, REVOKE, policies, FK indexes |
| **Changelog 2026-08-12** | `docs/changelogs/2026-08-12.md` | ✅ Revisado — Advisors panel, índices no usados |
| **Changelog 2026-08-14** | `docs/changelogs/2026-08-14.md` | ✅ Revisado — Frontend TyC aceptación (parcialmente resuelve A-4) |
| **Changelog DB 2026-08-13** | `docs/changelogs-db/2026-08-13.md` | ✅ Revisado — Restauración post-revert |
| **Changelog DB 2026-08-14** | `docs/changelogs-db/2026-08-14.md` | ✅ Revisado — Staging push VPS, TyC DB, drift fix |
| **Changelog 2026-08-16** | `docs/changelogs/2026-08-16.md` | ✅ Revisado — Activación módulo legal contra API real |
| **Changelog 2026-08-16-contacto** | `docs/changelogs/2026-08-16-contacto.md` | ✅ Revisado — Formulario de contacto FE |
| **Changelog 2026-08-17** | `docs/changelogs/2026-08-17.md` | ✅ Revisado — Cierre pendientes TyC (fix has_accepted_current, trigger estudio, PDF, rate limit) |
| **Changelog DB 2026-08-15** | `docs/changelogs-db/2026-08-15.md` | ✅ Revisado — Tablas avisos_version_legal, solicitudes_contacto |
| **Fichas legal backend** | `docs/fichas-legal-backend.md` | ✅ Revisada — 10 fichas de endpoint, error codes, comportamiento |
| **Pedidos FE→BE** | `docs/pedidos-frontend-a-backend.md` | ✅ Revisada — 2 endpoints solicitados + respuesta BE |
