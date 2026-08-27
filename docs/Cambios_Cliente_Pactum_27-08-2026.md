# Pactum — Cambios solicitados (revisión legal Solmi & Asociados)

**Fecha:** 27/08/2026
**Origen:** feedback del cliente (Solmi & Asociados) sobre la revisión de textos y flujos de la app.
**Destinatario:** equipo de desarrollo.
**Alcance:** cambios de copy, orden de flujos, una feature nueva (asesoramiento personal) y dos ítems bloqueados a la espera de definición del cliente.

> Nota general: la mayoría son cambios de contenido/copy. Ningún texto legal debe quedar hardcodeado suelto en componentes: todo lo que sea copy legal va al archivo/tabla de contenidos (i18n) para que se pueda editar sin deploy, ya que el estudio va a seguir ajustando redacción.

---

## 1. Pagos — permitir que ambas partes paguen

**Qué cambia:** hoy el flujo asume un único pagador. Hay que ofrecer la opción de que **ambas partes paguen** (pago compartido).

**Requerimientos:**

- Al iniciar/confirmar un caso, quien lo crea elige la modalidad de pago:
  - **Paga quien inicia** (comportamiento actual).
  - **Pagan ambas partes** (50/50 por defecto sobre el costo del caso).
- Si se elige "pagan ambas partes", cada parte recibe su propia orden de pago y el caso avanza recién cuando **ambos pagos** están acreditados (estado intermedio `pendiente_pago_contraparte`).
- La contraparte debe ver claramente, antes de aceptar, cuánto le corresponde pagar.
- Si una parte no paga dentro del plazo definido, el caso queda en un estado no bloqueante y la parte que sí pagó puede: esperar, cancelar (con la política de reembolso que defina el cliente) o hacerse cargo del total.

**Modelo de datos (sugerido):**

- `cases.payment_mode`: `initiator` | `split`
- `case_payments`: `case_id`, `user_id`, `amount`, `status`, `payment_id` (Mercado Pago), `paid_at`

**Pendiente de definir con el cliente:** política de reembolso ante cancelación con un solo pago acreditado, y si el split puede ser distinto de 50/50.

---

## 2. Arbitraje — fuera del alcance de esta versión

**Qué cambia:** el arbitraje **se posterga**. No se implementa ahora.

**Requerimientos:**

- Quitar arbitraje del selector de métodos y de cualquier pantalla visible al usuario.
- No borrar la estructura de datos: dejar el enum/tipo de método preparado (`arbitraje`) pero deshabilitado por feature flag (`FEATURE_ARBITRAJE = false`), para poder activarlo sin migración.
- Revisar textos institucionales (onboarding, "cómo funciona", landing) y sacar toda mención a arbitraje.

---

## 3. Negociación — texto sobre el rol de la plataforma

**Qué cambia:** agregar en la pantalla/descripción de **Negociación** un texto que aclare el rol de control formal de la plataforma.

**Texto base (a confirmar redacción final con el estudio):**

> "La plataforma velará por que se respeten las formas y las normas de orden público."

**Requerimientos:**

- Ubicarlo en la descripción del método Negociación (pantalla de selección de método y/o pantalla informativa del método).
- Va como clave de i18n, no hardcodeado.
- El cliente aclaró que la palabra "velará" puede cambiar por una más actual — dejar la clave lista para reemplazo.

---

## 4. Orden de los métodos: de menor a mayor injerencia

**Qué cambia:** el orden de presentación de los métodos, de arriba hacia abajo, debe ser:

1. **Negociación**
2. **Conciliación**
3. **Mediación**

**Criterio:** el orden refleja el grado creciente de injerencia de un tercero en el proceso.

**Requerimientos:**

- Aplicar el orden en **todas** las pantallas donde aparezcan los métodos: selección de método, filtros, listados, materiales informativos, panel admin y reportes.
- Definir el orden en un único lugar (constante/`sort_order` en la tabla de métodos) y consumirlo desde ahí, para no repetir el criterio en cada vista.

---

## 5. Conciliación — texto sobre el rol del proceso

**Qué cambia:** agregar en la descripción de **Conciliación**:

> "El proceso incorpora orientación y propone opciones para acercar las posiciones."

**Requerimientos:**

- Mismo tratamiento que el punto 3: clave de i18n, ubicada en la descripción del método.
- Revisar que no contradiga el copy existente de conciliación (si hay texto que diga que la plataforma no orienta, se reemplaza).

---

## 6. Asesoramiento personal — botón de contacto por mail

**Qué cambia:** feature nueva. La app debe ofrecer la posibilidad de **asesoramiento personal** con el estudio.

**Cómo se implementa (importante):** funciona como un **botón de WhatsApp**, pero derivando a **mail**. **No** hay integración con la API de Gmail, ni login de Google, ni envío de mails desde la app. El botón simplemente abre el cliente de correo del usuario con un mail **precargado** dirigido a la casilla Gmail del estudio. El usuario lo envía desde su propio mail.

**Requerimientos funcionales:**

- Botón/acceso "Solicitar asesoramiento personal" visible en:
  - pantalla de ayuda/soporte,
  - pantalla de detalle del caso (acción secundaria),
  - y, opcionalmente, al finalizar una negociación sin acuerdo.
- Al tocarlo, se abre la app de correo del dispositivo con destinatario, asunto y cuerpo ya cargados.
- El usuario puede editar el mail antes de enviarlo. La app **no** envía nada ni guarda el contenido.

**Implementación técnica:**

- Destinatario: casilla Gmail del estudio, en variable de entorno (`NEXT_PUBLIC_CONTACTO_ASESORAMIENTO_EMAIL`). **Pendiente: el cliente tiene que confirmar la dirección exacta.**
- Acción principal — enlace `mailto:` (abre el cliente de mail por defecto; en Android con Gmail instalado abre Gmail directamente):

```
mailto:asesoramiento@ejemplo.com
  ?subject=Consulta%20de%20asesoramiento%20personal%20-%20Pactum
  &body=Hola%2C%20quisiera%20solicitar%20asesoramiento%20personal.%0A%0ACaso%3A%20%23{numero_de_caso}%0AM%C3%A9todo%3A%20{metodo}%0A%0AConsulta%3A%0A
```

- Todos los parámetros deben ir con `encodeURIComponent`. Cuidado con los saltos de línea (`%0A`) y con acentos.
- Fallback web (si el `mailto:` no abre nada, típico en navegadores de escritorio sin cliente configurado): ofrecer un segundo enlace al compositor de Gmail web:

```
https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...
```

- Fallback final: mostrar la dirección de mail en pantalla con un botón "Copiar dirección".
- Prellenar en el cuerpo, cuando el contexto exista: número/identificador de caso, método actual y nombre del usuario. **No** incluir contenido sensible del caso (ítems, montos, propuestas).
- Registrar el evento de analytics `asesoramiento_click` (solo el click; no se guarda el contenido del mail).

**Criterios de aceptación:**

- [ ] Desde Android e iOS, el botón abre el cliente de mail con destinatario, asunto y cuerpo cargados.
- [ ] Desde web, si no hay cliente de mail, aparece el fallback a Gmail web o la opción de copiar la dirección.
- [ ] La dirección de destino se cambia por variable de entorno, sin tocar código.
- [ ] El texto del botón y del mail precargado están en i18n.

---

## 7. Marca / logo "Pactum" — bloqueado

**Estado:** el nombre y logo definitivos están **sujetos a la creación de la SAS** y al posterior registro de marca. El cliente pidió que se le envíe el logo con el nombre Pactum cuando esté listo.

**Impacto en desarrollo:**

- Todo el branding (nombre visible, logo, splash, ícono de la app, colores de marca, textos legales con el nombre) tiene que estar **centralizado y parametrizado**, no repartido por el código.
- Trabajar con placeholder mientras tanto, y dejar documentado el listado de assets a reemplazar (ícono Android/iOS en todas las densidades, splash, favicon, header, mails).
- **Riesgo a comunicar:** el registro de marca y el alta de la SAS son trámites lentos; no van a acompañar el ritmo del desarrollo. El nombre en las tiendas (Play Store / App Store) y el bundle id dependen de esta definición, así que conviene definir cuanto antes al menos el nombre a usar en la publicación, aunque el registro siga en trámite.

---

## 8. Modelo de acuerdo — pendiente de recepción

**Estado:** el estudio va a enviar el **modelo de acuerdo** completo. Lo entregado hasta ahora es sólo el principio.

**Impacto en desarrollo:**

- El documento de acuerdo que genera la app (el que después va a firma digital) debe construirse a partir de una **plantilla editable con variables** (partes, ítems acordados, fechas, método utilizado, cláusulas), no de un texto fijo en código.
- Dejar la plantilla armada con el fragmento actual y las variables identificadas, para que al llegar el modelo definitivo sea un reemplazo de contenido y no un rehacer.
- **Bloquea:** el cierre del flujo de generación de acuerdo y su integración con la firma digital.

---

## Resumen de acciones

| # | Cambio | Tipo | Bloqueado por |
|---|--------|------|---------------|
| 1 | Pago por ambas partes | Feature | Política de reembolso / % del split |
| 2 | Quitar arbitraje (feature flag) | Alcance | — |
| 3 | Texto de negociación | Copy | Redacción final ("velará") |
| 4 | Orden: negociación → conciliación → mediación | UI | — |
| 5 | Texto de conciliación | Copy | — |
| 6 | Botón de asesoramiento por mail | Feature | Dirección de Gmail del estudio |
| 7 | Logo y nombre Pactum | Branding | SAS + registro de marca |
| 8 | Modelo de acuerdo | Contenido | Envío del estudio |

## Definiciones que necesitamos del cliente

1. Dirección de Gmail para el botón de asesoramiento.
2. Redacción final de los textos de negociación y conciliación.
3. Modelo de acuerdo completo.
4. Nombre definitivo a usar en las tiendas (aunque el registro de marca siga en trámite) y assets de logo.
5. Política de reembolso y porcentaje del pago compartido.
