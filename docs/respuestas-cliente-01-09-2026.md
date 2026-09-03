# Respuestas del cliente 01/09/2026 — qué se destraba, qué se cancela, qué sigue trabado

**Fuente:** `pactum_respuestas_cliente.pdf` (Solmi & Asociados, 01/09/2026), cierre de las siete consultas de `Consultas_Cliente_Pactum_2808.docx`.
**Actualiza:** `docs/plan-implementacion-27-08-2026.md` §6 (las ocho preguntas) y `docs/PACTUM-monetizacion-spec.md` §13 (decisiones pendientes).
**Assets recibidos:** `refugio.zip` — el logo del punto 6.

---

## 0 · Resumen

De los siete puntos, **dos se destraban del todo, uno se cancela entero, dos resuelven la mitad y dos siguen trabados por lo mismo que antes**.

| # | Respuesta | Efecto real |
|---|---|---|
| 1 | Pago compartido → **opción A** | 🟢 **C-01 se achica de semanas a un ticket chico.** Se cae `case_payments`, el precio por caso y el 50/50 |
| 2 | Asesoramiento → **cambio de flujo** | 🔴 **C-06 se cancela entero** · 🟡 el botón de abogado sigue deshabilitado · 🟢 aparece el handoff por WhatsApp |
| 3 | `soportepactum@gmail.com` | 🟡 Llena un `[COMPLETAR]` de los TyC, no destraba los textos legales · **tarea nuestra: crear la casilla** |
| 4 | Arbitraje postergado | 🔴 **No contesta la pregunta que hicimos.** Los TyC lo siguen ofreciendo |
| 5 | Texto de negociación → **se quita la frase** | ✅ **C-03 cierra como no-op.** La frase nunca se agregó |
| 6 | Logo → cuatro personas en un cuadrado | 🟢 **C-07 se destraba en assets.** La publicación sigue trabada |
| 7 | Acuerdo → **uso modular** | 🟡 Cambia la arquitectura de C-08 y **sigue sin llegar el acuerdo marco** |

**Lo único que se puede empezar hoy, sin pedirle nada a nadie, es el logo.** Todo lo demás o es cerrar tickets, o espera un dato.

---

## 1 · Pago compartido — opción A

> *"Cada parte paga su propia suscripción de forma independiente. No se implementa un esquema de pago único dividido entre las partes."*

**Es la respuesta que achica el punto más grande del pedido.** Se cae todo lo que §3.1 del plan del 27/08 describía como la lectura (b):

- la tabla `case_payments` que sugería el documento del cliente,
- el precio por caso configurable,
- las dos órdenes de pago de Mercado Pago,
- el 50/50 y la política de reembolso que lo condicionaba,
- el estado intermedio `pendiente_pago_contraparte` **queda a confirmar** (ver abajo).

**Y desactiva un bloqueante que ya habíamos escalado a BE.** `pago_a_cargo` en `GET /casos/:id/invitaciones` (§8 de `docs/pedidos-frontend-a-backend.md`, deuda anotada en `services/api/cases.backed-service.ts:69`) se había convertido en bloqueante porque no se le puede mostrar a alguien un monto con un dato que el front recuerda solo. Con la opción A **no hay monto que mostrar**: cada uno paga su plan completo, que ya conoce. Vuelve a ser lo que era — comodidad, no bloqueo.

**Lo que queda por confirmar, y es barato.** Hoy el selector de `app/case/create/invite.tsx:21` tiene dos opciones:

- `invitador` — *"Yo pago · La suscripción queda a tu cargo."*
- `invitado` — *"Paga la otra parte · La otra parte va a tener que suscribirse para acceder al caso."*

La opción A leída al pie de la letra es **`invitado` siempre**, y deja `invitador` sin sentido. Pero `invitador` es exactamente lo que el cliente pidió como R-07 en la reunión del 07/08 y está implementado. O sea: la respuesta del 01/09 puede estar contradiciendo el pedido del 07/08 sin darse cuenta, porque las dos preguntas se hicieron por separado.

**Las dos lecturas y su costo en FE:**

- **Sigue existiendo el selector** (el que crea puede hacerse cargo de la suscripción del otro, o no) ⇒ **cero trabajo**. Lo que hay ya cumple.
- **Se elimina el selector** (todos pagan lo suyo, siempre) ⇒ sacar la sección de `invite.tsx`, sus claves de i18n, los dos tests de `invite-screen.test.tsx:61,95`, y revisar el gate de `app/case/[id]/payment-required.tsx`.

Ninguna de las dos es cara. Pero son opuestas, así que hay que preguntar antes de tocar nada.

**Dueño:** sigue siendo DB → BE → FE. El carril de FE es el último y ahora es mínimo.

---

## 2 · Asesoramiento — cambio de flujo

> *"Se elimina el envío por correo del asesoramiento. El precio del servicio pasa a $50.000 pesos. Una vez confirmado el pago, se genera un enlace de WhatsApp con un mensaje precargado de confirmación de pago, dirigido al número del estudio jurídico de Victor, para coordinar la consulta."*

Tres cosas distintas en un párrafo. Conviene separarlas porque cada una cae en un lado diferente.

### 2.1 · C-06 se cancela entero — no se construye

**Toda la Fase 1 del plan del 27/08 queda sin objeto.** No se hace:

- el componente de asesoramiento con la cadena `mailto:` → Gmail web → copiar dirección,
- `EXPO_PUBLIC_CONTACTO_ASESORAMIENTO_EMAIL` en `config/env-source.ts` y `env.example`,
- las claves de i18n del botón y del mail precargado,
- las tres ubicaciones (Ayuda, detalle del caso, fin de negociación sin acuerdo).

Y con eso **se resuelven solas las dos colisiones de §3.6** sin trabajo de copy: no hay botón gratis que se coma al servicio pago, y `app/contacto.tsx` vuelve a ser el único canal libre — el que exigió el punto #23 del instructivo de Golosetti, con su código `CON-nnnn` y su plazo auditable. No hace falta desambiguar nada en Ayuda.

### 2.2 · El precio cambia: ARS 40.000 → ARS 50.000

En unidades mínimas, `5_000_000`. Toca:

- `services/lawyer.service.ts:38` — el fixture `mockFee` del mock,
- `types/lawyer.ts:21` y `LawyerRequestButton.tsx:27` — los comentarios que citan el monto,
- `utils/format-money.ts:5` y `utils/__tests__/format-money.test.ts` — usan 4.000.000 como caso de ejemplo (es un test de formateo, no del precio: se puede dejar, pero el comentario miente),
- `features/lawyer/components/__tests__/LawyerRequestButton.test.tsx:135`,
- `docs/PACTUM-monetizacion-spec.md` §7.3 y `LAWYER_FEE_ARS_MINOR` en config (dueño BE).

**Falta el equivalente en USD.** El spec §7.3 define el precio en dos monedas (ARS 40.000 **o** USD 30, según el país de la cuenta). El cliente movió sólo el peso. Si el USD sigue en 30, el servicio pasa a costar bastante menos afuera que acá; si no, hace falta el número.

### 2.3 · El botón sigue deshabilitado — esto es lo importante

**La respuesta describe cómo se coordina la consulta, no qué se entrega.** La decisión #1 del spec sigue abierta:

> *"¿Qué incluye exactamente el servicio de abogado de ARS 40.000? Alcance, plazo, entregable"* — §13, marcada **bloqueante para publicar**: "no se puede cobrar sin decir qué se entrega".

En el código eso es `LawyerServiceOffer.scope` y `responseHours`, los dos `null` a propósito (`types/lawyer.ts:32`). Mientras `scope` sea `null`, `canPay` es `false` y el modal muestra el texto de bloqueo en vez de un alcance inventado (`LawyerRequestButton.tsx:88`).

**Subir el precio sin definir el alcance empeora el problema**, no lo mejora: ahora son $50.000 por algo que seguimos sin poder describir. Hay que volver a pedirlo, y explícitamente: qué incluye (¿consulta puntual? ¿patrocinio del caso?) y en cuánto responde el estudio.

### 2.4 · Lo que sí se destraba: el handoff por WhatsApp

Y es una respuesta mejor de lo que parece, porque **el spec ya lo tenía previsto**. §7.5 planteaba dos caminos para avisarle al estudio cuando alguien paga:

- automatizado, con WhatsApp Business Cloud API (Meta) o Twilio — número verificado, cuenta business, plantillas pre-aprobadas, ventana de 24 h;
- **fallback v1: un botón `wa.me` con el mensaje precargado para que el usuario mismo inicie la conversación.**

El cliente eligió el fallback. Eso **cierra la decisión pendiente #7** ("proveedor de WhatsApp para el handoff") sin contratar nada: no hace falta Meta ni Twilio para v1. Y de yapa abre la ventana de 24 h del lado de Meta, que era el otro beneficio que el spec anotaba.

**Trabajo de FE, que es nuevo y es nuestro:**

- pantalla/CTA post-pago con el deep link `wa.me`, vía `Linking.openURL`. **No hay integración de WhatsApp en el proyecto** — el único precedente de abrir una app externa es `features/legal/components/CompanyDetails.tsx:79`;
- el mensaje precargado, en i18n, con `encodeURIComponent`;
- fallback para web y para el caso "no tiene WhatsApp": mostrar el número con botón de copiar, mismo criterio que teníamos pensado para el mail;
- **restricción del spec §7.5 que hay que respetar: nunca datos sensibles de la negociación en la URL de `wa.me`, sólo un identificador corto.** El "mensaje de confirmación de pago" que pide el cliente entra bien en eso — número de solicitud y nada más.

**Lo que falta para poder entregarlo:** el **número de WhatsApp del estudio**. Misma categoría que la casilla de mail: es un dato de Administración, no una decisión de producto. Va como `EXPO_PUBLIC_ESTUDIO_WHATSAPP` en `config/env-source.ts`, o mejor viajando en el payload de la oferta si BE lo prefiere.

**Y una dependencia real de orden.** *"Una vez confirmado el pago"* es el webhook de Mercado Pago. `POST /casos/:id/solicitud-abogado` **no existe en `apps/api`** — DB entregó la tabla `lawyer_requests` en la Fase 1 y los endpoints quedaron como ticket aparte (`services/lawyer.service.ts:7`). FE puede construir la pantalla contra el mock, pero el disparador real es de BE.

**Lo que sí se puede congelar ya:** `docs/plan-frontend-monetizacion.md` §4.4 dejó los shapes del endpoint sin congelar a propósito, porque el alcance del servicio cambia qué muestra la pantalla. El alcance sigue sin definirse — **pero la parte de WhatsApp sí se puede cerrar ahora**: la solicitud pagada necesita devolver el número del estudio (o la URL armada) y el identificador que va en el mensaje. Eso no depende de la decisión #1.

---

## 3 · Casilla de correo

> *"Se utiliza una única casilla de correo... La cuenta no existe todavía y debe darla de alta el equipo de desarrollo. Casilla a crear: `soportepactum@gmail.com`"*

**Con C-06 cancelado, esta casilla ya no es para el botón de asesoramiento.** Sirve para tres cosas distintas:

1. **Los `[COMPLETAR: casilla de contacto]` de los textos legales.** Aparecen en seis lugares de `mocks/legal-texts.ts` y su migración: cláusula D.2 (casilla de bajas), O.1 (arrepentimiento), W.3 (domicilio electrónico de la Empresa), Y.1 y Y.2 (contacto y datos de la empresa) y A.3 de la Política de Privacidad (responsable de datos personales).

   ⚠️ **Pero esto no destraba los textos legales.** En las mismas cláusulas siguen abiertos `razón social`, `CUIT` y `domicilio legal`, y los tres dependen del alta de la SAS. La casilla tapa un agujero de seis; quedan los demás.

   Ojo con una: el cliente dice *"todos los mensajes llegan a la misma dirección"*, pero A.3 de la Política de Privacidad es la casilla del **responsable de datos personales** (Ley 25.326). Que sea la misma dirección es válido; que sea la misma **bandeja sin ningún ruteo** es lo que después hace que un pedido de acceso a datos con plazo legal se pierda entre consultas comerciales.

2. **El respaldo por mail del handoff.** §7.5 es explícito: *"En paralelo, siempre enviar un email al estudio con el mismo contenido. WhatsApp es el canal preferido, el email es el respaldo auditable."* Con el handoff ahora manual, este respaldo importa **más**, no menos: si el usuario no toca el botón de WhatsApp, el mail es lo único que le avisa al estudio que hay un caso pagado. Es de BE.

3. **El destino de `POST /legal/contacto`.** También BE.

**Tarea que nos queda a nosotros y no es código:** dar de alta la cuenta. El cliente lo delegó explícitamente.

**Una observación técnica que conviene decir una vez:** `soportepactum@gmail.com` funciona como casilla de recepción, pero **no puede ser el remitente de los mails transaccionales de la plataforma**. El spec §10.1 pide SPF + DKIM + DMARC sobre el dominio propio y lo marca como crítico ("los emails de pago no pueden caer en spam"). Un `@gmail.com` no permite configurar nada de eso. Para recibir está bien; para enviar hay que esperar el dominio.

---

## 4 · Arbitraje — la respuesta no contesta la pregunta

> *"El arbitraje se deja de lado por el momento, al menos en esta fase del proyecto. No se desarrolla en la versión actual."*

**Eso ya lo sabíamos, y no era la pregunta.** Confirma el lado de producto —que no hay que implementarlo— y de paso confirma que la decisión de §3.2 fue la correcta: **no agregamos `arbitraje` al enum `metodo_caso` detrás de un feature flag**, porque sería un valor muerto que igual va a necesitar su migración el día que exista.

Lo que preguntamos era otra cosa:

> *"¿Se eliminan esas cláusulas o se dejan marcadas como no disponibles por ahora?"*

Las cláusulas **H.5.1 a H.6.1** de los TyC vigentes (`supabase/migrations/20260814170000_tyc_legal.sql:480-496`, espejadas en `mocks/legal-texts.ts:172`) describen un servicio de arbitraje ad hoc completo: acuerdo arbitral por firma electrónica, designación de árbitros, sede, idioma, plazo de laudo, materias excluidas por el art. 1651 CCyC. **Los Términos le siguen ofreciendo al usuario un método que la plataforma no presta.** Eso no lo arregla decir "se posterga".

**Sigue trabado, mismo dueño (DB), misma pregunta.** Sugerencia para reformularla: como el propio cliente dice *"por el momento"* y *"al menos en esta fase"*, marcarlas como no disponibles parece más consistente que eliminarlas — pero es decisión del estudio, y arrastra lo de siempre: los TyC son versionados y `has_accepted_current` matchea por versión exacta, así que tocar el articulado puede mandar a **todos los usuarios activos** a reaceptar. Hay que definir si va con `is_substantial = true`.

La tarea de FE que depende de esto (espejar el mock, verificar `ReacceptanceGate` y `VersionNoticeBanner` con la versión nueva) queda igual de bloqueada que antes.

---

## 5 · Texto de negociación — cierra como no-op

> *"Se quita la siguiente frase: «La plataforma velará por que se respeten las formas y las normas de orden público». El resto del texto queda aprobado sin modificaciones."*

**No hay nada que quitar: la frase nunca se agregó.** El punto C-03 del 27/08 pedía **agregarla**; la dejamos sin escribir porque le atribuía a la plataforma un deber de control que va en contra de lo que fijan los propios TyC (cláusula H.5.7: la Empresa no administra, no controla plazos ni actuaciones, su intervención se limita al soporte tecnológico). El estudio revisó y la retiró.

El valor vigente en `i18n/locales/es-AR.json` → `caseCreation.method.descriptions.negociacion` es:

> *"Las partes intercambian propuestas y buscan un punto de acuerdo."*

**Es el segundo punto de esta tanda que se resuelve en "ya estaba bien"**, después de C-04. **El ticket se cierra sin cambio de código.** Vale dejarlo escrito para que no quede abierto esperando un commit que no va a existir.

*Salvedad chica:* "el resto del texto queda aprobado" es ambiguo respecto de **cuál** texto — lo más natural es que sea la descripción actual, que es lo único que hay. Se da por aprobada así; si el estudio tenía otro párrafo en mente, es una confirmación de un renglón.

---

## 6 · Logo — lo único que se puede empezar hoy

> *"Se avanza con el último logo presentado: cuatro personas dentro de un cuadrado."*

Es el pack **`refugio.zip`**: cuatro figuras (dos mayores, dos menores) dentro de un contenedor redondeado, trazo uniforme de 7 unidades, `viewBox 12 12 236 236`.

**Lo que trae:** cuatro variantes SVG (`oscuro` #2E6E8E para fondo claro, `claro` #A8D2E4 para fondo oscuro, `negro`, `blanco`) y las mismas en PNG con fondo transparente a 512, 1024 y 2048.

> ✅ **Hecho el 01/09** — ver `docs/changelogs/2026-09-01.md`. Componente `Logo` en el design system, assets de `app.json` regenerados, y el placeholder del `DesktopSidebar` reemplazado. Las dos salvedades de abajo (favicon a 16 px, entregables faltantes) se confirmaron al hacerlo y siguen abiertas.

**Trabajo de FE que se destraba ahora:**

- reemplazar `assets/images/`: `icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `favicon.png`, `splash-icon.png`. Se generan del SVG o del PNG de 2048;
- de paso, borrar `partial-react-logo.png` y los tres `react-logo*.png`, que son restos del template de Expo;
- **agregar un componente `Logo` al design system, que hoy no existe.** `react-native-svg@15.12.1` ya es dependencia, así que entra directo. El LEEME recomienda reemplazar el `stroke` por `currentColor` para tener un archivo único que sirva en tema claro y oscuro — es lo que conviene, porque además evita tocar la paleta (ver abajo).

**Cuatro cosas que conviene decir antes de empezar:**

1. **Contradice el brief del spec.** `docs/PACTUM-monetizacion-spec.md` §10.2 especifica *"una familia de 3 personas"* en composición triangular, y explica el porqué: la doble lectura "dos partes y un tercero en el centro", que se lee como familia y como mediación a la vez. **Cuatro figuras pierden esa lectura.** No es nuestra decisión —el cliente eligió— pero el §10.2 hay que actualizarlo, o el próximo que lo lea va a encargar el logo viejo.

2. **El favicon no va a entrar como pide el spec.** §10.2 exige que el isotipo se lea a **16×16 px**. El LEEME del pack dice: *"Tamaño mínimo recomendado: 32 px. Por debajo se juntan las piernas de las figuras del medio."* Es un conflicto concreto, y `favicon.png` es exactamente ese caso. O se pide una variante simplificada para tamaños chicos, o se acepta que a 16 px se empaste. Mejor resolverlo ahora que después de publicar.

3. **El azul del pack no es el nuestro.** `#2E6E8E` contra `colors.primary: '#3F6F9E'` (`design-system/tokens/colors.ts:21`). Son parecidos pero distintos. **Con `currentColor` el problema no existe** — el logo hereda el token y no hay que mover la paleta. Es el camino recomendado.

4. **Falta la mitad de los entregables.** El pack tiene sólo el **isotipo**. §10.2 pide además logotipo, lockup horizontal y vertical, y OG image 1200×630. No bloquea el ícono de la app; sí bloquea el header de la web y cualquier pieza de marketing. Y el pack se llama "refugio", no "Pactum" — presumiblemente el nombre interno del diseñador, pero conviene confirmarlo.

**Lo que sigue trabado:** `app.json` no tiene `android.package` ni `ios.bundleIdentifier`, y `name` sigue en `"mediacion-app"`. Todo eso depende del **nombre para las tiendas**, que era la pregunta 7 de §6 del plan y **el cliente no la contestó**. El bundle id es prácticamente permanente una vez publicado —cambiarlo es una app nueva, sin reseñas ni instalaciones—, así que **la publicación sigue bloqueada aunque los assets ya estén.** Tampoco hay novedades de la SAS ni del INPI.

---

## 7 · Modelo de acuerdo — cambia la arquitectura, no destraba

> *"No se utiliza el acuerdo marco completo. Según de qué trate la conciliación o negociación, se utilizará una o varias partes del acuerdo marco, seleccionando solo las cláusulas que correspondan al caso."*

**El acuerdo marco sigue sin llegar.** No hay ninguna mención a "acuerdo marco" en todo el repo. La respuesta explica **cómo usar** un documento que todavía no tenemos, así que C-08 queda trabado por exactamente lo mismo que antes.

**Pero la respuesta sí cambia el diseño, y en una dirección distinta de la que suponía el pedido del 27/08.** Ese documento pedía *"una plantilla editable con variables"* — un documento con huecos. Lo que el cliente describe es otra cosa: **un catálogo de cláusulas con selección por caso.** Es más parecido a un armador de contratos que a un `mail merge`.

Eso agrega piezas que no estaban en el plan: el catálogo de cláusulas versionado, la selección por caso, y la regla de qué cláusula aplica a qué. **Es de BE** (`apps/api/src/acuerdos/agreement-content.ts` y `acuerdo-export.ts`), pero abre una pregunta que decide si FE tiene trabajo o no:

**¿Quién selecciona las cláusulas?** Si es automático por método y tipo de caso, FE no hace nada — consume el documento generado. Si lo elige una persona (el mediador, el estudio, las partes), hace falta una **pantalla de armado de acuerdo** que hoy no está en ningún plan. Es una pregunta nueva, que no existía antes de esta respuesta.

Y sigue sin contestarse la del docx: **¿es el mismo modelo para negociación, conciliación y mediación?** La respuesta nombra sólo conciliación y negociación.

---

## 8 · El carril de FE, ordenado

### Se puede hacer ahora, sin depender de nadie

1. ~~**Logo (C-07)** — assets + componente `Logo`.~~ ✅ **Hecho el 01/09** (`docs/changelogs/2026-09-01.md`). Quedan abiertas las dos salvedades: el favicon a 16 px y los entregables que el pack no trae.
2. **Cerrar C-03** — sin cambio de código. El texto vigente queda aprobado.
3. **Sacar C-06 del backlog** — la Fase 1 entera queda sin objeto.
4. ~~**Precio del abogado: 40.000 → 50.000**~~ ✅ **Hecho el 03/09** (`docs/changelogs/2026-09-03.md`). Falta coordinar `LAWYER_FEE_ARS_MINOR` con BE, que es quien lo configura, y el precio en USD sigue sin contestarse (pregunta #7).

### Se puede diseñar ahora, entregar cuando llegue el dato

5. ~~**Handoff por WhatsApp post-pago**~~ ✅ **Construido contra el mock el 03/09** (`docs/changelogs/2026-09-03-whatsapp-handoff.md`). Falta el número del estudio — verificado también contra `pactum_respuestas_cliente.pdf`, no lo trae — así que la pantalla lo muestra como bloqueo explícito en vez de un botón muerto.

### Sigue bloqueado

6. **C-01** — DB entregó el gate el 02/09 (`20260902120000_c01_gate_suscripciones.sql`) y **el front ya modela el estado `pendiente_suscripciones`** ✅ (03/09). Queda: que BE tipe el error del gate —hoy sale como 409 genérico con el mensaje crudo de Postgres— y la confirmación sobre el selector de `invite.tsx`.
7. **C-02** — espejo del mock, bloqueado por DB y el estudio.
8. **C-08** — bloqueado por el acuerdo marco, y ahora además por quién elige las cláusulas.

---

## 9 · Lo que hay que volver a preguntar

Cinco vienen de esta ronda, dos quedaron sin contestar de la anterior.

| # | Pregunta | Quién pregunta | Destraba |
|---|---|---|---|
| 1 | **¿Qué incluye el servicio de $50.000 y en cuánto responde el estudio?** | FE → estudio | El botón de abogado. **Sigue siendo bloqueante para publicar** |
| 2 | Número de WhatsApp del estudio | FE → Administración | El handoff post-pago |
| 3 | Nombre para las tiendas + bundle id | FE → Administración | La publicación (los assets ya están) |
| 4 | ¿Se eliminan o se marcan como no disponibles las cláusulas H.5–H.6? | DB → estudio | El texto de los TyC. **Sin contestar** |
| 5 | El acuerdo marco, aunque sea el índice · y **¿quién selecciona las cláusulas?** | BE → estudio | C-08 entero |
| 6 | ¿Sigue existiendo el selector "¿quién paga?" o pasa a ser siempre "cada uno lo suyo"? | DB → cliente | El ticket de FE de C-01 |
| 7 | ¿El precio en USD también sube, o queda en 30? | FE → Producto | El precio fuera de Argentina |

**La 1 es la que más importa.** Es la tercera vez que se pide y es la única marcada como bloqueante para publicar en el spec. Subir el precio a $50.000 sin definir el alcance deja el mismo botón deshabilitado, ahora por más plata.

Aparte, sin ser preguntas: **crear `soportepactum@gmail.com`** (nuestro), **actualizar §10.2 del spec** con el logo real, y **pedir el logotipo, el lockup y la OG image**, que no vinieron en el pack.
