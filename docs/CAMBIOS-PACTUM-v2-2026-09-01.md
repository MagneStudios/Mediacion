# Pactum — Cambios v2 (reunión con Victor Solmi, 01/09/2026)

**Fecha del documento:** 04/09/2026
**Origen:** reunión de 24 min con Victor Solmi (grabación Fathom) + respuestas del cliente sobre el doc anterior.
**Reemplaza / actualiza:** `CAMBIOS-PACTUM-2026-08-27.md`. Donde haya contradicción, **manda este documento**.

> **Lo más importante de esta reunión:** cambia la arquitectura del acuerdo. No se firma **un** acuerdo grande por caso: se firman **varios acuerdos chicos, uno por materia** (tenencia, alimentos, bienes), cada uno con su propia negociación y su propia firma. Y el modelo de negocio pasa a ser **suscripción individual de cada parte**, no un pago por caso. Los puntos 1 y 2 de abajo son los que impactan el modelo de datos; el resto son ajustes.

---

## 1. Acuerdos fragmentados por materia — CAMBIO ESTRUCTURAL

**Qué dijo el cliente:** el acuerdo marco que está redactando (con las colegas que lo ayudan) cubre todo — tenencia, alimentos, división de bienes. Pero **no se firma entero**. De ese marco "se corta una partecita" por cada materia y se firma un acuerdo separado por cada una.

**Motivo (del cliente):** en familia, si se negocia todo junto "se mezclan un montón de cosas y sentires". Negociaciones chicas y puntuales son más fructíferas.

**Qué hay que hacer:**

- Un **caso** puede contener **N negociaciones**, cada una sobre **una materia** (tenencia, alimentos, bienes, otra).
- Cada negociación produce **su propio acuerdo**, con **su propia plantilla** (el fragmento del marco que corresponde a esa materia) y **su propia firma digital**.
- Cada plantilla de materia es corta: **3 o 4 ítems**, según el cliente.
- El acuerdo marco completo queda como documento fuente/administrable, no como el documento que firman los usuarios.
- El usuario tiene que poder abrir una negociación nueva sobre otra materia dentro del mismo caso, sin arrancar un caso nuevo.

**Modelo de datos (propuesta):**

```
cases                 → el vínculo entre las dos partes
  negotiations        → case_id, subject_type (tenencia | alimentos | bienes | otro),
                        method (negociacion | conciliacion | mediacion), status, round
    agreements        → negotiation_id, template_id, version, status, signed_at, pdf_url
      agreement_data  → variables completadas por la IA / las partes
agreement_templates   → subject_type, version, body (con variables), active
```

**Impacto:** hay que revisar todas las pantallas que hoy asumen "un caso = un acuerdo": detalle de caso, listados, historial, firma, notificaciones y panel admin.

---

## 2. Los acuerdos son versionables y se renegocian — CAMBIO ESTRUCTURAL

**Qué dijo el cliente:** un acuerdo no dura para siempre. "Le cambian el horario de fútbol y ya no sirve más ese contrato". Ante un cambio, **se abre una nueva ronda de negociación y se genera un acuerdo nuevo** que reemplaza al anterior. Ese es justamente el fundamento del abono: la renegociación es permanente.

**Qué hay que hacer:**

- Versionado de acuerdos por materia: `version`, `supersedes_agreement_id`, `valid_from`, `status` (`vigente` | `reemplazado` | `anulado`).
- En la pantalla de la materia se ve **el acuerdo vigente**, con acceso al historial de versiones anteriores.
- Acción visible: **"Renegociar"** desde un acuerdo vigente → abre una ronda nueva sobre esa misma materia, precargando el acuerdo actual como punto de partida.
- Cuando el acuerdo nuevo se firma, el anterior pasa a `reemplazado` (no se borra: queda en el historial).
- Las tareas/eventos de calendario derivados del acuerdo viejo tienen que actualizarse o marcarse como vencidos al firmarse el nuevo.

---

## 3. Pagos: suscripción individual — CORRIGE EL PUNTO 1 DEL DOC ANTERIOR

**Qué cambia:** en el doc anterior figuraba "opción de que ambas partes paguen (split 50/50 de un caso)". **Eso queda sin efecto.** El esquema definitivo es:

- **Cada parte paga su propia suscripción (abono).** No hay pago compartido, ni una parte pagándole a la otra. Textual del cliente: "para evitar quilombos... que cada cual pague".
- Es un **abono recurrente**, no un pago por caso, porque el producto es la renegociación continua a lo largo del tiempo.
- Posicionamiento de precio: barato en comparación con cualquier proceso judicial ("un regalo").

**Qué hay que hacer:**

- Modelo de suscripción por **usuario**, no por caso: `subscriptions` (user_id, plan, status, current_period_end, mp_preapproval_id).
- Mercado Pago con **suscripción / pago recurrente** (preapproval), no pago único.
- El acceso a una negociación requiere que **esa parte** tenga suscripción activa. Si la contraparte no está suscripta, ve la invitación y el resumen, pero no puede operar hasta suscribirse.
- Estados a contemplar: suscripción vencida con acuerdos vigentes (los acuerdos firmados no se pierden; lo que se bloquea es abrir o continuar negociaciones).
- Sacar de la UI y del backlog todo lo referido al split de pago.

**Pendiente de definir:** precio del abono, planes (si hay más de uno), y qué pasa exactamente al vencer la suscripción.

---

## 4. Asesoramiento personal — actualizado

**Estado con lo ya confirmado por el cliente:**

- Es un **servicio pago aparte**. El flujo es: botón → **link de pago** → una vez pagado, **contacto con el estudio**.
- Precio: **$50.000**.
- Tras el pago, se genera un **enlace de WhatsApp** con un mensaje de confirmación al número del estudio (no un mail).
- La casilla **soportepactum@gmail.com** existe para soporte y hay que darla de alta (tarea nuestra).

**Qué hay que hacer:**

- Botón "Asesoramiento personal" → pantalla con qué incluye y el precio → checkout de Mercado Pago (pago único, separado del abono).
- Al confirmarse el pago: pantalla de éxito con **botón de WhatsApp** (`https://wa.me/<numero>?text=<mensaje precargado>`) con el mensaje de confirmación (incluir identificador de la consulta/pago para que el estudio lo pueda cruzar).
- Registrar la consulta en base (`advisory_requests`: user_id, case_id, payment_id, status) para que el estudio la vea en el panel admin.
- El texto y el número van por configuración, no hardcodeados.

**Nota:** esto reemplaza el botón `mailto:` del doc anterior como canal principal. El mail queda solo para **soporte** (soportepactum@gmail.com), no para asesoramiento.

---

## 5. Arbitraje: se elimina de familia (definitivo, no solo postergado)

**Qué dijo el cliente:** en cuestiones de **familia el arbitraje está expresamente prohibido**. Lo confirmó tras consultarlo. Para **bienes** sí sería viable, pero queda para más adelante.

**Qué hay que hacer:**

- Confirmado lo del doc anterior: fuera de la UI, estructura de datos preservada detrás de feature flag.
- Aclaración para el equipo: **no se activa nunca para materias de familia**. Si a futuro se habilita, es exclusivamente para la materia "bienes". Dejar el flag a nivel de materia, no global: `FEATURE_ARBITRAJE_BIENES`.

---

## 6. Los tres métodos: qué hace la IA en cada uno — AJUSTA EL DOC ANTERIOR

**Definición del cliente en la reunión:**

| Método | Qué hace el sistema | Injerencia de la IA |
|---|---|---|
| **Negociación** | Solo que las partes se hablen | Mínima (encuadre y formas) |
| **Conciliación** | **Ordena la charla** | Media (estructura el proceso) |
| **Mediación** | **Propone soluciones** | Máxima |

**Qué hay que hacer:**

- Tres configuraciones distintas del motor (prompts/reglas), no una sola con parámetros cosméticos. El nivel de intervención es la diferencia real entre los métodos.
- Ajustar el copy descriptivo de cada método a estas definiciones.
- Mantener el orden negociación → conciliación → mediación (por injerencia creciente), como ya estaba.

**⚠️ Discrepancia a confirmar con Victor:** en el mensaje de agosto pidió que conciliación diga *"el proceso incorpora orientación y propone opciones para acercar las posiciones"*, pero en la reunión ubicó **proponer soluciones** en **mediación** y dejó conciliación como "ordenar la charla". Antes de escribir el copy final hay que preguntarle cuál vale.

---

## 7. Texto de negociación: se saca la frase de orden público

**Qué cambia respecto del doc anterior:** el punto 3 anterior (agregar *"la plataforma velará por que se respeten las formas y las normas de orden público"*) **queda sin efecto**. El cliente pidió sacar esa frase.

**Lo que sí queda:** la idea de fondo era que **se respeten las formas** — que las partes no se insulten entre sí.

**Qué hay que hacer:**

- Quitar del copy la referencia a "normas de orden público" y a "interés superior del niño" en ese lugar.
- Dejar solo un encuadre de formas/respeto en la negociación.
- **Nuevo requerimiento técnico:** el cliente señaló que hoy **no está previsto** qué pasa si hay insultos, aunque los mensajes no lleguen directo de una parte a la otra. Hay que implementar **moderación de lenguaje ofensivo** en todo texto libre que cargue una parte:
  - detección antes de que el texto se procese o se muestre,
  - aviso al usuario para que reformule,
  - registro del evento para trazabilidad.
- Definir con el cliente si un insulto reiterado tiene alguna consecuencia en el caso (advertencia, cierre, aviso al estudio).

---

## 8. Motor de IA: elegir entre opciones, no redactar — requerimiento técnico

**Qué dijo el cliente:** *"la IA va a tener que al final elegir entre opciones, no es que la va a crear"*. Y aportó una observación que hay que tomar como requerimiento: un juez tiende a quedarse con la **última** opción que leyó y no relee; un modelo tiende a quedarse con la **primera**. Como el modelo sí puede releer infinitas veces, se le puede pedir que evalúe las opciones **en distinto orden**.

**Qué hay que hacer:**

- El motor **selecciona y combina** dentro de un conjunto acotado de opciones de acuerdo; no redacta cláusulas libres.
- **Mitigación del sesgo de posición:** evaluar cada set de opciones en **varias pasadas con el orden permutado** y quedarse con la opción más consistente entre pasadas (o pedir un ranking y promediarlo). Documentar el criterio y dejarlo configurable.
- Guardar la traza de la decisión (opciones evaluadas, orden, resultado por pasada) para poder auditar y para mostrarle al estudio cómo llegó la IA a la propuesta.
- Sobre el acuerdo, el rol de la IA es más acotado todavía: **completa los datos** de una plantilla estandarizada. No redacta el contrato.

---

## 9. Captura de contexto del caso — alimenta la calidad de las propuestas

**Qué dijo el cliente:** la calidad de las opciones depende de cuánta información de la vida real tenga la app. Ejemplo textual: *"¿cuáles son las tareas de los nenes? Los lunes a las 2 va a X, a las 4 inglés, a las 6 el colegio"*.

**Qué hay que hacer:**

- Ficha de contexto por caso, cargable por las partes: integrantes del grupo familiar, actividades y horarios de los chicos, colegio, cronograma semanal, domicilios, restricciones (viajes, trabajo por turnos, distancias).
- Cargable de forma incremental — no un formulario gigante de una sola vez.
- Esa ficha alimenta el prompt del motor y **se usa para generar el cronograma que va dentro del acuerdo** (ver punto 10).
- Definir qué parte del contexto es privada de cada parte y qué es compartido.

---

## 10. Los cronogramas van DENTRO del acuerdo, no como anexo

**Qué dijo el cliente:** preguntado explícitamente si los horarios de los chicos van en el contrato o en un documento anexo, respondió: **en el contrato**. "Ya te queda todo establecido y lo firmás".

**Qué hay que hacer:**

- El PDF que se firma incluye el cronograma completo embebido (tabla de días/horarios), no como archivo aparte.
- Estructura del acuerdo según el cliente: **encabezado + cuerpo con las condiciones + cierre**. No es "completar y pegar": el texto tiene que leerse natural con las variables resueltas.
- El generador tiene que renderizar tablas de cronograma dentro del documento.

---

## 11. Copy legal: no prometer valor judicial

**Qué dijo el cliente:** homologar el acuerdo judicialmente "es un quilombo y los juzgados no te dan bola". El valor del acuerdo se apoya en la voluntad de cumplir de las partes (*animus*), no en la ejecutabilidad judicial.

**Qué hay que hacer:**

- Revisar todo el copy de la app, la landing y los mails: **no** afirmar que el acuerdo se homologa, es ejecutable judicialmente o tiene fuerza de sentencia.
- Sí se puede decir: firmado digitalmente (ley 25.506), con validez entre las partes y trazabilidad.
- Agregar un texto claro antes de firmar sobre qué implica el acuerdo y qué no.
- Que legales (el propio Victor) apruebe la redacción final de estos disclaimers.

---

## 12. Posicionamiento (impacta landing y onboarding)

Del cliente, para el copy de marketing y del onboarding:

- El diferencial son **costo, velocidad y adaptabilidad** frente al proceso judicial ("sideralmente más económico", "una audiencia cada seis meses es una locura").
- El público objetivo son personas **con ánimo de acordar**. Los casos conflictivos que van a juzgado **no son el target**.
- Existe la opción de **apoyo de un abogado para acercar a las partes** en casos difíciles → engancha con el asesoramiento pago del punto 4.

---

## Resumen de acciones

| # | Cambio | Tipo | Estado |
|---|--------|------|--------|
| 1 | Acuerdos separados por materia (N por caso) | Estructural | A implementar |
| 2 | Versionado y renegociación de acuerdos | Estructural | A implementar |
| 3 | Suscripción individual por parte (reemplaza el split) | Modelo de negocio | Falta precio/planes |
| 4 | Asesoramiento pago $50.000 → WhatsApp post-pago | Feature | Falta el número del estudio |
| 5 | Arbitraje fuera de familia (definitivo) | Alcance | A aplicar |
| 6 | Nivel de IA distinto por método | Motor + copy | ⚠️ Confirmar conciliación vs mediación |
| 7 | Sacar frase de orden público + moderación de insultos | Copy + feature | A implementar |
| 8 | IA elige entre opciones + mitigación de sesgo de orden | Motor | A implementar |
| 9 | Ficha de contexto del caso | Feature | A diseñar |
| 10 | Cronograma embebido en el acuerdo | Generador de documentos | Depende de plantillas |
| 11 | Copy legal sin promesa de homologación | Copy | A revisar con Victor |
| 12 | Posicionamiento: costo, velocidad, adaptabilidad | Marketing | A aplicar |

## Pendientes del cliente (bloquean desarrollo)

1. **Modelos de acuerdo por materia, con las variables identificadas.** Victor los está terminando con las colegas que lo ayudan; anticipó que puede haber reformas "de forma, no de fondo". Es el bloqueante principal: sin esto no se cierra el generador de documentos ni la firma.
2. Redacción final de los textos de los tres métodos (ver discrepancia del punto 6).
3. Precio y estructura del abono.
4. Número de WhatsApp del estudio para el asesoramiento.
5. Confirmación de los disclaimers legales.

## Tareas nuestras fuera de código

- Dar de alta la casilla **soportepactum@gmail.com**.
- Cuando lleguen los modelos de contrato: leerlos completos y devolverle a Victor la lista de preguntas y de variables que necesitamos parametrizadas (él ofreció responder por mensaje o videollamada, sin formalidad).
