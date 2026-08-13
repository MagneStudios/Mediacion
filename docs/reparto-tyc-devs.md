# Implementación de Términos y Condiciones — Reparto por rol

**Anexo operativo al manual interno "Límites y responsabilidades de desarrollo"**
Fuente legal: *Instructivo de implementación de TyC — Golosetti Abogados de Startups*

---

## 00 · Cómo se usa este documento

El instructivo de Golosetti dice **qué** tiene que existir. Este anexo dice **quién de nosotros lo hace**, aplicando las mismas reglas de siempre: un dueño por cosa, la lógica baja nunca sube, y el orden de merge es DB → Backend → Frontend.

La checklist original del instructivo asigna casi todo a "Desarrollo". Eso no alcanza para repartir tickets: acá "Desarrollo" se abre en **DB**, **BE** y **FE**, y se separa lo que no es nuestro (Producto, Marketing, Administración).

> **LA REGLA QUE ORDENA TODO ESTE DOCUMENTO**
> El checkbox del front **no es la prueba de la aceptación**. Es cortesía de UI. La prueba es el registro que escribe el servidor, y la garantía de que no se pueda contratar sin aceptar es un constraint en Postgres. Si la única validación de aceptación vive en el front, es un incidente, no un bug.

---

## 01 · El reparto en una tabla

Cada punto del instructivo, con su dueño y de quién depende.

| # | Punto del instructivo | Dueño | Depende de |
|---|---|---|---|
| 1 | URL propia y permanente `/terminos-y-condiciones` (página, no PDF) | **FE** | — |
| 2 | Link en el footer de todas las páginas | **FE** | — |
| 3 | Link en registro, alta de cuenta y checkout | **FE** | — |
| 4 | Página legible en celular, sin zoom | **FE** | — |
| 5 | Fecha de última actualización visible arriba | **FE** | #10 (la lee de DB, no hardcodeada) |
| 6 | Checkbox NO pre-tildado, con link que abre en pestaña nueva | **FE** | — |
| 7 | Checkboxes separados: TyC+Privacidad / marketing (opcional) | **FE** | #9 |
| 8 | El botón de confirmar no se habilita sin la casilla tildada | **FE** | #11 (esto solo es la mitad) |
| 9 | Tabla `user_agreements` (esquema, índices, RLS append-only) | **DB** | — |
| 10 | Tabla `legal_documents` con el texto congelado de cada versión | **DB** | — |
| 11 | Constraint / RLS que impide contratar sin aceptación vigente | **DB** | #9 |
| 12 | Captura server-side de IP, user agent y timestamp con zona horaria | **FE** (Server Action) | #9, revisa **BE** |
| 13 | Retención mínima 5 años: sin borrado, sin update, sin cascade | **DB** | #9 |
| 14 | Export del log de aceptaciones en CSV/PDF | **BE** | #9 |
| 15 | Aviso de cambios por email a usuarios activos (mín. 10 días) | **BE** | #10, #16 |
| 16 | Aviso in-product + re-aceptación bloqueante si el cambio es sustancial | **FE** | #11, #15 |
| 17 | Botón de arrepentimiento visible en la primera pantalla, sin login | **FE** | #18 |
| 18 | Registro y notificación de la solicitud de arrepentimiento | **BE** | #9 |
| 19 | Botón de baja online, mismo medio que la contratación | **FE** | #20 |
| 20 | Baja efectiva: cancelar en la pasarela, cortar la recurrencia | **BE** | — |
| 21 | Razón social, CUIT y domicilio publicados | **FE** | contenido: Administración |
| 22 | Link a la Ventanilla Única Federal de Defensa del Consumidor | **FE** | — |
| 23 | Formulario de contacto (envío, routing, plazo declarado) | **BE** + **FE** | — |
| 24 | Precios en pesos, finales, con impuestos incluidos | **DB** (fuente) → **BE** (cálculo) → **FE** (muestra) | — |

**Fuera del equipo de desarrollo:** coherencia entre landing/anuncios y TyC (Marketing) · datos societarios reales (Administración) · alguien que efectivamente responda el canal de contacto (Operaciones) · registro de bases de datos personales ante la autoridad (Administración) · decisión de si un cambio es "sustancial" (Producto + legales).

---

## 02 · Base de datos — DB

**De qué es dueño acá:** de que la aceptación exista, sea inmutable y no se pueda esquivar.

### Le pertenece

- **Esquema de `user_agreements`.** Un registro por aceptación, nunca sobrescribir. Como mínimo: `user_id`, `document_type` (`terms` / `privacy` / `marketing`), `document_version`, `accepted_at timestamptz`, `ip inet`, `user_agent text`, `accepted boolean`.
- **Un registro distinto por tipo de documento.** Términos, Privacidad y marketing no comparten fila. Marketing puede ser `accepted = false` y eso también se guarda.
- **Esquema de `legal_documents`:** versión (`v1.0`, `v1.1`, `v2.0`), texto completo, `valid_from`, `valid_to`, `is_substantial`. El texto vive en la base, no en un `.md` del repo del front.
- **Append-only de verdad.** Sin `UPDATE` ni `DELETE` en la tabla de aceptaciones, para ningún rol. Se implementa con RLS y con un trigger que rechaza ambos. Un `ON DELETE CASCADE` desde `users` rompe la retención de 5 años: la FK va con `ON DELETE RESTRICT` o el `user_id` se conserva sin FK.
- **La regla que impide contratar sin aceptar**, viviendo en Postgres: constraint, trigger o política que rechaza el insert de la operación si no hay aceptación vigente de la versión actual. Esta es la que vale aunque la request no venga del front.
- **RLS de lectura:** el usuario ve solo sus propias aceptaciones. El export lo hace Backend con su propio rol.
- **Índices** para el export y para la consulta de "¿este usuario aceptó la versión vigente?".
- **Backup y política de retención** de estas dos tablas, tratadas como registro legal.

### Toca con acuerdo

- La función RPC `has_accepted_current(user_id, document_type)` que consumen Backend y Frontend — la escribe Backend, la revisa DB.
- Los campos que Frontend pide para la pantalla de re-aceptación.

### No toca nunca

- El componente del checkbox, el copy de la casilla, ni la maqueta de la página legal.
- El envío de los emails de aviso.

### Listo cuando

- La migración corre limpia sobre una copia con datos reales y el rollback está escrito y probado.
- Un intento de `UPDATE` o `DELETE` sobre `user_agreements` falla, probado con al menos dos roles distintos incluido el de servicio.
- Un insert de contratación sin aceptación vigente es rechazado por la base, probado llamando a PostgREST directo **sin pasar por el front**.
- Los tipos están regenerados y publicados.

---

## 03 · Backend — BE

**De qué es dueño acá:** de todo lo que sale del sistema o corre solo — avisos, exports, bajas y arrepentimientos.

### Le pertenece

- **Edge Function de aviso de cambio de versión.** Envía el email a todos los usuarios activos con la anticipación mínima de 10 días. Corre por `pg_cron` o se dispara al publicar una versión; nunca desde una request de UI.
- **Idempotencia del aviso.** Reintentar el job no puede mandar el mismo mail dos veces. Se registra qué usuario fue notificado de qué versión y cuándo.
- **Export del log de aceptaciones** en CSV y PDF, con filtro por usuario, rango de fechas y versión. Es lo que se entrega en un reclamo o en un due diligence: tiene que salir sin que nadie toque la base a mano.
- **Función de solicitud de arrepentimiento:** la registra, notifica a Operaciones y deja traza con timestamp. Accesible sin sesión iniciada.
- **Función de baja:** cancela la suscripción en la pasarela, corta la recurrencia y confirma por email. La secret key de la pasarela vive acá y solo acá.
- **Routing del formulario de contacto** y registro de la fecha de ingreso, para poder sostener el plazo de respuesta declarado.
- **Logs y alertas** de estos flujos: un aviso de cambio que falla en silencio es el peor caso posible.
- **La ficha y el fixture de cada una de estas funciones**, antes de que Frontend las integre.

### Toca con acuerdo

- La RPC `has_accepted_current(...)` — la escribe, DB la revisa.
- Pide a DB las columnas o índices que necesite para el export; no los crea.
- Revisa las Server Actions del front que capturan IP y user agent.

### No toca nunca

- Migraciones, esquema ni RLS de las tablas legales.
- El HTML de la página de Términos ni el modal de re-aceptación.

### Listo cuando

- La ficha de cada función está escrita, coincide con la implementación y tiene fixture real.
- El aviso de cambio corrido dos veces sobre el mismo release no duplica emails.
- El export baja un archivo legible con las seis columnas exigidas por el instructivo.
- La baja probada punta a punta deja al usuario sin cobro siguiente en la pasarela, verificado en el panel de la pasarela y no solo en nuestro log.
- Ningún secreto de la pasarela ni del proveedor de email quedó fuera del gestor de secretos.

---

## 04 · Frontend — FE

**De qué es dueño acá:** de que el usuario vea, pueda leer y pueda aceptar — y de que el servidor sea el que registra.

### Le pertenece

- **La ruta `/terminos-y-condiciones`** como página del sitio, renderizada desde `legal_documents`. No es un PDF, no es un link a Drive, no es texto hardcodeado en un componente.
- **La fecha de última actualización**, leída de la base y visible arriba de todo. Si está escrita a mano en el JSX, va a quedar vieja.
- **Los links:** footer de todas las páginas (incluidas home y checkout) y en el punto exacto de contratación — registro, alta de cuenta, carrito y botón de pago.
- **El checkbox**, con estas condiciones no negociables: vacío por defecto, nunca pre-tildado, el link abre en pestaña nueva (`target="_blank" rel="noopener"`) para que el usuario no pierda lo que estaba cargando, y el botón de confirmar deshabilitado hasta que se tilde.
- **Checkboxes separados.** Uno para Términos + Privacidad (obligatorio) y otro para comunicaciones comerciales (opcional, y que pueda quedar sin tildar sin bloquear la contratación).
- **La Server Action que registra la aceptación.** Acá está el punto fino: **la IP y el user agent se leen de los headers en el servidor**, nunca se mandan desde el cliente. La versión aceptada la resuelve el servidor consultando cuál está vigente, no la manda el formulario. Un payload del cliente que trae su propia IP o su propia versión es falsificable y no sirve como prueba.
- **La pantalla de re-aceptación** cuando hay cambio sustancial: bloqueante, con el texto nuevo visible y el diff o el resumen de qué cambió.
- **Botón de arrepentimiento en la primera pantalla**, accesible sin registrarse ni loguearse. No va en el footer ni dentro de la cuenta del usuario.
- **Botón de baja online**, alcanzable desde la cuenta sin llamar por teléfono ni escribir un mail.
- **Datos societarios, canal de contacto y link a la Ventanilla Única** publicados donde correspondan.
- **Precios mostrados en pesos, finales, con impuestos incluidos**, y el total desglosado antes de confirmar.
- **Que todo el flujo funcione en celular**, legible sin zoom.

### Toca con acuerdo

- Propone los campos que la pantalla de re-aceptación necesita; DB decide el esquema.
- Consume las funciones de Backend; no las reescribe ni replica su lógica.

### No toca nunca

- La tabla de aceptaciones ni sus tipos generados a mano.
- Las Edge Functions de aviso, export o baja.
- Cualquier API key de terceros.

### Listo cuando

- El flujo completo está probado en escritorio y en móvil, de punta a punta.
- Con la casilla sin tildar, el botón no se habilita **y** además el intento forzado por request directa es rechazado por la base.
- Cada aceptación deja una fila con IP y user agent que **coinciden con los headers del servidor**, verificado contra un caso donde el cliente manda datos falsos a propósito.
- La fecha de última actualización cambia sola al publicar una versión nueva, sin deploy.
- Los tres estados están cubiertos en las pantallas legales: cargando, vacío y error.
- No quedan mocks ni textos legales hardcodeados.

---

## 05 · Las cuatro fronteras de este módulo

Los únicos puntos donde dos roles se tocan. Se acuerdan antes de escribir código.

| Frontera | Qué se congela | Lo produce | Lo consume |
|---|---|---|---|
| Esquema de aceptaciones | Nombres y tipos de `user_agreements` y `legal_documents` + tipos generados | **DB** | FE, BE |
| ¿Aceptó la versión vigente? | Firma y respuesta de `has_accepted_current(...)` | **BE** (revisa DB) | FE |
| Registro de la aceptación | Qué escribe el servidor y qué **no** acepta del cliente | **FE** (revisa BE) | — |
| Publicación de versión | Qué evento dispara el aviso de cambio y con qué payload | **DB** → **BE** | FE (banner) |

> **REGLA DEL CONTRATO CONGELADO**
> Renombrar una columna de `user_agreements` después de aprobado el contrato requiere un PR propio y aviso explícito. Estas tablas son registro legal: un rename silencioso rompe exports de años anteriores.

---

## 06 · Orden de merge

Igual que siempre, y acá importa más que de costumbre:

**DB → Backend → Frontend.**

1. **DB primero.** Sin la tabla, el constraint y la RLS, cualquier cosa que haga el front es decorativa. No se abre ticket de checkbox antes de que la migración esté mergeada.
2. **Backend después.** Avisos, export, baja y arrepentimiento contra el esquema ya congelado.
3. **Frontend al final.** Puede trabajar en paralelo desde la fase 3 con mocks, pero no integra hasta que la ficha de cada función esté escrita.

Si un ticket de front está listo el lunes y depende de una columna que entra el miércoles, **espera**. Adelantarse es lo que produce rework.

---

## 07 · Checklist de cierre

Nadie da la implementación por cerrada hasta que todo esto tiene tilde.

### DB

- [ ] `user_agreements` creada, con un registro por tipo de documento
- [ ] `UPDATE` y `DELETE` rechazados, probados con dos roles distintos
- [ ] Sin `ON DELETE CASCADE` desde `users`
- [ ] Constraint o política que impide contratar sin aceptación vigente
- [ ] `legal_documents` con texto congelado, `valid_from` y `valid_to`
- [ ] RLS: el usuario lee solo lo propio
- [ ] Retención de 5 años garantizada por diseño, no por acuerdo verbal
- [ ] Rollback escrito y probado · tipos regenerados y publicados

### Backend

- [ ] Aviso de cambio de versión, con 10 días de anticipación, idempotente
- [ ] Export del log en CSV y PDF, con las seis columnas exigidas
- [ ] Solicitud de arrepentimiento registrada y notificada, sin sesión requerida
- [ ] Baja efectiva en la pasarela, verificada en el panel de la pasarela
- [ ] Formulario de contacto ruteado, con fecha de ingreso registrada
- [ ] Ficha y fixture de cada función · logs y alertas activos
- [ ] Ningún secreto fuera del gestor de secretos

### Frontend

- [ ] Página propia y permanente, renderizada desde la base (no PDF)
- [ ] Link en el footer de todas las páginas
- [ ] Link en registro, alta de cuenta y checkout
- [ ] Checkbox vacío por defecto, link en pestaña nueva
- [ ] Casillas separadas: TyC+Privacidad obligatoria / marketing opcional
- [ ] Botón de confirmar deshabilitado sin tildar
- [ ] IP, user agent, timestamp y versión resueltos **en el servidor**
- [ ] Fecha de última actualización visible y automática
- [ ] Pantalla de re-aceptación bloqueante para cambios sustanciales
- [ ] Botón de arrepentimiento en la primera pantalla, sin login
- [ ] Botón de baja online en la cuenta
- [ ] Razón social, CUIT, domicilio, contacto y link a Ventanilla Única
- [ ] Precios en pesos, finales, con total desglosado
- [ ] Flujo completo probado desde el celular

### Fuera de desarrollo

- [ ] Landing, anuncios y redes no prometen nada distinto a los TyC — **Marketing**
- [ ] Datos societarios correctos y actualizados — **Administración**
- [ ] Alguien responde efectivamente el canal de contacto — **Operaciones**
- [ ] Bases de datos personales registradas ante la autoridad — **Administración**
- [ ] Criterio de "cambio sustancial" definido y por escrito — **Producto + legales**

---

## 08 · Los cinco errores que hay que evitar

1. **Publicar los Términos como PDF descargable.** Es la falla más común y la más fácil de evitar. Va como página web.
2. **Que la única validación de la aceptación viva en el front.** Deshabilitar un botón no es una garantía; es un `disabled` que se saca con la consola abierta. La garantía está en la base.
3. **Confiar la IP y el user agent al cliente.** Si vienen en el payload del formulario, cualquiera los inventa y la prueba no sirve.
4. **Hardcodear el texto legal o la fecha en el front.** El día que cambie el documento se va a olvidar, y la fecha visible va a mentir.
5. **Un `ON DELETE CASCADE` que borra las aceptaciones al borrar el usuario.** Silencioso, razonable a primera vista, y destruye exactamente lo que hay que conservar cinco años.

---

## 09 · Cuándo esto vuelve a legales

No por cada ajuste. Sí cuando pasa algo de esto — y avisamos **antes** de deployar:

- Cambia el modelo de negocio o la forma de cobrar
- Empezamos a vender fuera de Argentina (UE, EE.UU., Brasil)
- Empezamos a tratar datos sensibles o de menores
- Sumamos funcionalidades con IA que procesen contenido o datos de usuarios
- Nos convertimos en intermediarios: marketplace, pasarela, API pública
- Hay ronda de inversión a la vista — en el due diligence piden los TyC y **la prueba de las aceptaciones**
- Pasaron 12 meses desde la última revisión

---

*Este anexo traduce a tareas de equipo el instructivo de Golosetti Abogados de Startups. No reemplaza el asesoramiento legal sobre el caso concreto: ante cualquier duda de las que aparecen acá, se consulta antes de publicar.*
