# Deuda técnica: has_accepted_current EXECUTE a authenticated

**Fecha:** 2026-08-18
**Origen:** Auditoría DB post-migración TyC
**Estado:** ✅ Cerrada (2026-08-21)
**Severidad:** Media

## Problema

La migración `20260817140000_has_accepted_current_vigencia.sql` (líneas 100-101) contiene:

```sql
GRANT EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT)
  TO service_role, postgres, authenticated;
```

Esto **contradice** la decisión 2 del diseño original (`20260814170000`, sección "Permisos"):

> `has_accepted_current` es un helper de servidor que el BE consume vía `selectNoFrom` como SECURITY DEFINER (EXECUTE solo para service_role/postgres, nunca lo llama la FE como RPC)

La migración comenta "Los permisos de 20260814170000 se mantienen" pero en realidad agrega `authenticated` al GRANT.

## Impacto de seguridad

Cualquier usuario autenticado puede invocar `has_accepted_current(user_id, tipo)` como RPC vía PostgREST y sondear si un `user_id` arbitrario aceptó los términos. Retorna un boolean (no datos sensibles), pero permite inferir existencia/actividad de usuarios.

## Origen del cambio

Vino del branch `dev` (commit 20260817140000), no del implementador de QA. El cambio fue necesario para que el test `validate_rls.py` pasara (el test viejo esperaba "denied para authenticated" y ahora fallaría).

## Acción requerida

Confirmar con PM/BE:
1. ¿Es intencional que `authenticated` tenga EXECUTE sobre `has_accepted_current`?
2. Si es intencional: actualizar la decisión 2 del diseño DB (line ~ del diseño original) para reflejar el nuevo GRANT.
3. Si NO es intencional: revertir a `GRANT ... TO service_role, postgres` (quitar `authenticated`) y restaurar el test de `validate_rls.py` a `authenticated` denied.

---

## Resolución (2026-08-21)

**Decisión:** Revertir el GRANT. La función es helper de servidor; BE la llama vía `selectNoFrom` como SECURITY DEFINER. No hay caso de uso legítimo para que `authenticated` la invoque como RPC.

**Migración:** `20260821000000_revert_has_accepted_current_grant.sql`
- `REVOKE EXECUTE ON FUNCTION public.has_accepted_current(UUID, TEXT) FROM authenticated;`

**validate_rls.py:** test "has_accepted_current denegado para authenticated" agregado.

**Estado final de permisos:** EXECUTE solo para `service_role` y `postgres`.
