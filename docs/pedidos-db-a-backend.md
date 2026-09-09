# Pedidos de DB → Backend — C-01 (gate de suscripciones) y notas C-02/C-06

**Fecha:** 02/09/2026 · **Autor:** DB (Magne Studios) · **Para:** Backend

> Decisiones de dominio DB en `docs/decisiones-db/2026-09-02-c01-c02-cliente.md`; implementación en `supabase/migrations/20260902120000_c01_gate_suscripciones.sql`; QA en `docs/changelogs-db/2026-09-02.md`. La respuesta del cliente es `docs/respuestas-cliente-01-09-2026.md` (punto 1).

Formato calcado de las fichas de BE. Si algún shape no cierra, avisar antes de implementar.

---

## C-01 · Gate "ambos al día" para activar casos (Opción A del cliente)

**Qué es:** con Opción A *"cada parte paga su propia suscripción; el caso se habilita cuando los dos están al día"*. La regla de negocio vive en la base (lógica baja), no en la app. La base rechaza activar un caso si alguna de las dos partes en disputa no tiene suscripción activa.

### Comportamiento que BE debe consumir

| | |
|---|---|
| Disparador | `UPDATE casos SET estado = 'activo'` (o `'en_negociacion'`) — y también `INSERT` directo en esos estados |
| Condición de éxito | ambas partes con `rol_en_caso IN ('parte_a','parte_b')` tienen `suscripciones.estado = 'activa'` (propia del usuario **o** la de su estudio, por el XOR) |
| Fallo | la base lanza `RAISE EXCEPTION` con `ERRCODE = 'P0001'` y mensaje `caso_bloqueado_suscripciones: ambas partes deben tener suscripción activa` |
| Rol excluido | `mediador` no cuenta (se agrega tras la activación, ronda 3; no paga suscripción) |

**Contrato para BE:**
1. Al intentar pasar un caso a `activo`/`en_negociacion`, capturar el `P0001` (`SQLSTATE 235??` no aplica; es `P0001` de la app) y responder **`409 Conflict`** con un mensaje para el usuario del tipo *"La contraparte debe tener su suscripción al día para activar el caso"*. No reintentar ciegamente.
2. El caso puede (y debe) quedar en el nuevo estado **`pendiente_suscripciones`** mientras se espera que la contraparte se suscriba; cuando ambas partes estén al día, BE hace la transición a `activo`. `pendiente_suscripciones` es un valor válido y esperado de `estado_caso` — agregarlo a la unión de estados que BE conoce.
3. **No hay RPC de previsualización:** `caso_ambas_partes_suscripciones_activas(caso_id)` es `SECURITY DEFINER` y **no tiene `EXECUTE` para `authenticated`** (no es RPC). BE no la invoca directo; la garantía se obtiene intentando el `UPDATE` y manejando la excepción. Si BE quiere saber "¿está listo?" sin mutar, pedir un endpoint/helper aparte (fuera de alcance de este ciclo).

### Qué NO cambia (frontera congelada)

- `invitaciones.pago_a_cargo` sigue siendo `CHECK ('invitador','invitado')`. **No se agregó `'ambos'`** (la Opción A hace que no haya monto que dividir). El bloqueante de FE `pago_a_cargo` en `GET /casos/:id/invitaciones` (§8 de `docs/pedidos-frontend-a-backend.md`) queda resuelto solo: no hay monto que mostrar.
- `consume_quota` y la monetización Fase 1 no se tocan.

### Pregunta abierta para BE (confirmar)

- **Nombre del valor:** usamos `pendiente_suscripciones`. Si BE prefiere otro (p.ej. `bloqueado_suscripciones`), decirlo antes del merge para ajustar la migración + db-types.
- **¿Quién setea `pendiente_suscripciones`?** Propuesta: BE lo usa como estado intermedio; el trigger sólo bloquea el paso a `activo`/`en_negociacion`. Si BE prefiere que la base lo fuerce vía trigger, avisar.

---

## C-02 · Arbitraje postergado — sin cambio de DB (nota para BE)

Opción A del cliente: el arbitraje no se implementa en esta etapa. **No hubo migración.** `legal_documents` v1.0 conserva las cláusulas H.5.1–H.6.1. No hay nada para BE del lado de DB; el único impacto es de FE (no exponer la opción de arbitraje). El riesgo de que los TyC ofrezcan un método no prestado queda anotado para el estudio, no es trabajo nuestro.

## C-06 · Servicio de abogado (ARS 50.000 + handoff WhatsApp) — nota para BE

Sin cambio de DB (la tabla `lawyer_requests` ya existe; `monto_minor` se congela en `5_000_000`). Es ticket de BE: el endpoint `POST /casos/:id/solicitud-abogado` **no existe en `apps/api`** (la tabla la entregó DB en Fase 1 y los endpoints quedaron como ticket aparte). El handoff por `wa.me` (fallback v1 del spec §7.5) es trabajo de FE; BE debe definir el payload de la solicitud pagada (número del estudio / URL armada + identificador corto, sin datos sensibles en la URL). La decisión #1 del spec (alcance del servicio) sigue abierta y es bloqueante para publicar.
