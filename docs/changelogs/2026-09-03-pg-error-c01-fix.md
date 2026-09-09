# Changelog — Proyecto Mediación

## 2026-09-03 (cont.) — Código tipado para `caso_bloqueado_suscripciones`, y el CI de `dev` en verde

**Origen:** el fix pedido en `docs/pedidos-frontend-monetizacion.md` §3.6, y la causa real de por qué `ci-node` viene en rojo en `dev` desde el merge del gate C-01 (PR #115, 02/09).

---

### El bug de fondo: el gate bloqueaba el join de casos, y nadie lo vio hasta ahora

`invitaciones-hardening.integration.spec.ts` corre contra una base real y hace que dos usuarios se unan a un caso — `InvitacionesRepository.joinCase` transiciona el caso de `nuevo` a `activo` vía `CasosRepository.activateIfNuevo`. El trigger `trg_casos_gate_suscripciones` (C-01, `20260902120000_c01_gate_suscripciones.sql`) bloquea exactamente esa transición si alguna de las dos partes no tiene suscripción activa — y el fixture de este test nunca les dio una a ninguna. Dos de los cuatro tests fallaban con un `ConflictError` en vez de recibir el caso ya unido.

**No era un problema del test en el sentido de "estaba mal escrito"**: es que el gate cambió una regla real (para activar un caso hacen falta dos suscripciones al día) y el fixture, escrito antes de esa regla, no se enteró — el mismo patrón que ya movió `tmp/test_05_estados.sql` y compañía del lado de DB (`docs/changelogs-db/2026-09-02.md`). Ahora `giveActiveSubscription()` en el spec da de alta término aceptado + plan + suscripción `activa` para las dos partes, igual que hace `pagos-webhook.integration.spec.ts` para su propio usuario.

### El bug que sí era de código: `ConflictError` no distinguía nada

Antes de este fix, **cualquier** `P0001` de un trigger —el de C-01, el de re-aceptación de TyC, cualquier otro que exista o se agregue— caía en el mismo `ConflictError` genérico, con `{code: "conflict", message: "Conflict"}" y el texto real de Postgres escondido en `cause`. Nada en la respuesta HTTP permitía distinguir "te falta suscribirte" de cualquier otro 409.

`pg-error.ts` ahora reconoce el patrón `"slug: texto libre"` que ya usan varios triggers deliberadamente (`caso_bloqueado_suscripciones: ...`, `no_aceptacion_vigente: ...`) y lo resuelve contra un **allowlist explícito** (`knownTriggerConflicts`). Un slug que no está en el mapa —incluido cualquier `P0001` de antes de este cambio— sigue cayendo en el `ConflictError` genérico exactamente como antes: sumar un trigger al mapa es una decisión, no algo automático por tener la forma correcta.

Hoy el mapa tiene una sola entrada:

```json
{ "code": "caso_bloqueado_suscripciones", "message": "Both parties in the case need an active subscription" }
```

`ConflictError` ahora acepta `code` y `message` opcionales (con los defaults genéricos de siempre), así que los tres call sites existentes que lo instancian con un solo argumento no cambian. El detalle crudo de Postgres sigue yendo únicamente a `cause`, nunca a la respuesta — verificado con un test nuevo para el camino tipado, igual que ya existía para el genérico.

### Qué le sirve a FE de esto

El front ya modela `pendiente_suscripciones` (`docs/changelogs/2026-09-03.md`) pero no tenía cómo reaccionar al error del gate sin comparar contra el mensaje crudo de Postgres. Ahora puede matchear `response.code === "caso_bloqueado_suscripciones"`.

---

### QA

- Verificado contra una base Postgres real (no sólo specs unitarias): 38/38 migraciones aplicadas limpio, `invitaciones-hardening.integration.spec.ts` **4/4 en verde** con el gate C-01 activo.
- `pnpm --filter @mediacion/api test` completo: **156/156 suites, 1198/1198 tests**, contra la misma base real.
- `pnpm --filter @mediacion/api exec tsc --noEmit` — limpio.
- No se tocó ningún otro caller de `ConflictError`; los tres existentes siguen construyendo el genérico sin cambios.
