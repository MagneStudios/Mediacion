# Proyecto Mediación — Mapa funcional de rutas

> Auditoría de rutas reales. Cada entrada incluye propósito funcional, roles, precondiciones, acciones, estados y nivel de implementación.

---

## Leyenda de estado de implementación

- **implementado** — Funcionalidad completa con datos y acciones funcionales
- **parcial** — Funciona con limitaciones, datos mock o acciones placeholder
- **mock** — Datos y acciones completamente simulados (por diseño, en esta fase)
- **shell** — Ruta existe pero con contenido mínimo o placeholder
- **no conectado** — Ruta existe pero sin servicio/backend que la respalde
- **no implementado** — No existe en el código

---

## Rutas raíz

### `/login`
- **Archivo:** `app/login.tsx`
- **Propósito:** Inicio de sesión con email + password
- **Roles:** Público (sin sesión)
- **Precondiciones:** AuthGate configurado con backend
- **Datos requeridos:** email, password
- **Acciones principales:** Sign in → redirect a `/`
- **Estados:** idle, submitting, error
- **Navegación saliente:** `/(tabs)` en éxito, link a `/signup`
- **Estado:** implementado (con backend real) / mock (bypass sin backend)

### `/signup`
- **Archivo:** `app/signup.tsx`
- **Propósito:** Registro de nuevo usuario
- **Roles:** Público
- **Precondiciones:** AuthGate configurado
- **Datos requeridos:** email, password, nombre, apellido
- **Acciones principales:** Sign up → redirect o email confirmation notice
- **Estados:** idle, submitting, error, awaitingConfirmation
- **Estado:** implementado (con backend) / mock (bypass)

### `/signed-out`
- **Archivo:** `app/signed-out.tsx`
- **Propósito:** Pantalla post cierre de sesión
- **Roles:** Público
- **Acciones principales:** "Volver a la demo" (restaura mock session)
- **Estado:** implementado (mock session)

---

## Tab principal — Casos

### `/(tabs)` → `/`
- **Archivo:** `app/(tabs)/index.tsx` → `features/cases/CasesDashboardScreen.tsx`
- **Propósito:** Listado de casos del usuario
- **Roles:** Parte
- **Precondiciones:** Sesión activa (o mock bypass)
- **Datos requeridos:** Lista de CaseSummary[]
- **Acciones principales:** Crear caso, abrir caso existente
- **Estados:** loading, success (lista), empty, error
- **Navegación saliente:** `/case/create`, `/case/[id]`
- **Estado:** mock (datos de `mocks/cases.ts`)

---

## Tab principal — Avisos

### `/messages`
- **Archivo:** `app/(tabs)/messages.tsx`
- **Propósito:** Centro de notificaciones/avisos
- **Roles:** Parte
- **Datos requeridos:** NoticeListItem[]
- **Acciones principales:** Filtrar (todas/no leídas), marcar leída, navegar a destino
- **Estados:** loading, lista con badge de no leídos
- **Navegación saliente:** caso, negociación, acuerdo, firma, mediador, actividad
- **Estado:** mock (fixtures en `mocks/notices.ts`)

---

## Tab principal — Firmas

### `/signatures`
- **Archivo:** `app/(tabs)/signatures.tsx`
- **Propósito:** Bandeja de acuerdos pendientes de firma
- **Roles:** Parte
- **Datos requeridos:** SignatureInboxItem[]
- **Acciones principales:** Ver acuerdo pendiente, navegar a firma
- **Estados:** Agrupado por estado (pending, waitingOther, completed, withNotice)
- **Navegación saliente:** `/case/[id]/agreement/sign`
- **Estado:** mock

---

## Tab principal — Perfil

### `/profile` (tab)
- **Archivo:** `app/(tabs)/profile.tsx`
- **Propósito:** Resumen de perfil + menú de configuración
- **Roles:** Parte
- **Datos requeridos:** MockProfile
- **Acciones principales:** Navegar a sub-secciones
- **Navegación saliente:** `/profile/edit`, `/profile/account`, `/profile/notifications`, `/profile/help`, `/profile/legal`, `/profile/privacy`
- **Estado:** mock

---

## Creación de caso

### `/case/create`
- **Archivo:** `app/case/create/index.tsx`
- **Propósito:** Paso 1 — Nombre y descripción del caso
- **Roles:** Parte
- **Precondiciones:** Sesión activa
- **Datos requeridos:** nombre (requerido), descripción (opcional)
- **Acciones principales:** Continuar a método
- **Estados:** idle, validación (nombre vacío)
- **Navegación saliente:** `/case/create/method`
- **Estado:** mock

### `/case/create/method`
- **Archivo:** `app/case/create/method.tsx`
- **Propósito:** Paso 2 — Selección de método (negociación/conciliación/mediación)
- **Roles:** Parte
- **Precondiciones:** Datos del paso 1 en CaseCreationContext
- **Acciones principales:** Seleccionar método, continuar a revisión
- **Navegación saliente:** `/case/create/review`
- **Estado:** mock

### `/case/create/review`
- **Archivo:** `app/case/create/review.tsx`
- **Propósito:** Paso 3 — Revisión de datos antes de crear
- **Roles:** Parte
- **Acciones principales:** Confirmar creación
- **Navegación saliente:** `/case/create/success` o `/case/create/invite`
- **Estado:** mock

### `/case/create/invite`
- **Archivo:** `app/case/create/invite.tsx`
- **Propósito:** Paso 4a — Invitar contraparte (link/código/email)
- **Roles:** Parte
- **Precondiciones:** Caso creado exitosamente
- **Acciones principales:** Generar invitación, copiar link/código
- **Navegación saliente:** `/case/create/success`
- **Estado:** mock

### `/case/create/success`
- **Archivo:** `app/case/create/success.tsx`
- **Propósito:** Paso 4b — Confirmación de creación exitosa
- **Roles:** Parte
- **Acciones principales:** Ir al caso o volver al dashboard
- **Navegación saliente:** `/case/[id]` o `/`
- **Estado:** mock

---

## Unión a caso

### `/case/join`
- **Archivo:** `app/case/join.tsx`
- **Propósito:** Unirse a un caso mediante token de invitación
- **Roles:** Parte (contraparte)
- **Precondiciones:** Token válido generado por createInvitation
- **Datos requeridos:** token string
- **Acciones principales:** Ingresar token, unirse (POST /casos/unirse)
- **Estados:** idle, submitting, error
- **Navegación saliente:** `/case/[id]` (replace, no push)
- **Estado:** mock (valida contra invitations emitidos en la sesión)

---

## Detalle de caso

### `/case/[id]`
- **Archivo:** `app/case/[id]/index.tsx` → `features/cases/CaseDetailScreen.tsx`
- **Propósito:** Vista detallada de un caso
- **Roles:** Parte
- **Precondiciones:** Pertenece al caso
- **Datos requeridos:** CaseDetail
- **Acciones principales:**
  - Si `estado === 'nuevo'`: ver/crear invitación, simular aceptación
  - Si no: cargar posiciones, ir a negociación, ver mediador, ver acuerdo
- **Estados:** loading, awaitingCounterparty, active (con positions + negotiation + mediator + agreement)
- **Navegación saliente:** positions, negotiation, mediator, agreement
- **Restricciones:**
  - Solo muestra "Crear posición" si `estado ∈ {activo, en_negociacion}`
  - Solo muestra "Simular aceptación" si `estado === 'nuevo'`
  - Solo muestra NegotiationSummaryCard si estado != 'nuevo'
  - Solo muestra MediatorSummaryCard si estado != 'nuevo'
  - Solo muestra AgreementSummaryCard si `estado === 'acordado'`
- **Estado:** mock

---

## Posiciones

### `/case/[id]/positions`
- **Archivo:** `app/case/[id]/positions/index.tsx`
- **Propósito:** Listado de posiciones privadas propias
- **Roles:** Parte (solo ve las propias)
- **Precondiciones:** Caso en estado activo/en_negociacion/acordado
- **Datos requeridos:** PositionItem[] (propios)
- **Acciones principales:** Crear, editar, eliminar posición
- **Estados:** loading, lista, empty, ineligible (si caso en 'nuevo'), read_only (si 'acordado')
- **Navegación saliente:** `/case/[id]/positions/create`, `/case/[id]/positions/[positionId]/edit`
- **Privacidad:** SOLO posiciones propias. `ownerId === MOCK_OWNER_ID`. Sin acceso a contraparte.
- **Estado:** mock

### `/case/[id]/positions/create`
- **Archivo:** `app/case/[id]/positions/create.tsx`
- **Propósito:** Formulario de nueva posición privada
- **Roles:** Parte
- **Precondiciones:** Caso editable (activo/en_negociacion)
- **Datos requeridos:** category, name, valueMin, valueMax, canConcede, concessionConditions
- **Acciones principales:** Completar formulario → revisar
- **Validación:** name requerido, category requerido, canConcede requerido, valueMin ≤ valueMax
- **Navegación saliente:** `/case/[id]/positions/review`
- **Estado:** mock

### `/case/[id]/positions/review`
- **Archivo:** `app/case/[id]/positions/review.tsx`
- **Propósito:** Revisión de posición antes de guardar
- **Roles:** Parte
- **Acciones principales:** Confirmar creación
- **Estado:** mock

### `/case/[id]/positions/[positionId]/edit`
- **Archivo:** `app/case/[id]/positions/[positionId]/edit.tsx`
- **Propósito:** Editar posición existente
- **Roles:** Parte (dueño)
- **Precondiciones:** Caso editable, posición pertenece al usuario
- **Estado:** mock

---

## Negociación

### `/case/[id]/negotiation`
- **Archivo:** `app/case/[id]/negotiation/index.tsx`
- **Propósito:** Dashboard de negociación con rondas, propuestas y respuestas
- **Roles:** Parte (ambas partes ven lo mismo — compartido)
- **Precondiciones:** Caso activo/en_negociacion, posiciones cargadas
- **Datos requeridos:** NegotiationState (eligibility, currentRound, currentProposal, ownResponse)
- **Acciones principales:**
  - Iniciar ronda (startNextRound)
  - Generar propuesta IA (generateProposal)
  - Aceptar/rechazar propuesta (submitResponse)
  - Ver historial de rondas
  - Ir a acuerdo (si bothAccepted)
  - Solicitar mediador (si ronda ≥3)
- **Estados:**
  - `waiting_counterparty`: Contraparte no se unió aún
  - `positions_incomplete`: Falta cargar posiciones
  - `waiting_other_party`: Esperando que contraparte cargue posiciones
  - `ready`: Se puede iniciar ronda o generar propuesta
  - `in_progress`: Propuesta pendiente de respuesta
  - `read_only`: Caso acordado/terminal
- **Navegación saliente:** history, mediator, agreement
- **Privacidad:** Propuesta solo muestra meeting points sanitizados, nunca posiciones privadas.
- **Estado:** mock (datos determinísticos de `mocks/negotiation.ts`)

### `/case/[id]/negotiation/history`
- **Archivo:** `app/case/[id]/negotiation/history.tsx`
- **Propósito:** Historial de rondas completadas con sus resultados
- **Roles:** Parte
- **Datos requeridos:** RoundHistoryItem[]
- **Estado:** mock

---

## Acuerdo

### `/case/[id]/agreement`
- **Archivo:** `app/case/[id]/agreement/index.tsx`
- **Propósito:** Dashboard de acuerdo (materializado automáticamente de propuesta aceptada)
- **Roles:** Parte (ambas partes ven lo mismo)
- **Precondiciones:** Propuesta aceptada por ambas partes → materialización lazy del acuerdo
- **Datos requeridos:** AgreementState (agreement, signers, canPrepareDocument, canSign, readOnly)
- **Acciones principales:**
  - Preparar documento de firma (prepareSignatureDocument)
  - Ir a firmar (sign)
  - Exportar acuerdo (placeholder no-op)
  - Reportar incumplimiento (si firmado/con_aviso)
  - Ver historial
- **Estados:**
  - `borrador`: Recién materializado, no preparado. canPrepareDocument = true.
  - `enviado_a_firma`: Documento preparado. canSign = true si propia firma pendiente.
  - `firmado`: Ambas firmas completas. readOnly.
  - `con_aviso`: Incumplimiento registrado. readOnly.
- **Navegación saliente:** sign, history
- **Privacidad:** Contenido del acuerdo viene de SharedProposal aceptada, no de posiciones privadas.
- **Estado:** mock

### `/case/[id]/agreement/sign`
- **Archivo:** `app/case/[id]/agreement/sign.tsx`
- **Propósito:** Pantalla de firma del acuerdo
- **Roles:** Parte
- **Precondiciones:** `agreement.estado === 'enviado_a_firma'`
- **Acciones principales:** Confirmar y firmar (mock)
- **Estados:** idle (pendiente de confirmación), pending, error, signed
- **Privacidad:** Muestra aviso "Firma simulada — Entorno de prueba". Sin validez legal.
- **Estado:** mock

### `/case/[id]/agreement/history`
- **Archivo:** `app/case/[id]/agreement/history.tsx`
- **Propósito:** Historial de eventos del acuerdo
- **Roles:** Parte
- **Datos requeridos:** AgreementHistoryItem[]
- **Estado:** mock

---

## Mediador

### `/case/[id]/mediator`
- **Archivo:** `app/case/[id]/mediator/index.tsx`
- **Propósito:** Dashboard de acompañamiento de mediador
- **Roles:** Parte
- **Precondiciones:** Ronda actual ≥ 3
- **Datos requeridos:** MediatorState (eligibility, mediation, mediator, canRequest)
- **Acciones principales:** Solicitar mediador (si available)
- **Estados:**
  - `unavailable_before_round_3`: No disponible aún (ronda < 3)
  - `available`: Se puede solicitar
  - `pending`: Solicitud enviada, pendiente de asignación
  - `assigned`: Mediador asignado
  - `unavailable`: Solicitud rechazada
  - `read_only`: Caso acordado/terminal sin mediador previo
- **Navegación saliente:** activity
- **Privacidad:** Perfil de mediador es demo ficticio ("Lucía Fernández"). Sin datos reales.
- **Estado:** mock (solo `case-1 → aceptada` es alcanzable interactivamente)

### `/case/[id]/mediator/activity`
- **Archivo:** `app/case/[id]/mediator/activity.tsx`
- **Propósito:** Hitos de actividad del mediador para este caso
- **Roles:** Parte
- **Datos requeridos:** MediatorActivityItem[]
- **Estado:** mock

---

## Perfil (sub-rutas)

### `/profile/edit`
- **Archivo:** `app/profile/edit.tsx`
- **Propósito:** Editar datos de perfil
- **Roles:** Parte
- **Estado:** mock

### `/profile/account`
- **Archivo:** `app/profile/account.tsx`
- **Propósito:** Gestión de cuenta (sign-out, desactivación)
- **Roles:** Parte
- **Acciones principales:** Cerrar sesión, solicitar desactivación
- **Estado:** mock

### `/profile/notifications`
- **Archivo:** `app/profile/notifications.tsx`
- **Propósito:** Preferencias de notificación
- **Roles:** Parte
- **Estado:** mock (7 boolean toggles — sin backend)

### `/profile/help`
- **Archivo:** `app/profile/help.tsx`
- **Propósito:** Centro de ayuda
- **Roles:** Parte
- **Estado:** shell (contenido estático con topics)

### `/profile/legal`
- **Archivo:** `app/profile/legal.tsx`
- **Propósito:** Información legal
- **Roles:** Parte
- **Estado:** shell (contenido estático)

### `/profile/privacy`
- **Archivo:** `app/profile/privacy.tsx`
- **Propósito:** Información de privacidad
- **Roles:** Parte
- **Estado:** shell (contenido estático)

---

## Actividad

### `/notices/activity`
- **Archivo:** `app/notices/activity.tsx`
- **Propósito:** Línea de tiempo compartida de actividad del proceso
- **Roles:** Parte (ambas partes ven lo mismo)
- **Datos requeridos:** ActivityListItem[]
- **Estados:** loading, lista cronológica
- **Privacidad:** Solo eventos ya compartidos (case lifecycle, round/proposal/agreement milestones). NUNCA incluye actividad de posiciones privadas.
- **Estado:** mock (21 fixtures estáticos en `mocks/activity.ts`)

---

## Hallazgos

### H-001: Exportación de acuerdo es no-op
- **ID:** H-001
- **Severidad:** media
- **Categoría:** funcionalidad incompleta
- **Ruta:** `/case/[id]/agreement`
- **Comportamiento documentado:** "Exportar acuerdo"
- **Comportamiento observado:** Botón renderiza pero onClick es comentario `// Placeholder only — no export service exists`
- **Evidencia:** `app/case/[id]/agreement/index.tsx:158-163`
- **Impacto en redesign:** El botón debe existir pero no requiere funcionalidad real aún.
- **Recomendación:** Mantener placeholder visual. Coordinar con backend que ya tiene `GET /acuerdos/:id/exportar` (texto plano).
- **Requiere decisión humana:** Sí (conectar o mantener placeholder)

### H-002: Incumplimiento sin backend
- **ID:** H-002
- **Severidad:** media
- **Categoría:** funcionalidad incompleta
- **Ruta:** `/case/[id]/agreement`
- **Comportamiento documentado:** POST /acuerdos/:id/incumplimiento
- **Comportamiento observado:** handleBreachConfirm cierra el diálogo sin llamar servicio
- **Evidencia:** `app/case/[id]/agreement/index.tsx:85-90`
- **Impacto en redesign:** El formulario y diálogo son funcionales. Falta integración con API.
- **Recomendación:** Conectar a `POST /acuerdos/:id/incumplimiento` del backend.
- **Requiere decisión humana:** Sí

### H-003: Panel de estudio es solo package.json
- **ID:** H-003
- **Severidad:** baja
- **Categoría:** shell
- **Ruta:** `apps/panel/`
- **Comportamiento documentado:** Panel web para estudios jurídicos
- **Comportamiento observado:** Solo package.json, sin código
- **Evidencia:** `apps/panel/` contiene únicamente `package.json`
- **Impacto en redesign:** Si Stitch diseña para desktop web, debe contemplar que hay un panel de estudio pendiente.
- **Recomendación:** Diseñar placeholder. No bloquear el rediseño mobile.
- **Requiere decisión humana:** Sí

### H-004: Tareas post-acuerdo sin integración UI
- **ID:** H-004
- **Severidad:** media
- **Categoría:** parcial
- **Ruta:** `features/tasks/`
- **Comportamiento documentado:** Backend genera tareas post-acuerdo. Frontend tiene componentes.
- **Comportamiento observado:** Componentes existen (`TaskCard`, `TaskListSection`, `TaskStatusBadge`) pero no están integrados en ninguna pantalla de caso.
- **Evidencia:** `features/tasks/components/` existe pero no se importa desde ninguna ruta.
- **Impacto en redesign:** Stitch debe diseñar una sección de tareas en el detalle de caso (post-acuerdo).
- **Recomendación:** Integrar componentes en CaseDetailScreen o AgreementScreen para casos con acuerdo firmado.
- **Requiere decisión humana:** Sí

### H-005: Sin UI de planes/suscripciones
- **ID:** H-005
- **Severidad:** baja
- **Categoría:** no implementado
- **Ruta:** N/A
- **Comportamiento documentado:** Backend tiene planes, suscripciones, MercadoPago.
- **Comportamiento observado:** Sin componentes ni rutas en frontend.
- **Evidencia:** `apps/api/src/pagos/` existe. Frontend sin referencias.
- **Recomendación:** Determinar si los planes se gestionan en la app móvil o solo en panel web.
- **Requiere decisión humana:** Sí
