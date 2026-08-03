# Proyecto Mediación — Modelo de contenido por pantalla

> Jerarquía de información para cada pantalla importante.
> Esto ayuda a Stitch a replantear la composición visual sin perder funcionalidad.
> No describe diseño actual — describe QUÉ información va, no CÓMO se ve.

---

## Login / SignUp

**Objetivo del usuario:** Autenticarse o crear cuenta para acceder a sus casos.

**Información imprescindible:**
- Email, password
- En signup: nombre, apellido

**Información secundaria:**
- Link a "¿No tenés cuenta?" / "¿Ya tenés cuenta?"
- Aviso de confirmación de email (post-signup)

**Acción primaria:** Iniciar sesión / Crear cuenta

**Estados:**
- idle: formulario vacío
- submitting: botón deshabilitado, loading indicator
- error: mensaje genérico (sin revelar si el email existe)
- awaitingConfirmation (signup): card informativo con link a login

**Información legal/sensible:** Ninguna en esta pantalla.

---

## Dashboard de Casos

**Objetivo del usuario:** Ver todos sus casos y crear uno nuevo.

**Información imprescindible:**
- Lista de casos con: título, estado, método, nombre de contraparte (si existe), indicador de ronda

**Información secundaria:**
- Badge de SLA (horas restantes)
- Cantidad total de casos

**Acción primaria:** Crear caso (botón prominente)

**Acción secundaria:** Abrir caso existente

**Estados:**
- loading: skeleton/spinner
- empty: ilustración + texto "No tenés casos activos" + botón crear
- error: mensaje + botón reintentar
- success: lista/grid de casos

**Información que no debería mostrarse simultáneamente:** N/A

---

## Creación de Caso (Wizard)

### Paso 1 — Información básica
**Objetivo:** Dar nombre y contexto al caso.

**Información imprescindible:** Nombre del caso (requerido)
**Información secundaria:** Descripción (opcional)
**Acción primaria:** Continuar a método
**Validación:** Nombre no vacío

### Paso 2 — Método
**Objetivo:** Elegir método de resolución.

**Información imprescindible:** Tres opciones: Negociación, Conciliación, Mediación
**Información secundaria:** Descripción de cada método
**Acción primaria:** Continuar a revisión
**Validación:** Método seleccionado

### Paso 3 — Revisión
**Objetivo:** Confirmar datos antes de crear.

**Información imprescindible:** Nombre, método seleccionado
**Acción primaria:** Confirmar creación
**Acción secundaria:** Volver a editar
**Incertidumbre:** El botón lanza POST y espera respuesta

### Paso 4 — Invitación (post-creación)
**Objetivo:** Invitar a la contraparte.

**Información imprescindible:** Tipo de invitación (link, código, email)
**Información secundaria:** Token generado (para copiar)
**Acción primaria:** Copiar/compartir invitación
**Acción secundaria:** Ir al caso

### Paso 4b — Éxito
**Objetivo:** Confirmar que el caso se creó correctamente.

**Información imprescindible:** Confirmación visual + nombre del caso
**Acción primaria:** Ir al caso

---

## Detalle de Caso — Pendiente de contraparte (`estado: nuevo`)

**Objetivo del usuario:** Esperar o simular que la contraparte se une.

**Información imprescindible:**
- Nombre del caso
- Código del caso (CASO-XXXX-XXXX)
- Método de resolución
- Estado: "Esperando contraparte"

**Información secundaria:**
- Aviso de privacidad
- Invitación generada (link/código/email)

**Acción primaria:** Ver invitación

**Acción secundaria:** Simular aceptación de contraparte (demo)

**Confirmaciones:** Diálogo antes de simular aceptación

**Estados:**
- Sin invitación generada aún: botón "Ver invitación"
- Invitación cargada: card con link/código + botón copiar
- Error al cargar invitación: mensaje + reintentar
- Simulando: loading en botón

---

## Detalle de Caso — Activo

**Objetivo del usuario:** Gestionar posiciones, negociar, ver mediador y acuerdo.

**Información imprescindible:**
- Nombre y código del caso
- Sección de posiciones (crear/ver)
- Resumen de negociación (ronda actual, estado)
- Mediador (si aplica)
- Acuerdo (si `estado === 'acordado'`)

**Acción primaria:** Cargar posiciones (si estado lo permite)

**Acciones secundarias:** Ir a negociación, ir a mediador, ver acuerdo

**Estados:**
- Sin posiciones cargadas
- Con posiciones + ronda activa
- Con acuerdo pendiente de firma

---

## Lista de Posiciones Propias

**Objetivo del usuario:** Ver y gestionar sus posiciones privadas.

**Información imprescindible:**
- Lista de posiciones con: categoría, nombre, rango (min-max), ¿puede ceder?

**Información secundaria:**
- Cantidad de posiciones
- Aviso de privacidad: "Solo vos ves esta información"

**Acción primaria:** Crear posición (si editable)

**Acciones secundarias:** Editar, eliminar

**Estados:**
- empty: sin posiciones cargadas
- lista: posiciones con acciones
- ineligible: caso en estado `nuevo` — no se pueden cargar
- read_only: caso en estado `acordado` — solo lectura

---

## Formulario de Posición (Crear/Editar)

**Objetivo del usuario:** Declarar su posición sobre un ítem.

**Información imprescindible:**
- Categoría del ítem (5 opciones)
- Nombre del ítem
- Rango de acuerdo (valor mínimo, valor máximo)
- ¿Puede ceder? (sí/no)

**Información secundaria:**
- Descripción del ítem
- Condiciones de cesión (si "puede ceder" = sí)

**Acción primaria:** Continuar a revisión (crear) / Guardar cambios (editar)

**Validación:**
- Categoría requerida
- Nombre no vacío
- Rango mínimo ≤ máximo
- ¿Cede? requerido

**Estados:**
- idle: formulario vacío o con datos existentes
- submitted: validación activada, campos con error marcados

---

## Negociación — Dashboard

**Objetivo del usuario:** Ver el estado de la negociación y tomar acciones.

**Información imprescindible:**
- Número de ronda actual
- Propuesta actual (si existe): puntos de encuentro por categoría, texto narrativo, fundamentación
- Estado de la propuesta (pendiente/aceptada/rechazada)

**Información secundaria:**
- Mediador (card resumen)
- Aviso de privacidad: "La IA no accede a tus datos privados"

**Acción primaria (varía según eligibility):**
- `ready` + sin ronda: Iniciar ronda
- `ready` + ronda activa sin propuesta: Generar propuesta IA
- `in_progress`: Aceptar o rechazar propuesta
- `roundResolved` + no acuerdo: Iniciar nueva ronda
- `bothAccepted`: Ir al acuerdo

**Acciones secundarias:** Ver historial, ir a mediador

**Estados funcionales:**
- `waiting_counterparty`: Contraparte no se unió aún
- `positions_incomplete`: Falta cargar posiciones propias
- `waiting_other_party`: Contraparte no cargó posiciones
- `ready`: Se puede iniciar ronda o generar propuesta
- `in_progress`: Propuesta pendiente de respuesta
- `waitingForOtherParty`: Ya respondiste, esperando contraparte
- `roundResolved` + no acuerdo: Mensaje "no hubo acuerdo"
- `bothAccepted`: Mensaje "acuerdo alcanzado" + botón acuerdo
- `read_only`: Caso acordado/terminal

**Estados de carga:**
- AIProcessingState: "La IA está generando una propuesta..."
- Generar error: mensaje + reintentar

---

## Acuerdo — Dashboard

**Objetivo del usuario:** Revisar, preparar, firmar y gestionar el acuerdo.

**Información imprescindible:**
- Título del acuerdo
- Resumen y términos
- Estado del acuerdo (borrador/enviado/firmado/con aviso)
- Progreso de firmas (quién firmó, quién falta)

**Información secundaria:**
- Fundamentación de la propuesta original
- Fechas (creado, listo para firma, completado)

**Acción primaria (varía según estado):**
- `borrador`: Preparar documento
- `enviado_a_firma` + sin firmar: Ir a firmar
- `firmado` / `con_aviso`: Exportar, reportar incumplimiento

**Acciones secundarias:** Ver historial, exportar

**Estados:**
- `borrador`: recién materializado — preparar
- `enviado_a_firma`: listo para firmar
- `firmado`: proceso completo — opciones post-firma
- `con_aviso`: incumplimiento registrado — aviso visible
- DocumentPreparationState: preparando documento
- Error de preparación: reintentar

**Información legal/sensible:**
- Aviso: "Acuerdo compartido — visible para ambas partes"
- Aviso: "Firma simulada — Entorno de prueba"

---

## Firma del Acuerdo

**Objetivo del usuario:** Revisar el acuerdo y confirmar su firma.

**Información imprescindible:**
- Contenido completo del acuerdo (términos)
- Aviso de entorno de prueba

**Acción primaria:** Firmar (requiere checkbox de confirmación)

**Acción secundaria:** Volver al acuerdo

**Estados:**
- Sin confirmar: checkbox sin marcar, botón deshabilitado
- Listo: checkbox marcado, botón habilitado
- Firmando: loading
- Error: mensaje + reintentar
- Firmado: confirmación + estado de firmas

---

## Mediador — Dashboard

**Objetivo del usuario:** Entender y solicitar acompañamiento de mediador.

**Información imprescindible:**
- Estado actual de disponibilidad
- Explicación de qué hace el mediador

**Información secundaria:**
- Perfil del mediador (si asignado)
- Aviso de demo: "Perfil de demostración"

**Acción primaria:** Solicitar mediador (si available)

**Acción secundaria:** Ver actividad del mediador

**Estados:**
- `unavailable_before_round_3`: explicación + "disponible desde ronda 3"
- `available`: botón solicitar
- `pending`: solicitud enviada, esperando
- `assigned`: perfil del mediador visible
- `unavailable`: rechazado
- `read_only`: no aplica

---

## Avisos (Notice Center)

**Objetivo del usuario:** Ver notificaciones y navegar a la acción correspondiente.

**Información imprescindible:**
- Lista de avisos: categoría, título, cuerpo, tiempo, estado (leído/no leído)
- Badge de no leídos

**Información secundaria:**
- Filtro: todas / no leídas
- Marcar todas como leídas

**Acción primaria:** Tap en aviso → marcar leído + navegar

**Estados:**
- loading
- lista (con/sin no leídos)
- empty

---

## Actividad Compartida

**Objetivo del usuario:** Ver línea de tiempo de hitos del proceso.

**Información imprescindible:**
- Lista cronológica de eventos
- Cada evento: tipo, descripción, fecha

**Información secundaria:**
- Caso relacionado (si aplica)

**Estados:**
- loading
- lista cronológica
- empty

**Privacidad:** Sin eventos de posiciones privadas.

---

## Perfil

**Objetivo del usuario:** Ver y editar su información personal y preferencias.

**Información imprescindible:**
- Nombre y apellido
- Rol
- Menú de secciones

**Acciones:** Editar perfil, cuenta, notificaciones, ayuda, legal, privacidad

**Información sensible:** Preferencias de accesibilidad (frontend-only mock). Sin datos de contacto reales.

---

## Configuración de Cuenta

**Objetivo del usuario:** Cerrar sesión o desactivar cuenta.

**Acción primaria:** Cerrar sesión (con diálogo de confirmación)
**Acción destructiva:** Solicitar desactivación (con diálogo de confirmación)

**Información legal/sensible:** La desactivación es idempotente. No borra datos.

---

## Pantalla Post Sign-Out

**Objetivo del usuario:** Saber que cerró sesión y poder volver.

**Información imprescindible:** Mensaje de sesión cerrada
**Acción primaria:** Volver a la demo / Iniciar sesión
