# Decisión DB — Flag de arbitraje por materia `FEATURE_ARBITRAJE_BIENES` (14/09/2026)

**Origen:** `docs/pedidos-post-auditoria-14-09.md` §1.3 (CAMBIOS-PACTUM-v2 §5).
**Capas:** DB (opcional) · Backend. **Estado:** parcial (hoy excluido "por diseño").

## Contexto
- El enum `metodo_caso` (`supabase/migrations/20260721191644_enums.sql:18-20`)
  solo admite `negociacion/conciliacion/mediacion`; no existe `arbitraje`.
- El TYC (`tyc_legal.sql` H.5/H.6) prohíbe arbitraje para familia.
- El cliente pide un flag **a nivel de materia, no global**: `FEATURE_ARBITRAJE_BIENES`,
  habilitado solo para materia `bienes`, nunca para familia.

## Decisión de modelo
- **No existe entidad `materia` en el schema** (no hay columna ni tabla). Introducir
  una taxonomía de materias completa excede el pedido.
- Se modela el flag **a nivel de caso** (granularidad de la materia del caso), lo que
  satisface "no global, por materia del caso":
  `casos.arbitraje_bienes_habilitado BOOLEAN NOT NULL DEFAULT false`.
- La regla de negocio "solo bienes, nunca familia" se valida en **Backend**; la DB
  solo almacena el flag. El TYC ya blinda familia.

## RLS / grants
- Sin cambios: el flag vive en `casos`, ya visible para partes del caso + admin.
  No es dato sensible.

## Alcance fuera de DB
- **Backend:** exponer/consumir el flag; validar que solo se habilita para `bienes`.
- **Frontend:** (opcional a futuro) toggle; hoy no bloquea nada.
