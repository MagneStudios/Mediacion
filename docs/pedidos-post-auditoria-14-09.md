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

### 1.1 Ficha de contexto del caso — DB ✅ resuelto · falta BE + FE

> "¿cuáles son las tareas de los nenes? Los lunes a las 2 va a X, a las 4 inglés, a las 6 el colegio." Ficha de contexto por caso, cargable por las partes: integrantes del grupo familiar, actividades y horarios de los chicos, colegio, cronograma semanal, domicilios, restricciones. Cargable de forma incremental.
> — `CAMBIOS-PACTUM-v2` §9

Falta un modelo de datos nuevo (integrantes, horarios, colegio, cronograma semanal, domicilios, restricciones), con definición de qué campos son privados por parte y cuáles compartidos. Hoy solo existen categorías genéricas de ítems (`cuidado_ninos`, `cronogramas`) en `apps/api/src/casos/categorias.ts`, sin estructura real detrás. Alimenta también a Backend (endpoints CRUD) y Frontend (formulario incremental).

**DB ✅ resuelto** (`20260914120000_caso_contexto.sql`, mig 46): 7 tablas (`caso_contexto` + 6 hijas `contexto_*`) con privacidad por parte (RLS estilo `items`/CA-02; cada hija visible/escribible solo por su `parte_id` + admin; el ancla `caso_contexto` lo crea Backend vía `service_role`, no hay policy de INSERT cliente en el padre).
**Siguiente — Backend:** CRUD incremental por sección sobre las 6 hijas; el alta del ancla `caso_contexto` la hace Backend. Validar `parte_id = usuario_actual`. Alimentar el prompt del motor de propuestas.
**Siguiente — Frontend:** formulario incremental por secciones (§3.2), guardado contra los endpoints BE.

### 1.2 Trazabilidad de moderación de lenguaje — DB ✅ resuelto · falta BE + FE

> "no está previsto qué pasa si hay insultos [...]. Hay que implementar moderación de lenguaje ofensivo en todo texto libre que cargue una parte: detección antes de que el texto se procese o se muestre, aviso al usuario para que reformule, registro del evento para trazabilidad."
> — `CAMBIOS-PACTUM-v2` §7

Falta la tabla de registro de eventos de moderación (texto detectado, usuario, timestamp, acción tomada). Búsqueda de `moderat|profan|ofensiv|insult|toxic` en todo el repo: cero resultados de lógica de negocio.

**DB ✅ resuelto** (`20260914130000_moderation_events.sql`, mig 47): tabla server-only `moderation_events` (`usuario_id`, `caso_id`, `texto_detectado`, `accion`, `scores`). RLS: solo `service_role` escribe, solo `is_admin()` lee; `anon`/`authenticated` no tienen SELECT.
**Siguiente — Backend:** servicio de moderación que, antes de procesar/mostrar texto libre de una parte, corre detección y escribe en `moderation_events` vía `service_role`; devuelve señal de aviso al FE.
**Siguiente — Frontend:** componente de aviso (§3.3) conectado al endpoint de detección.

### 1.3 Arbitraje — flag explícito por materia — DB ✅ resuelto (flag por caso) · falta BE

> "en cuestiones de familia el arbitraje está expresamente prohibido [...] no se activa nunca para materias de familia. Si a futuro se habilita, es exclusivamente para la materia 'bienes'. Dejar el flag a nivel de materia, no global: `FEATURE_ARBITRAJE_BIENES`."
> — `CAMBIOS-PACTUM-v2` §5

Ya está excluido "por diseño": el enum `metodo_caso` (`supabase/migrations/20260721191644_enums.sql:18-20`) solo admite `negociacion/conciliacion/mediacion`. No existe el flag con ese nombre ni a nivel de materia. Si se quiere modelar literalmente como pidió el cliente, hace falta una columna/config a nivel de materia — opcional, depende de cómo lo resuelva Backend.

**DB ✅ resuelto** (`20260914140000_casos_arbitraje_bienes_flag.sql`, mig 48): `casos.arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false`. Flag por caso (granularidad de la materia del caso), no global; el TYC H.5/H.6 ya prohíbe familia y el enum `metodo_caso` no incluye arbitraje.
**Siguiente — Backend:** consumir el flag; habilitar arbitraje solo para materia `bienes` (validar en BE, no en DB).
**Siguiente — Frontend:** (opcional a futuro) toggle por caso, habilitado solo si flag=true y materia=bienes.

---

## 2 · Backend — 6 de 7 ítems

### 2.1 Cronograma embebido en el documento del acuerdo — no implementado

> "¿los horarios de los chicos van en el contrato o en un documento anexo? En el contrato. Ya te queda todo establecido y lo firmás. [...] El generador tiene que renderizar tablas de cronograma dentro del documento."
> — `CAMBIOS-PACTUM-v2` §10

El "PDF" que se firma hoy es en realidad texto plano — `apps/api/src/acuerdos/acuerdo-export.ts` genera un `.txt` (`acuerdo-${id}.txt`) que se manda directo a SignNow. Hay que migrar a generación real de PDF con tablas de días/horarios embebidas, estructura encabezado + cuerpo + cierre. **Es la pieza más grande de las pendientes.**

### 2.2 Prompt de IA distinto por método — no implementado

> Negociación → mínima injerencia (encuadre y formas). Conciliación → media (ordena la charla). Mediación → máxima (propone soluciones). "Tres configuraciones distintas del motor (prompts/reglas), no una sola con parámetros cosméticos."
> — `CAMBIOS-PACTUM-v2` §6

`buildPrompt()` en `apps/api/src/negociacion/negociacion.service.ts:153` es un prompt fijo; no rama según `negociaciones.method`. Falta implementar las 3 configuraciones.

### 2.3 Detección de lenguaje ofensivo — no implementado

> "detección antes de que el texto se procese o se muestre, aviso al usuario para que reformule, registro del evento para trazabilidad."
> — `CAMBIOS-PACTUM-v2` §7

Falta el servicio que corra antes de procesar/mostrar cualquier texto libre cargado por una parte, dispare el aviso y escriba a la tabla de trazabilidad (§1.2).

### 2.4 Mitigación de sesgo de posición en el motor de IA — parcial

> "la IA va a tener que al final elegir entre opciones, no es que la va a crear [...] un juez tiende a quedarse con la última opción que leyó [...] un modelo tiende a quedarse con la primera. Como el modelo sí puede releer infinitas veces, se le puede pedir que evalúe las opciones en distinto orden."
> — `CAMBIOS-PACTUM-v2` §8

Lo que ya está: el motor es determinístico — `computeMeetingPoints` en `apps/api/src/negociacion/meeting-point.ts` calcula matemáticamente a partir de rangos, la IA solo narra el resultado ya calculado. Cumple "no redacta libre". Lo que falta: evaluación en múltiples pasadas con orden permutado y traza de la decisión para auditoría — `generateProposal` se llama una sola vez, sin ninguna lógica de mitigación de sesgo.

### 2.5 Endpoints de la ficha de contexto — no implementado

> "Cargable de forma incremental — no un formulario gigante de una sola vez. Esa ficha alimenta el prompt del motor."
> — `CAMBIOS-PACTUM-v2` §9

Falta el CRUD incremental sobre la ficha (§1.1) y conectarla al prompt del motor de propuestas.

### 2.6 Invitar en cualquier momento + reenviar / regenerar código — parcial

> "Poder invitar a la contraparte en cualquier momento después de creado el caso [...]. Poder reenviar la invitación y regenerar el código si hace falta."
> — `AJUSTES-PACTUM-2026-09-10` §5

Lo que ya está: copiar código/link, compartir, y badge de estado (pendiente/aceptada/rechazada/expirada) vía `EstadoInvitacion`. Lo que falta: hoy solo funciona mientras `detail.estado === 'nuevo'` — no "en cualquier momento" — y no existe ningún endpoint de reenvío ni de regeneración de código (`grep` de `reenviar|resend|regenerar|regenerate` sin resultados funcionales).

---

## 3 · Frontend — 3 ítems, los tres con un frente disponible ya

### 3.1 Desbloquear la invitación fuera del estado "nuevo" — parcial — **disponible ahora**

> "Poder invitar a la contraparte en cualquier momento después de creado el caso, desde el detalle del caso."
> — `AJUSTES-PACTUM-2026-09-10` §5

No depende de Backend ni DB: sacar el guard `isAwaitingCounterparty` en `mediacion-app/features/cases/CaseDetailScreen.tsx:127-135`, que hoy esconde la tarjeta de invitación fuera del estado `nuevo`. Copiar código/link ya funciona con los datos existentes. Los botones de reenviar/regenerar quedan deshabilitados hasta que Backend exponga los endpoints (§2.6).

### 3.2 Formulario incremental de ficha de contexto — no implementado — **disponible ahora (con mock)**

> "Cargable de forma incremental — no un formulario gigante de una sola vez."
> — `CAMBIOS-PACTUM-v2` §9

La UI (integrantes, horarios, colegio, cronograma semanal, restricciones, con carga por secciones) se puede construir con estado local ahora; el guardado real espera al endpoint de DB/Backend (§1.1, §2.5).

### 3.3 Aviso visual de moderación — no implementado — **disponible ahora (componente sin datos reales)**

> "aviso al usuario para que reformule"
> — `CAMBIOS-PACTUM-v2` §7

El componente de aviso (toast/inline) se puede construir y dejar listo para conectar al endpoint de detección (§2.3) en cuanto exista.

---

## Resumen

| # | Ítem | Capas | Estado |
|---|------|-------|--------|
| 1 | Ficha de contexto del caso | DB · Backend · Frontend | DB ✅ · falta BE + FE |
| 2 | Moderación de lenguaje ofensivo | DB · Backend · Frontend | DB ✅ · falta BE + FE |
| 3 | Arbitraje — flag por materia | DB (opcional) · Backend | DB ✅ (flag por caso) · falta BE |
| 4 | Cronograma embebido en el PDF del acuerdo | Backend | No implementado |
| 5 | Prompt de IA por método | Backend | No implementado |
| 6 | Mitigación de sesgo del motor de IA | Backend | Parcial |
| 7 | Invitar en cualquier momento + reenviar/regenerar código | Backend · Frontend | Parcial |

**Frentes que Frontend puede arrancar ya, sin esperar a nadie:** §3.1, §3.2 (con mock), §3.3 (componente sin datos reales).
