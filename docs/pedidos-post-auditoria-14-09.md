# Pedidos post-auditoría — 14/09/2026

**Fecha:** 14/09/2026 · **Autor:** auditoría cruzada de docs de cliente vs. código real · **Para:** DB, Backend, Frontend
**Origen:** `docs/CAMBIOS-PACTUM-v2-2026-09-01.md` + `docs/AJUSTES-PACTUM-2026-09-10.md`, cruzados contra el estado real del repo.
**Regla de prioridad:** donde los dos documentos se contradicen, **manda el más nuevo (10/09)**.

---

## 0 · Qué es este doc

Los dos documentos de arriba juntan 18 pedidos del cliente (12 de la reunión del 01/09, 6 de la ronda de prueba del 10/09). De esos 18, **10 ya están implementados** y no figuran acá — solo se listan los **7 que quedan abiertos** (4 sin empezar, 3 a medio hacer), divididos por la capa que tiene que resolverlos. Varios tocan más de una capa; en ese caso aparecen repetidos con el alcance específico de cada una.

**No incluido:** posicionamiento de landing (`CAMBIOS-PACTUM-v2` §12) — no hay sitio de marketing en este repo, no es verificable en código acá.

---

## 1 · DB — 3 ítems

### 1.1 Ficha de contexto del caso — DB ✅ · FE ✅ (mock) · falta BE

> "¿cuáles son las tareas de los nenes? Los lunes a las 2 va a X, a las 4 inglés, a las 6 el colegio." Ficha de contexto por caso, cargable por las partes: integrantes del grupo familiar, actividades y horarios de los chicos, colegio, cronograma semanal, domicilios, restricciones. Cargable de forma incremental.
> — `CAMBIOS-PACTUM-v2` §9

Falta un modelo de datos nuevo (integrantes, horarios, colegio, cronograma semanal, domicilios, restricciones), con definición de qué campos son privados por parte y cuáles compartidos. Hoy solo existen categorías genéricas de ítems (`cuidado_ninos`, `cronogramas`) en `apps/api/src/casos/categorias.ts`, sin estructura real detrás. Alimenta también a Backend (endpoints CRUD) y Frontend (formulario incremental).

**DB ✅ resuelto** (`20260914120000_caso_contexto.sql`, mig 46): 7 tablas (`caso_contexto` + 6 hijas `contexto_*`) con privacidad por parte (RLS estilo `items`/CA-02; cada hija visible/escribible solo por su `parte_id` + admin; el ancla `caso_contexto` lo crea Backend vía `service_role`, no hay policy de INSERT cliente en el padre).
**Frontend ✅ resuelto (mock)** (§3.2): formulario incremental por secciones ya construido y **alineado campo a campo con la migración 46** (mismos nombres/tipos que las 6 tablas `contexto_*`, incluida la corrección de privacidad — todo privado por parte, sin "compartido" — y el hallazgo de que `contexto_cronograma` usa `franja_horaria TEXT`, no horas exactas). Detalle: `docs/plan-alineacion-db-ficha-contexto-14-09.md`. Sigue siendo mock — el `caseContextService` no habla contra ningún endpoint real todavía.
**Siguiente — Backend:** CRUD incremental por sección sobre las 6 hijas; el alta del ancla `caso_contexto` la hace Backend. Validar `parte_id = usuario_actual`. Alimentar el prompt del motor de propuestas. Una vez expuestos los endpoints, el swap del lado FE es acotado (el contrato `CaseContextService` ya está definido en `mediacion-app/services/case-context.service.ts`).

### 1.2 Trazabilidad de moderación de lenguaje — DB ✅ · FE ✅ (mock) · falta BE

> "no está previsto qué pasa si hay insultos [...]. Hay que implementar moderación de lenguaje ofensivo en todo texto libre que cargue una parte: detección antes de que el texto se procese o se muestre, aviso al usuario para que reformule, registro del evento para trazabilidad."
> — `CAMBIOS-PACTUM-v2` §7

Falta la tabla de registro de eventos de moderación (texto detectado, usuario, timestamp, acción tomada). Búsqueda de `moderat|profan|ofensiv|insult|toxic` en todo el repo: cero resultados de lógica de negocio.

**DB ✅ resuelto** (`20260914130000_moderation_events.sql`, mig 47): tabla server-only `moderation_events` (`usuario_id`, `caso_id`, `texto_detectado`, `accion`, `scores`). RLS: solo `service_role` escribe, solo `is_admin()` lee; `anon`/`authenticated` no tienen SELECT.
**Frontend ✅ resuelto (mock)** (§3.3): `InlineWarning` + `useLanguageModeration` (heurística local, lista corta de términos) ya integrados en `PositionFormFields.tsx` (`concessionConditions`, `description`). Detección 100% client-side, sin red — el punto de extensión hacia `moderationService.analyze(text)` está documentado en el propio hook, sin tocar la firma cuando exista.
**Siguiente — Backend:** servicio de moderación que, antes de procesar/mostrar texto libre de una parte, corre detección y escribe en `moderation_events` vía `service_role`; devuelve señal de aviso al FE. Reemplaza la heurística local del mock.

### 1.3 Arbitraje — flag explícito por materia — DB ✅ resuelto (flag por caso) · falta BE

> "en cuestiones de familia el arbitraje está expresamente prohibido [...] no se activa nunca para materias de familia. Si a futuro se habilita, es exclusivamente para la materia 'bienes'. Dejar el flag a nivel de materia, no global: `FEATURE_ARBITRAJE_BIENES`."
> — `CAMBIOS-PACTUM-v2` §5

Ya está excluido "por diseño": el enum `metodo_caso` (`supabase/migrations/20260721191644_enums.sql:18-20`) solo admite `negociacion/conciliacion/mediacion`. No existe el flag con ese nombre ni a nivel de materia. Si se quiere modelar literalmente como pidió el cliente, hace falta una columna/config a nivel de materia — opcional, depende de cómo lo resuelva Backend.

**DB ✅ resuelto** (`20260914140000_casos_arbitraje_bienes_flag.sql`, mig 48): `casos.arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false`. Flag por caso (granularidad de la materia del caso), no global; el TYC H.5/H.6 ya prohíbe familia y el enum `metodo_caso` no incluye arbitraje.
**Siguiente — Backend:** consumir el flag; habilitar arbitraje solo para materia `bienes` (validar en BE, no en DB).
**Siguiente — Frontend:** (opcional a futuro) toggle por caso, habilitado solo si flag=true y materia=bienes.

---

## 2 · Backend — 6 de 7 ítems

> **Actualización 14/09 (tarde):** los ítems 2.1, 2.2 y 2.6 los resolvió Backend en `ed15e4e` (merge de `story/mediacion-pedidos-14-09` a `dev`, 6 commits de `brdonato`), en paralelo a las migraciones 46-48 y sin ningún doc propio (a diferencia de esas migraciones, que sí tienen `docs/changelogs-db/` y `docs/decisiones-db/`). 2.3 quedó parcial. Detalle de cada commit abajo.

### 2.1 Cronograma embebido en el documento del acuerdo — ✅ resuelto

> "¿los horarios de los chicos van en el contrato o en un documento anexo? En el contrato. Ya te queda todo establecido y lo firmás. [...] El generador tiene que renderizar tablas de cronograma dentro del documento."
> — `CAMBIOS-PACTUM-v2` §10

**Resuelto** (`821dff5`): `apps/api/src/acuerdos/acuerdo-pdf.ts` (PDF real, con encabezado, tabla de puntos acordados, tabla de cronograma, fundamentación y cierre) + `apps/api/src/common/pdf/pdf-writer.ts` (escritor primitivo reutilizado de `legal/acceptance-pdf.ts`). `GET /acuerdos/:id/exportar` ahora responde `application/pdf` (antes `text/plain`). **Dependencia que sigue abierta:** la tabla de cronograma necesita leer la ficha de contexto (§1.1/§2.5), que todavía no tiene lectura implementada — hasta entonces imprime "Sin cronograma cargado para este caso" (`acuerdo-pdf.ts:178`). No es un pendiente nuevo, es la misma dependencia de §2.5.

### 2.2 Prompt de IA distinto por método — ✅ resuelto

> Negociación → mínima injerencia (encuadre y formas). Conciliación → media (ordena la charla). Mediación → máxima (propone soluciones). "Tres configuraciones distintas del motor (prompts/reglas), no una sola con parámetros cosméticos."
> — `CAMBIOS-PACTUM-v2` §6

**Resuelto** (`292b4f1`): `buildMethodPrompt(metodo, meetingPoint)` en `apps/api/src/negociacion/method-prompt.ts` — tres configuraciones reales (negociación/conciliación/mediación), cableado en `negociacion.service.ts:476` reemplazando el prompt fijo anterior.

### 2.3 Detección de lenguaje ofensivo — parcial

> "detección antes de que el texto se procese o se muestre, aviso al usuario para que reformule, registro del evento para trazabilidad."
> — `CAMBIOS-PACTUM-v2` §7

**Parcial** (`40b39f9`): nuevo módulo `apps/api/src/moderacion/` — `ModeracionService.assertTextoAceptable()` corre antes de crear/editar texto libre de `casos`/`items` y bloquea con `400 texto_ofensivo` si detecta lenguaje ofensivo (lista de términos en la tabla `configuracion`, clave `moderacion_terminos`). **Falta:** todavía no escribe a `moderation_events` (mig. 47, §1.2) — la traza "queda por ahora en el log del servicio" (`logger.warn`), sin persistir auditoría.

### 2.4 Mitigación de sesgo de posición en el motor de IA — parcial

> "la IA va a tener que al final elegir entre opciones, no es que la va a crear [...] un juez tiende a quedarse con la última opción que leyó [...] un modelo tiende a quedarse con la primera. Como el modelo sí puede releer infinitas veces, se le puede pedir que evalúe las opciones en distinto orden."
> — `CAMBIOS-PACTUM-v2` §8

Lo que ya está: el motor es determinístico — `computeMeetingPoints` en `apps/api/src/negociacion/meeting-point.ts` calcula matemáticamente a partir de rangos, la IA solo narra el resultado ya calculado. Cumple "no redacta libre". Lo que falta: evaluación en múltiples pasadas con orden permutado y traza de la decisión para auditoría — `generateProposal` se llama una sola vez, sin ninguna lógica de mitigación de sesgo.

### 2.5 Endpoints de la ficha de contexto — no implementado

> "Cargable de forma incremental — no un formulario gigante de una sola vez. Esa ficha alimenta el prompt del motor."
> — `CAMBIOS-PACTUM-v2` §9

Falta el CRUD incremental sobre la ficha (§1.1) y conectarla al prompt del motor de propuestas.

### 2.6 Invitar en cualquier momento + reenviar / regenerar código — ✅ resuelto

> "Poder invitar a la contraparte en cualquier momento después de creado el caso [...]. Poder reenviar la invitación y regenerar el código si hace falta."
> — `AJUSTES-PACTUM-2026-09-10` §5

**Backend ✅ resuelto** (`f46cd19`): `POST /casos/:id/invitaciones/:invitacionId/reenviar` y `.../regenerar` (tipo `InvitacionRefreshed`; solo `parte_a`; `409 invitacion_no_reenviable` si la invitación ya fue aceptada/rechazada). De paso corrige que `invitation_expired` colapsaba con `invalid_token` en `joinCase`.
**Frontend ✅ resuelto** (§3.1): copiar código/link, compartir, badge de estado (vía `EstadoInvitacion`), disponible en **cualquier estado elegible** (`canInviteCounterparty`: `nuevo`, `pendiente_suscripciones`, `activo`, `en_negociacion`, `acordado`), no solo `nuevo`. `InvitationSection` es autónomo. Botones "Reenviar"/"Regenerar código" ya conectados a los endpoints reales (diálogo de confirmación para regenerar, por rotar el código/link ya compartido).

---

## 3 · Frontend — 3 ítems, los tres ✅ resueltos del lado FE (2 de 3 siguen esperando Backend)

Rama: `feat/frontend-pendientes-14-09`. Planes: `docs/plan-frontend-pendientes-14-09.md` (implementación original) y `docs/plan-alineacion-db-ficha-contexto-14-09.md` (corrección post-DB del ítem 3.2).

### 3.1 Desbloquear la invitación fuera del estado "nuevo" — ✅ implementado

> "Poder invitar a la contraparte en cualquier momento después de creado el caso, desde el detalle del caso."
> — `AJUSTES-PACTUM-2026-09-10` §5

Cerrado del lado FE (ver §2.6). Reenviar/regenerar ya están conectados a los endpoints reales del backend.

### 3.2 Formulario incremental de ficha de contexto — ✅ implementado (mock, alineado a la migración 46)

> "Cargable de forma incremental — no un formulario gigante de una sola vez."
> — `CAMBIOS-PACTUM-v2` §9

UI completa (integrantes, actividades, colegio, cronograma, domicilios, restricciones, carga por secciones) con `caseContextService` mock. Corregido el 14/09 para calzar con la migración real (mig 46) en vez de una hipótesis propia: privacidad "todo privado por parte" (no "compartido") y tipos/campos 1:1 con las 6 tablas `contexto_*`. Ver §1.1. **Falta:** conectar contra los endpoints de Backend (§2.5) cuando existan.

### 3.3 Aviso visual de moderación — ✅ implementado (heurística local, sin backend real)

> "aviso al usuario para que reformule"
> — `CAMBIOS-PACTUM-v2` §7

`InlineWarning` + `useLanguageModeration` integrados en `PositionFormFields.tsx`. Ver §1.2. **Falta:** conectar al endpoint de detección real (§2.3) cuando exista — hoy la heurística es 100% cliente, sin registrar nada en `moderation_events`.

---

## Resumen

| # | Ítem | Capas | Estado |
|---|------|-------|--------|
| 1 | Ficha de contexto del caso | DB · Backend · Frontend | DB ✅ · FE ✅ (mock) · falta BE |
| 2 | Moderación de lenguaje ofensivo | DB · Backend · Frontend | DB ✅ · FE ✅ (mock) · falta BE |
| 3 | Arbitraje — flag por materia | DB (opcional) · Backend | DB ✅ (flag por caso) · falta BE |
| 4 | Cronograma embebido en el PDF del acuerdo | Backend | ✅ resuelto (cronograma vacío hasta que exista lectura de la ficha de contexto, §1.1) |
| 5 | Prompt de IA por método | Backend | ✅ resuelto |
| 6 | Mitigación de sesgo del motor de IA | Backend | Parcial |
| 7 | Invitar en cualquier momento + reenviar/regenerar código | Backend · Frontend | ✅ resuelto (BE y FE) |

**Frontend: los 3 ítems que le tocaban están cerrados (§3.1, §3.2, §3.3).** Backend resolvió 2.1, 2.2 y 2.6 el 14/09 por la tarde (`ed15e4e`, sin doc propio). Lo que sigue abierto: 2.4 (mitigación de sesgo, parcial), 2.3 (moderación, parcial — falta persistir en `moderation_events`), y el CRUD/servicios de 1 (ficha de contexto) y 3 (arbitraje, opcional).
