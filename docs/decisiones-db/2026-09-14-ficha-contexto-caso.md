# Decisión DB — Ficha de contexto del caso (14/09/2026)

**Origen:** `docs/pedidos-post-auditoria-14-09.md` §1.1 (CAMBIOS-PACTUM-v2 §9).
**Capas:** DB · Backend · Frontend. **Estado:** no implementado.

## Decisión de modelo
- **Tablas estructuradas** (no EAV). Un padre `caso_contexto` (1 por caso) + 6 hijas por dominio:
  `contexto_integrantes`, `contexto_actividades`, `contexto_colegio`,
  `contexto_cronograma`, `contexto_domicilios`, `contexto_restricciones`.
- Cada hija lleva `caso_contexto_id` (FK al padre) y `parte_id` (dueño de los datos).

## Decisión de privacidad
- **Por parte**: cada fila hija es visible SOLO para su `parte_id` y para admin.
  **Nunca la contraparte**, ni el mediador.
- RLS estilo tabla `items` (CA-02): `parte_id = (SELECT auth.uid())` en
  SELECT/INSERT/UPDATE/DELETE, más `OR public.is_admin()` en SELECT.
- El padre `caso_contexto` es neutro; su RLS permite a cualquier parte del caso
  + admin hacer SELECT (las hijas ya aplican el aislamiento real por `parte_id`).

## Alcance fuera de DB
- **Backend:** CRUD incremental por sección (alimenta el prompt del motor de propuestas).
- **Frontend:** formulario incremental por secciones (hoy mock en §3.2).

## No se hace ahora
- No se modela "compartido" (todo privado por parte, según instrucción).
- No se agrega lógica de IA en DB.
