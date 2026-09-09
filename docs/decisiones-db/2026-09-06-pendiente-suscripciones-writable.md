# Decisión — `pendiente_suscripciones` escribible (C-01 follow-up)

**Fecha:** 06/09/2026
**Contexto:** C-01 (Opción A) agregó el valor `pendiente_suscripciones` al enum `estado_caso` y el gate `trg_casos_gate_suscripciones` que bloquea pasar a `activo`/`en_negociacion` si alguna parte no tiene suscripción activa. Pero **no se cablearon las transiciones** en `validate_caso_estado_transition()` (`supabase/migrations/20260810120000_cambios_reunion_07_08.sql:139`). Consecuencia: hoy cualquier `UPDATE … SET estado='pendiente_suscripciones'` muere con `Transición de estado inválida: nuevo → pendiente_suscripciones`. El front ya consume el estado (types/mapper/copy/elegibilidad en `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §3) pero ningún caso lo alcanza jamás.

**Decisión:**
1. Extender `validate_caso_estado_transition()` con las transiciones:
   - `nuevo → pendiente_suscripciones`
   - `pendiente_suscripciones → {activo, en_negociacion, terminado, vencido, expirado}`
2. **No tocar** el gate C-01 (`trg_casos_gate_suscripciones`): sigue lanzando `P0001` si no ambas partes tienen suscripción activa. **BE escribe `pendiente_suscripciones` en el catch del P0001** (no se modifica el trigger para que lo escriba).
3. Sin cambios a `db-types` (el valor ya existe desde C-01) ni a tablas.

**Alcance:** independiente del modelo de acuerdos por materia. Se puede hacer y commitear solo.

**Referencias:** `docs/pedidos-frontend-a-db-acuerdos-modulares.md` §3; `docs/decisiones-db/2026-09-02-c01-c02-cliente.md`; `docs/prompts-db/2026-09-06-pendiente-suscripciones-writable.md`.
