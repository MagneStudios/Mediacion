# Conectar `mediacion-app` a un backend real

**Autor:** Frontend · **Última actualización:** 25/08/2026

Cómo apuntar la app a una API viva en vez de a los mocks, y qué verificar la primera vez. Es también el checklist de lo que quedó **deducido y no observado** en las integraciones de la rama `feat/frontend-integracion-planes`.

Los valores no están en este documento a propósito: se piden por `docs/pedidos-frontend-a-backend.md` §10 y viven en un `.env` local que no se commitea.

---

## 1 · Cómo elige la app entre API y mock

No hay flag ni build variant. `services/backend-instance.ts` construye el backend una sola vez por proceso, y devuelve `null` si la configuración no está completa:

```
config/env.ts  →  isApiConfigured()  →  createBackend()  →  backend | null
                                                                 ↓
                                   cada services/*.service.ts elige backed o mock
```

Con `backend === null` **toda la app corre sobre mocks y sigue siendo usable offline**. No hay pantalla en blanco ni error de arranque: una configuración incompleta degrada, no rompe. Eso también significa que **un `.env` mal escrito se ve exactamente igual que no tener `.env`** — si algo "no está pegándole a la API", eso es lo primero a descartar (§4).

Las tres variables van a `mediacion-app/.env` (plantilla en `mediacion-app/env.example`):

| Variable | Notas |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Sin barra final; se le quita igual si la tiene |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Anon, nunca `service_role`** — ver abajo |
| `EXPO_PUBLIC_API_URL` | Base de la API de Nest, sin barra final |

`config/env.ts` decodifica el payload del JWT de la anon key y **se niega a arrancar** si encuentra `"role":"service_role"`. No es paranoia: Expo inlinea estos valores dentro del bundle del cliente, así que esa key ahí es RLS bypasseado para cualquiera que abra las devtools. Si el arranque falla con ese mensaje, el problema es la key, no el código.

Expo inlinea los `EXPO_PUBLIC_*` **en build time**. Cambiar el `.env` con el server corriendo no hace nada: hay que reiniciar.

---

## 2 · Auth

No hay `/auth/login` en la API. El front habla **directo con Supabase** (`supabase-js`) y manda el access token como `Authorization: Bearer <jwt>` en cada request; `services/api/http-client.ts` pide el token en cada llamada en vez de capturarlo una vez, porque Supabase lo refresca en segundo plano y uno capturado se vuelve viejo a mitad de sesión.

Del lado de la API, el guard verifica el JWT (HS256, `SUPABASE_JWT_SECRET`, audiencia `authenticated`) y después **carga el usuario de `public.usuarios` por `sub`**. Si no hay fila, responde `401 user_not_provisioned` — un login válido contra un usuario no provisionado. El trigger `on_auth_user_created` la crea en el signup.

Desde el 25/08 el hook `custom_access_token` agrega `rol`, `estudio_id` y `nombre_completo` al JWT. **La app no los lee y no hace falta que los lea**: el rol sale de `GET /me`, que es el estado actual, mientras que el claim es una foto del momento en que se emitió el token y queda viejo hasta el próximo refresh.

Los usuarios dev y sus credenciales están en `docs/changelogs-db/2026-08-25.md`. Hay uno por rol (`parte`, `mediador`, `admin`, `estudio`), lo cual importa: varias pantallas están gateadas por rol y hasta ahora sólo se podían ver navegando a mano.

---

## 3 · CORS (sólo Expo Web)

Nativo ignora CORS. El navegador no.

`applyCors` (`apps/api/src/main.ts`) es **opt-in**: con `CORS_ORIGINS` sin setear no habilita CORS en absoluto, para que un deploy sin configurar no quede abierto por accidente. Contra una API desplegada, desde el navegador y sin esa variable, **no entra una sola request** — y el síntoma es un error de red genérico, no un 403, así que es fácil confundirlo con "la API está caída".

Expo Web corre en `http://localhost:8081`.

---

## 4 · Verificar que efectivamente está pegándole a la API

Antes de sacar conclusiones de cualquier pantalla:

1. **¿Se construyó el backend?** En la consola del navegador, una request a `/casos` o `/planes` en la pestaña de red. Si no hay ninguna, `backend` es `null` y estás mirando mocks (§1).
2. **¿Va con token?** El header `Authorization: Bearer …` tiene que estar. Sin sesión no se manda, y la respuesta es 401.
3. **¿El caso es el mismo?** Los mocks tienen ids propios (`case-1`, `plan-base`, `agreement-case-3-1`). Un id así en la pantalla es un mock; la API devuelve uuids.

---

## 5 · Qué verificar la primera vez

Lo que sigue está **deducido del código y no observado en el cable**. Ninguna spec de backend lo fija, así que hasta que alguien lo mire, nadie lo sabe.

### 5.1 · `GET /planes` — ¿`precio` es string o number?

`planes.precio` es `numeric(10,2)`. El tipo de BE dice `number`, pero `pg` devuelve `numeric` como **string** salvo que se registre un type parser, y `apps/api/src/database/kysely.provider.ts` no registra ninguno.

`services/api/plans.api-service.ts` acepta los dos y falla la lectura si no puede leer el valor — un `precio` ilegible **no** se convierte en `0`, porque eso renderizaría el plan como gratis.

**Qué mirar:** el body crudo de `GET /planes`. Si es `"precio": "9.99"`, avisarle a BE: cualquier consumidor que haga aritmética sobre ese campo se lleva una sorpresa, y nuestro mapper es el único lugar donde hoy está contemplado.

### 5.2 · `GET /casos/:id/invitaciones` — el shape de `InvitacionView`

Leído de `apps/api/src/invitaciones/invitaciones.types.ts`, nunca visto en el cable. Confirmar que llegan `id`, `caso_id`, `tipo`, `token`, `email_destino`, `estado`, `fecha_envio`, `created_at` — y que **`pago_a_cargo` no está**, que es lo que nos obligó a hacer `CaseInvitation.pagoACargo` nullable (pedido en §8 del doc de pedidos).

### 5.3 · El catálogo de planes

Si Cloud tiene aplicada la Fase 1 de monetización, van a aparecer **seis planes** —tres de un modelo de precios que ya no existe— y `corporativo` se va a ver **gratis**, porque su `precio` es `0.00` igual que el de `base`.

**No es una regresión de la integración del catálogo y no se arregla desde el front.** Es `docs/pedidos-frontend-monetizacion.md` §5.1 y §5.2, abierto, y se arregla en la fuente.

### 5.4 · El ABM de admin queda de sólo lectura

Con `dev-admin@mediacion.test`, `app/admin/planes` lista el catálogo real y sus tres acciones (crear, editar, borrar) **fallan con el estado de error de cada pantalla**.

Es deliberado: la API expone `GET /planes` y nada más. Delegarlas al mock habría reportado un éxito que el servidor nunca vio, con la lista releyendo el servidor un segundo después y el plan "creado" sin aparecer. Se cierra cuando existan los endpoints de escritura, no antes. Detalle en `services/api/plans.backed-service.ts`.

### 5.5 · Checkout y facturas siguen simulados

`GET /suscripciones/vigente` y `POST /suscripciones/:id/baja` son reales; el checkout y las facturas no, porque `POST /suscripciones/:id/pago` devuelve un `init_point` de Mercado Pago en vez de confirmar un cobro, y no hay endpoint de factura.

**Consecuencia visible:** con backend configurado, suscribirse por el checkout demo **no** aparece en "Mi plan", porque esa pantalla refleja la fila real de `suscripciones`. Es la verdad del estado actual, no un bug. `services/api/billing.backed-service.ts` lo explica.

### 5.6 · Export de acuerdo

`GET /acuerdos/:id/exportar` es el **único endpoint de la API que no contesta JSON** (`text/plain`). Tiene su propia puerta en el cliente HTTP (`requestText`); los errores sí siguen siendo el envelope de siempre.

La app **no guarda archivos** (no hay `expo-file-system` ni `expo-sharing`): trae el texto, lo muestra y lo ofrece al portapapeles. El `Content-Disposition` que manda el servidor no se lee — en Expo Web es invisible sin `Access-Control-Expose-Headers` (§9 del doc de pedidos) y no hay archivo que nombrar.

---

## 6 · Qué NO hacer

- **No commitear el `.env`.** `mediacion-app/env.example` es la plantilla; el `.env` es local.
- **No poner la `service_role` key** en el slot de la anon. El guard de `config/env.ts` la rechaza, pero el guard es la última línea, no la primera.
- **No "arreglar" desde el front lo que sale mal del catálogo.** Si la API trae planes que no van, se arregla en la fuente. Está por escrito en `docs/pedidos-frontend-monetizacion.md` §5.2 y no cambió.
- **No dar por bueno un mock que se parece.** Si un id se ve como `case-1` o `plan-base`, estás mirando el mock (§4).
