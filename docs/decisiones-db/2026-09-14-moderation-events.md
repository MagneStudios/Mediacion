# Decisión DB — Trazabilidad de moderación de lenguaje (14/09/2026)

**Origen:** `docs/pedidos-post-auditoria-14-09.md` §1.2 (CAMBIOS-PACTUM-v2 §7).
**Capas:** DB · Backend · Frontend. **Estado:** no implementado.

## Decisión de modelo
- Única tabla `moderation_events` (log append-only): `usuario_id`, `caso_id`,
  `texto_detectado`, `accion` (bloqueado|avisado|permitido), `scores` (jsonb),
  `created_at`. Sin `updated_at` (traza inmutable).

## Decisión de privacidad del log
- Se guarda **`texto_detectado` completo** (trazabilidad total). Por ser PII
  ofensivo, la tabla es **server-only**:
  - `service_role` (Backend) escribe.
  - `anon`/`authenticated` NO tienen SELECT (RLS deniega por defecto; además no
    se otorga GRANT de SELECT salvo a admin vía `is_admin()`).
  - Solo `admin` (rol autenticado con `public.is_admin()`) puede leer, para auditoría.

## Alcance fuera de DB
- **Backend:** servicio de moderación que escribe antes de procesar/mostrar
  cualquier texto libre de una parte.
- **Frontend:** componente de aviso al usuario (§3.3).

## No se hace ahora
- No se implementa el modelo de detección (responsabilidad de BE/IA).
- No se expone el log a partes ni mediadores.
