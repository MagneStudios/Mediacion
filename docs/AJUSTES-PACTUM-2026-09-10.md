# Pactum — Ajustes de prueba (10/09/2026)

**Origen:** ronda de prueba sobre la app funcionando.
**Prioridad:** alta — el cliente quiere probarla, así que el objetivo es cerrar estos puntos cuanto antes.
**Tipo:** ajustes de UX y flujo + 1 pendiente de negocio sin resolver.

---

## 1. Términos y condiciones: moverlos a la creación de cuenta

**Problema:** hoy la aceptación de TyC está en otro momento del flujo y el usuario no entiende dónde tiene que hacerlo.

**Qué hay que hacer:**

- Mover el checkbox / botón de aceptación de TyC al **formulario de creación de cuenta**.
- No se puede completar el registro sin aceptar.
- Guardar la aceptación con fecha, hora y versión de los TyC (`users.tyc_accepted_at`, `tyc_version`).
- Sacar la aceptación del lugar donde está ahora, para que no quede duplicada.

---

## 2. Elección de plan dentro de la creación de cuenta

**Problema:** la elección de plan está separada del alta y genera fricción.

**Qué hay que hacer:**

- Incorporar la **selección de plan como un paso del alta** (mismo flujo, no una pantalla suelta posterior).
- El usuario puede elegir el **plan free** y terminar el registro ahí mismo, sin pasar por pago.
- Al finalizar el alta, la cuenta ya queda con un plan asignado — ninguna cuenta debe quedar sin plan.
- Si elige un plan pago, sigue al checkout; si elige free, entra directo a la app.

**Beneficio:** se evitan los estados intermedios (usuario creado sin plan, sin TyC) que hoy generan problemas.

---

## 3. Botón de cerrar sesión

**Problema:** no hay forma de desloguearse desde la pantalla del caso.

**Qué hay que hacer:**

- Agregar **cerrar sesión** en el menú lateral / header, accesible desde cualquier pantalla de la app.
- Que limpie sesión y storage local y redirija al login.

---

## 4. Unirse a un caso con código — falta la pantalla

**Problema:** el sistema genera un código de invitación, pero **no hay ningún lugar donde ingresarlo**. Un usuario que recibe un código no puede sumarse a un caso.

**Qué hay que hacer:**

- Pantalla/acción **"Unirme a un caso"** con input para pegar el código, accesible desde el listado de casos y desde el dashboard vacío.
- Validaciones: código inexistente, código ya usado, código vencido, usuario que ya es parte de ese caso.
- Al validar, mostrar de qué caso se trata y quién invita **antes** de confirmar el ingreso.
- Que funcione también para un usuario que se registra recién: si viene con un código, que lo pueda ingresar al terminar el alta.
- El link de invitación tiene que llevar al mismo flujo con el código precargado.

---

## 5. Invitar a la contraparte en cualquier momento

**Problema:** hoy la invitación parece estar atada al momento de crear el caso.

**Qué hay que hacer:**

- Poder invitar a la contraparte **en cualquier momento después de creado el caso**, desde el detalle del caso.
- Ofrecer las dos vías: **copiar código** y **copiar/compartir link**.
- Poder **reenviar** la invitación y **regenerar** el código si hace falta.
- Mostrar el estado de la invitación en el detalle del caso (pendiente / aceptada), para que se entienda por qué el caso todavía no avanza.

---

## 6. Pendiente: el pago sigue en 50/50 ⚠️

**Estado:** es el único punto de la ronda anterior que quedó **sin cambiar**.

**Qué corresponde:** según lo definido con Victor en la reunión del 01/09, el split 50/50 **queda sin efecto**. El esquema es **cada parte paga su propia suscripción** (abono individual), justamente para evitar el problema de quién le paga a quién.

**Qué hay que hacer:**

- Sacar el split 50/50 de la UI y de la lógica de cobro.
- Cada usuario tiene su propia suscripción; el acceso a operar en una negociación depende de la suscripción **de esa parte**.
- Con el plan free entrando por el alta (punto 2), revisar qué habilita el free y a partir de dónde se exige plan pago.

---

## Checklist

| # | Cambio | Prioridad |
|---|--------|-----------|
| 1 | TyC dentro del alta | Alta |
| 2 | Elección de plan (incl. free) dentro del alta | Alta |
| 3 | Botón de cerrar sesión | Alta |
| 4 | Pantalla para ingresar código y unirse a un caso | **Bloqueante** — sin esto no se puede probar un caso con dos partes |
| 5 | Invitar/reinvitar en cualquier momento | Alta |
| 6 | Sacar el pago 50/50 → suscripción individual | Media (definición de negocio ya tomada) |

**Prueba de aceptación de la ronda:** crear cuenta nueva aceptando TyC y eligiendo plan free → crear un caso → invitar a la contraparte → desde otra cuenta, ingresar el código y quedar dentro del mismo caso → cerrar sesión desde ambas.
