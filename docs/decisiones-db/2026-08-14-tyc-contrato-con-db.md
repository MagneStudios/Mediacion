# Decisiones TyC — Contrato DB ↔ FE/BE (módulo legal)

**Fecha:** 14/08/2026
**Contexto:** Frontend entregó `docs/tyc-contrato-frontend.md` (contrato congelado del módulo legal, rama `feat/frontend-tyc-aceptacion`) con toda su capa construida contra mocks y los shapes exactos que espera de DB y BE. El reparto de responsabilidades ya estaba definido en `docs/reparto-tyc-devs.md` (§02 DB): el esquema de `legal_documents`/`user_agreements`, el append-only real, y la regla que impide contratar sin aceptación vigente. Faltaban dos definiciones de implementación y algunos detalles finos, decididos en esta sesión con el rol DB.
**Principio:** la prueba de aceptación la escribe el servidor y la garantía vive en Postgres (§00 del anexo). El cliente (FE y cualquier request directa) nunca puede fabricar ni modificar registro legal.

---

## Decisiones tomadas

### 1. Permisos de escritura en `user_agreements`: solo roles de servidor

- **Decisión:** `INSERT` solo para `service_role` y `postgres` (la conexión de la API). `authenticated`/`anon` no pueden insertar. `SELECT` de `authenticated` con policy RLS de filas propias (lo exige el anexo). `UPDATE`/`DELETE` para **ningún rol**, vía trigger que rechaza ambos — incluso para `service_role`.
- **Por qué:** el anexo y el instructivo exigen que IP, user agent, timestamp y versión los resuelva el servidor; un cliente con capacidad de INSERT fabrica pruebas falsificables (error #3 del instructivo). Y como `service_role` tiene `bypassrls=true`, la RLS sola no lo protege: el trigger es la única capa que garantiza append-only para todos los roles (el checklist del anexo pide probarlo "con al menos dos roles incluido el de servicio").
- **Consecuencias:** la API (NestJS) escribe las aceptaciones conectando como `postgres`/`service_role`; nunca se publica un cliente de DB con permiso de escritura sobre la tabla.

### 2. Regla "no contratar sin aceptación vigente": trigger en `suscripciones`

- **Decisión:** trigger `BEFORE INSERT` en `suscripciones` que, para filas con `usuario_id`, valida que exista una aceptación de `terms` con `accepted = true` cuya `document_version` coincida exactamente con la versión vigente (`valid_to IS NULL`) de `legal_documents.tipo = 'terms'`. Lógica encapsulada en `has_accepted_current(user_id, document_type)` (SECURITY DEFINER, `search_path = ''`), reutilizable por BE como RPC (frontera §05 del anexo).
- **Por qué:** es la garantía legal que vale aunque la request no venga del front (checklist del anexo). El match por `document_version` es más fuerte que por timestamp.
- **Consecuencias:** el orden del contrato FE queda como está (FE registra la aceptación **antes** de llamar al alta de suscripción). Para filas con `estudio_id` (XOR) no se define regla en este ciclo — queda como pendiente de BE/Producto. Los fixtures que insertan `suscripciones` deben registrar la aceptación previa. La depuración R-06 no puede borrar aceptaciones: la FK con `ON DELETE RESTRICT` la bloquea por diseño.

### 3. Tabla `solicitudes_arrepentimiento` para la traza del arrepentimiento

- **Decisión:** crear la tabla aunque el reparto asigne la *función* a BE: la traza (registro + timestamp) necesita esquema y DB es dueña del esquema. Columnas: `id UUID`, `codigo TEXT UNIQUE` generado por trigger (`ARR-0001…`, mismo patrón que `casos.codigo`), `nombre`, `email`, `detalle`, `received_at TIMESTAMPTZ DEFAULT now()` (es el `received_at` de la respuesta del endpoint), `estado` enum (`recibida`/`en_proceso`/`resuelta`/`rechazada`) para el tracking operativo, `usuario_id UUID NULL FK auth.users ON DELETE SET NULL`, timestamps y trigger de auditoría (patrón `audit_trigger_func` ya existente).
- **Por qué:** el endpoint es público (Res. 424/2020) pero la escritura pasa por BE como rol de servidor; la DB no expone INSERT a `anon` (el rate-limiting y la validación viven en la API). La fila se conserva aunque el usuario se borre (SET NULL), misma lógica de retención legal que `user_agreements`.
- **Consecuencias:** BE consume esta tabla para el POST `/legal/arrepentimiento` y para notificar a Operaciones; el `id` que se muestra al usuario es el `codigo`.

### 4. FKs y retención (5 años)

- **Decisión:** `user_agreements.user_id → auth.users(id) ON DELETE RESTRICT`. Nada de `ON DELETE CASCADE` desde `users`/`auth.users` hacia las tablas legales. `solicitudes_arrepentimiento.usuario_id → auth.users(id) ON DELETE SET NULL`.
- **Por qué:** el anexo lo hace explícito: un CASCADE que borre aceptaciones al borrar el usuario "destruye exactamente lo que hay que conservar cinco años" (error #5 del anexo). RESTRICT además es la guarda física contra la depuración R-06.
- **Consecuencias:** la anonimización de usuarios no puede eliminar estas filas; si el flujo R-06 lo intentara, la base lo rechaza.

### 5. `legal_documents`: vigencia única por tipo + seed v1.0 con mocks

- **Decisión:** partial unique index `UNIQUE (tipo) WHERE valid_to IS NULL` (una sola versión vigente por tipo). Seed de `terms` y `privacy` v1.0 con el contenido ya normalizado de `mocks/legal-texts.ts` de FE (formato `## X. TÍTULO`), `valid_from` = fecha de implementación, `is_substantial = false`.
- **Por qué:** la página pública renderiza desde DB sin sesión (RLS SELECT para `anon`/`authenticated`); la fecha de "última actualización" sale de `valid_from`. Los textos mock contienen 42 campos `[COMPLETAR]` bloqueados por Administración — se seedean tal cual (visibles, como hoy en FE) y no se publica la versión hasta completarlos.
- **Consecuencias:** la garantía del contrato exige que el contenido no viva en el repo del front; vive en esta tabla. Publicar una versión nueva = INSERT con `valid_to` de la anterior seteado + (`is_substantial`, `resumen_cambios`) decididos por Producto+legales (pendiente).

### 6. Nombres congelados (§05 del anexo)

- **Decisión:** columnas exactas y en snake_case según el contrato FE. `legal_documents`: `tipo`, `version`, `contenido`, `valid_from`, `valid_to`, `is_substantial`, `resumen_cambios`. `user_agreements`: `user_id`, `document_type`, `document_version`, `accepted_at`, `ip INET`, `user_agent`, `accepted`.
- **Por qué:** son registro legal; un rename silencioso rompe exports de años anteriores (anexo, nota al §05).
- **Consecuencias:** cualquier desvío requiere PR propio y aviso explícito a FE y BE antes de implementar.

### 7. Semántica de `marketing`

- **Decisión:** un registro por aceptación y por tipo; `marketing` con `accepted = false` también se guarda. La ausencia de `marketing` en el POST (re-aceptación) significa **no escribir** fila de marketing — no pisar la elección del registro.
- **Por qué:** lo fija el contrato FE §2.2/§3.2 y el anexo §02 ("un registro distinto por tipo de documento").
- **Consecuencias:** BE implementa esa semántica en el endpoint; DB solo garantiza que `document_type = 'marketing'` admite `accepted = false` y no tiene constraint de contratación asociado.

---

## Fuentes

- `docs/tyc-contrato-frontend.md` (contrato congelado FE, 14/08/2026)
- `docs/reparto-tyc-devs.md` (§02 DB — "Listo cuando", §05 fronteras)
- `docs/Instructivo_Implementacion_TyC_-_Golosetti_Abogados.md` (puntos #9, #11, #13, #18)
- Prompt de implementación: `docs/prompts-db/implementar-tyc-legal.md`
