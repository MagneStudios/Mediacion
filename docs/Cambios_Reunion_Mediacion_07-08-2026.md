# Documento de Cambios — Reunión del 07/08/2026

**Proyecto:** Plataforma de mediación y acuerdos extrajudiciales (nombre provisorio: *Pactum* / *Acordo*)
**Destinatario:** Equipo de desarrollo
**Versión:** 2.0 (resumida)

## Resumen

El recorrido funcional fue probado y aprobado por el cliente. Se solicitan 13 cambios. Objetivo: MVP en septiembre de 2026 (en diciembre arranca la feria judicial). El proyecto va algunas semanas adelantado.

## Prioridades

| Prioridad | Requerimientos |
|---|---|
| **Alta** (bloquean el MVP) | R-03, R-06, R-08, R-09, R-10, R-11, R-12 |
| **Media** | R-01, R-02, R-04, R-05 |
| **Baja** (post-MVP) | R-13 |

> **Nota:** R-07 no figura en esta tabla de prioridades del documento original, aunque en su propio encabezado (sección 4) está marcado como *Media*.

---

## 1. Identidad visual y contenido

### R-01 — Rediseñar el logo · Media
Reemplazar la balanza actual por dos personas abrazándose: el usuario llega en conflicto y la identidad debe comunicar acuerdo, no litigio.

**Aceptación:** isotipo nuevo en SVG y PNG (color, monocromo, negativo), aplicado en splash, header, favicon y emails.

### R-02 — Mantener la paleta actual · Media
Se evaluó migrar a cálidos (naranja, rosado) y se descartó. Se conserva la rama de celestes: el objetivo psicológico es que el usuario baje la guardia. Se pueden sumar acentos que no generen alerta; el rojo queda solo para errores puntuales, nunca para la identidad.

### R-03 — Simplificar todos los textos a lenguaje llano · ALTA
Buena parte del público objetivo desconoce el vocabulario jurídico o lee con dificultad. Ejemplo citado: "unir un conflicto entre partes" no se entiende.

**Aceptación:** auditoría completa de copies (pantallas, botones, errores, emails, notificaciones); sin tecnicismos ("partes", "vigencia", "vinculante", "extrajudicial"); frases cortas, voz activa, segunda persona; nivel de lectura de primaria completa.

---

## 2. Ciclo de vida del caso

### R-04 — Vencimiento de invitaciones a las 72 horas · Media
Toda invitación tiene 72 h de vigencia desde su envío. Si no se acepta, el caso pasa a estado `EXPIRADO`. El caso expirado no se elimina: queda en el historial con ese estado.

No se puede reenviar la invitación sobre un caso expirado: hay que crear un caso nuevo.

**Aceptación:** estado `EXPIRADO` en la máquina de estados; job que marca los vencidos; botón de reenvío deshabilitado; mensaje en lenguaje llano (R-03) para el invitador y pantalla de "invitación vencida" para quien abre un link caduco.

---

## 3. Cuentas, matrícula y datos

### R-05 — Campo de matrícula profesional en el alta · Media
El abogado o estudio debe poder cargar y adjuntar su matrícula al crear la cuenta.

**Definición clave:** NO se verifica (ni manual ni automáticamente). No es requisito legal: el acuerdo es extrajudicial y lo vinculante es la firma digital. Se pide porque genera institucionalidad, refuerza la obligación de medio del abogado y reserva el uso al perfil profesional.

**Aceptación:** número de matrícula + archivo adjunto (imagen/PDF) en el registro; se almacena y se muestra en el perfil; no se implementa flujo de verificación ni estado "pendiente de aprobación".

### R-06 — Retención y borrado de datos · ALTA

| Situación | Retención |
|---|---|
| Usuario con suscripción activa | Hasta 10 años (requisito legal) |
| Usuario que deja de pagar | Se puede eliminar a los 6 meses de la baja |

Objetivo: cumplir la exigencia legal sin que la base crezca indefinidamente y dispare los costos.

**Aceptación:** job de depuración a los 6 meses de la baja; aviso al usuario antes del borrado definitivo; política reflejada en los términos y condiciones.

---

## 4. Pagos, suscripciones y facturación

### R-07 — El invitador define quién paga · Media
Al invitar a alguien sin registro ni suscripción activa, el invitador elige: "yo te invito y yo pago" o "yo te invito y vos pagás".

**Aceptación:** selector en el flujo de invitación; si paga el invitador, el cobro se le imputa a él; si paga el invitado, se le muestra el checkout al aceptar, antes de acceder al caso.

### R-08 — Mercado Pago con la cuenta definitiva · ALTA · BLOQUEANTE
Único medio de pago en la etapa inicial. Hoy se opera contra una cuenta de prueba personal; hay que migrar a la de la empresa (pendiente: el cliente debe enviar los datos, ver P-04).

**Aceptación:** credenciales de producción por variables de entorno; suscripciones recurrentes end-to-end; webhooks de pago aprobado, rechazado y baja; capa de pagos desacoplada para sumar otros medios en otros países.

### R-09 — Facturación automática vía ARCA · ALTA
Factura el sistema, no cada usuario ni cada estudio. Ya existen módulos de ARCA integrados del lado del cliente. Los precios publicados no incluyen impuestos: se cobra + IVA + impuestos.

**Aceptación:** emisión de comprobantes vía ARCA; cálculo de IVA e impuestos sobre el neto; comprobante descargable y enviado por email; importes discriminados (neto + impuestos + total) en el checkout.

### R-10 — Precios configurables y plan para estudios · ALTA
Los precios se modifican desde la plataforma, sin deploy.

| Plan | Alcance | Precio |
|---|---|---|
| Usuario individual | Individual | A definir (ver P-03) |
| Abogados y estudios | Casos ilimitados | USD 25/mes + IVA + impuestos |

**Aceptación:** ABM de planes y precios en el panel de administración; el plan profesional sin límite de casos; los cambios impactan en suscripciones nuevas, no retroactivamente.

---

## 5. Comunicaciones

### R-11 — Dominio propio y casillas de correo · ALTA · BLOQUEANTE
Condición para que el producto sea funcional. Se necesitan dos casillas: soporte (atención a usuarios) y notificaciones (remitente oficial del sistema). El circuito replica el modo en que los juzgados notifican a los organismos, y por eso necesita un remitente propio que le dé validez institucional. Depende de que se defina el nombre (ver P-01).

**Aceptación:** dominio comprado y DNS configurado; ambas casillas creadas; SPF, DKIM y DMARC para no caer en spam; la app envía desde el dominio propio.

### R-12 — Notificaciones por email · ALTA
Canal oficial de comunicación entre las partes y la plataforma. Eventos mínimos: invitación enviada · aceptada o rechazada · recordatorio antes de las 72 h (R-04) · invitación vencida · nueva propuesta o cambio en la negociación · acuerdo firmado.

**Aceptación:** plantillas con la identidad nueva (R-01, R-02) y textos en lenguaje llano (R-03); envío desde el dominio propio (R-11); registro de envíos y reintentos ante fallo.

### R-13 — Agregar eventos al calendario desde los ítems del acuerdo · Baja (post-MVP)
Cada ítem del acuerdo con fecha debe ofrecer agendarlo en el calendario del usuario. Ejemplo dado: "lunes y miércoles, buscar a Josecito a las 20:00" o "llevarlo al campeonato el sábado" — el usuario corta la llamada y se olvida.

**Aceptación:** botón "Agregar al calendario" en cada ítem con fecha; eventos únicos y recurrentes; vía `.ics` y/o integración con Google Calendar.

> No confundir: esto no es un calendario de vencimientos de casos para el estudio. Esa idea fue evaluada y descartada.

---

## 6. Pendientes del cliente

No son requerimientos de desarrollo todavía: dependen de una definición o validación externa.

| # | Pendiente | Detalle | Bloquea |
|---|---|---|---|
| P01 | Nombre y dominio | Más probable: Pactum. También en carrera: Acordo (buena recepción), Pacto (fuerte para el exterior, pero pacto.com estaría tomado), Julio, Jurex, Curimed, Mediátum. Descartados: Árbitro (el árbitro impone, el producto busca acuerdo) y Mediación (ya existe). Debe ser legible en todos los idiomas. Falta verificar disponibilidad y comprar. | R-11 |
| P02 | Firma digital | Es el elemento vinculante del acuerdo y lo que le da efecto frente a terceros. No se pudo probar en esta ronda: validar en la próxima entrega. | — |
| P03 | Precios y alcance de facturación | Falta el precio del plan individual, y definir si se factura desde el día 1 y sobre la totalidad de las operaciones. | R-09, R-10 |
| P04 | Datos de Mercado Pago | La empresa está en formación; el cliente debe enviar los datos de la cuenta definitiva. | R-08 |
| P05 | Patente / registro de marca | Planteado y diferido: sin información suficiente para decidir. | — |

---

## 7. Descartado explícitamente

| Ítem | Motivo |
|---|---|
| Calendario de vencimientos de casos para el estudio | "No sirve para nada". Retomable si surge la necesidad. No confundir con R-13. |
| Verificación de la matrícula | Compleja de automatizar y sin valor: no es vinculante y falsificarla exigiría un esfuerzo desproporcionado. |
| Colores cálidos / rojos en la identidad | Mantienen al usuario en estado de alerta. |
| Abrir la plataforma a usuarios no abogados | Quien resuelve estos conflictos es el abogado, asistente de la justicia y sujeto a normas de orden público (ej.: interés superior del niño). Posible a futuro. |

**Fuera del alcance de desarrollo (contexto):** sitio web institucional simple, orientado a levantar capital · redes sociales con foco en Instagram, más TikTok y YouTube (LinkedIn descartado).

---

## 8. Próximos pasos

| # | Acción | Responsable | Plazo |
|---|---|---|---|
| 1 | Enviar este documento al grupo (para que Nerea quede al tanto) | Valentín | Inmediato |
| 2 | Verificar disponibilidad de nombres y dominios (P-01) | Cliente | Inmediato |
| 3 | Enviar datos de la cuenta de Mercado Pago (P-04) | Cliente | A definir |
| 4 | Implementar R-01 a R-12 | Desarrollo | Semana del 11/08 |
| 5 | Ronda de corrección con el cliente | Todos | Semana del 11/08 |
| 6 | Publicar en Android para prueba en dispositivo | Desarrollo | Tras la corrección |
| 7 | MVP para pruebas con profesionales | Todos | Septiembre 2026 |

**Por qué septiembre:** el producto necesita mucho tiempo de prueba real. En diciembre empieza la feria judicial y la actividad cae; en febrero la gente vuelve relajada; marzo es el pico de conflictividad y para entonces el mercado ya debe conocer el producto. Se prioriza Android sobre iOS por facilidad de publicación.

**Ideas registradas para el futuro:**
- Agente de WhatsApp que reciba un audio y cree el caso en la app.
- Expansión regional — el contrato ya se adapta a la normativa de cada país, así que la lógica de pagos, facturación y textos legales debe construirse parametrizable por país desde ahora, aunque se lance solo en Argentina.

---

*Elaborado a partir del transcript de la reunión del 07/08/2026 (Juan Manuel Magne, Valentín Nogar, Víctor y equipo, Viti). Ante cualquier discrepancia, prevalece lo conversado en la reunión.*
