# Proyecto Mediación — Requerimientos de componentes para Stitch

> Inventario conceptual (no visual) de componentes de dominio que Stitch debe diseñar.
> Stitch tiene libertad total sobre implementación visual. Esto define QUÉ, no CÓMO.

---

## Componentes de Caso

### CaseCard (Card de caso)
- **Propósito:** Resumen de un caso en la lista/dashboard
- **Datos necesarios:** title, estado, metodo, counterpartyName, roundNumber, visualStatus, statusLabelKey, slaHours
- **Variantes:** activo, pendiente de contraparte, acordado, con propuesta lista, con acuerdo firmado
- **Estados:** normal, con indicador de SLA urgente
- **Acciones:** tap → abrir caso
- **Visibilidad:** Solo casos propios del usuario
- **Rutas:** Dashboard (`/`)

### CaseStatusBadge (Badge de estado)
- **Propósito:** Indicador visual del estado funcional del caso
- **Datos necesarios:** visualStatus, statusLabelKey
- **Variantes:** success, warning, error, info, neutral, ai
- **Restricción:** NUNCA es fuente de verdad del estado. Es presentación.

### CaseCreationProgress (Progreso del wizard)
- **Propósito:** Indicador de paso actual en el wizard de creación
- **Datos necesarios:** step (1-4), total (4)
- **Rutas:** case/create/*

### InvitationPanel (Panel de invitación)
- **Propósito:** Mostrar y copiar datos de invitación (link, código)
- **Datos necesarios:** tipo, token/emailDestino
- **Variantes:** link (URL copiable), código (texto monospace), email (destinatario)
- **Estados:** cargando, dato visible, error
- **Rutas:** CaseDetailScreen (estado `nuevo`)

### PrivacyNotice (Aviso de privacidad)
- **Propósito:** Recordatorio visual de privacidad
- **Datos necesarios:** children (texto)
- **Rutas:** CaseDetailScreen, PositionsScreen, NegotiationScreen, AgreementScreen, MediatorScreen

---

## Componentes de Posiciones

### PrivatePositionForm (Formulario de posición)
- **Propósito:** Crear/editar una posición privada
- **Datos necesarios:** category, name, description, valueMin, valueMax, canConcede, concessionConditions
- **Variantes:** crear (vacío), editar (pre-llenado)
- **Validación:** categoría requerida, nombre requerido, rango válido, cesión requerida
- **Estados:** idle, submitted (con errores), submitting
- **Privacidad:** Solo visible para el dueño. Aviso explícito de privacidad.
- **Rutas:** `/case/[id]/positions/create`, `/case/[id]/positions/[positionId]/edit`

### PositionCard (Card de posición)
- **Propósito:** Mostrar una posición propia en la lista
- **Datos necesarios:** category, name, description, valueMin, valueMax, canConcede
- **Variantes:** editable (activo/en_negociacion), read-only (acordado)
- **Acciones:** editar, eliminar (si editable)
- **Privacidad:** Solo posiciones propias
- **Rutas:** `/case/[id]/positions`

### PositionRangeEditor (Editor de rango)
- **Propósito:** Campos para valor mínimo y máximo
- **Datos necesarios:** valueMin, valueMax, errores
- **Validación:** mínimo ≤ máximo, ambos requeridos

### PositionReviewCard (Card de revisión)
- **Propósito:** Revisar posición antes de guardar
- **Datos necesarios:** todos los campos de PositionItem
- **Rutas:** `/case/[id]/positions/review`

### DeletePositionDialog (Confirmación de eliminación)
- **Propósito:** Diálogo de confirmación antes de eliminar posición
- **Datos necesarios:** nombre de la posición
- **Estados:** idle, deleting, error
- **Rutas:** `/case/[id]/positions`

---

## Componentes de Negociación

### CurrentRoundCard (Card de ronda actual)
- **Propósito:** Mostrar número y estado de la ronda en curso
- **Datos necesarios:** roundNumber, estado (activa/completada)
- **Rutas:** NegotiationScreen

### SharedProposalCard (Card de propuesta)
- **Propósito:** Mostrar la propuesta generada por IA
- **Datos necesarios:** meetingPoint[], narrative, rationale, estado
- **Variantes:** pendiente, aceptada, rechazada, generando (narrative = null)
- **Estados:** normal, AIProcessingState (generando), aceptada (success), rechazada (warning)
- **Privacidad:** Contenido 100% sanitizado. Sin datos privados.
- **Rutas:** NegotiationScreen

### MeetingPointRow (Fila de punto de encuentro)
- **Propósito:** Una categoría del meeting point
- **Datos necesarios:** categoria, punto (number | null), estado (acordable | negociable)
- **Rutas:** SharedProposalCard

### ProposalResponseActions (Botones de respuesta)
- **Propósito:** Aceptar o rechazar propuesta
- **Datos necesarios:** estado de la propuesta (debe ser 'pendiente')
- **Acciones:** aceptar, rechazar
- **Estados:** habilitado (propuesta pendiente, sin respuesta propia), oculto
- **Rutas:** NegotiationScreen

### ProposalResponseDialog (Confirmación de respuesta)
- **Propósito:** Diálogo modal antes de confirmar aceptación/rechazo
- **Datos necesarios:** decisión (acepta/rechaza)
- **Variantes:** aceptar (positive), rechazar (neutral/warning)
- **Estados:** idle, submitting, error
- **Rutas:** NegotiationScreen

### WaitingForPartyState (Esperando contraparte)
- **Propósito:** Indicar que se está esperando respuesta de la contraparte
- **Datos necesarios:** N/A (estado fijo)
- **Rutas:** NegotiationScreen (waitingForOtherParty)

### RoundHistoryCard (Card de historial de ronda)
- **Propósito:** Una ronda completada en el historial
- **Datos necesarios:** roundNumber, proposalSummary, finalStatus, agreementReached
- **Rutas:** NegotiationHistoryScreen

### NegotiationSummaryCard (Resumen de negociación)
- **Propósito:** Resumen compacto para CaseDetailScreen
- **Datos necesarios:** currentRound, eligibility, currentProposal
- **Rutas:** CaseDetailScreen

---

## Componentes de Mediador

### MediatorSummaryCard (Resumen de mediador)
- **Propósito:** Card resumen del estado del mediador
- **Datos necesarios:** eligibility, mediator?, mediation?
- **Variantes:** no disponible (ronda < 3), disponible, pendiente, asignado, no disponible (rechazado)
- **Prop especial:** `hideWhenUnavailable` — oculta la card cuando no hay mediación y (ronda < 3 o caso terminal sin historial)
- **Rutas:** CaseDetailScreen (hideWhenUnavailable), NegotiationScreen

### MediatorRequestDialog (Confirmación de solicitud)
- **Propósito:** Diálogo modal antes de solicitar mediador
- **Estados:** idle, submitting, error
- **Rutas:** MediatorScreen

### SharedMediatorProfileCard (Perfil del mediador)
- **Propósito:** Mostrar perfil del mediador asignado
- **Datos necesarios:** displayName, roleLabelKey, summaryKey, languageCodes
- **Aviso:** "Perfil de demostración — no verificado"
- **Rutas:** MediatorScreen, MediatorSummaryCard

### MediatorDemoNotice (Aviso de demo)
- **Propósito:** Recordar al usuario que el mediador es una demo
- **Rutas:** MediatorScreen

---

## Componentes de Acuerdo

### AgreementSummaryCard (Resumen de acuerdo)
- **Propósito:** Card compacta para CaseDetailScreen
- **Datos necesarios:** agreement.title, agreement.estado, signers
- **Rutas:** CaseDetailScreen (solo si `estado === 'acordado'`)

### SharedAgreementCard (Card de acuerdo completo)
- **Propósito:** Mostrar el contenido completo del acuerdo
- **Datos necesarios:** title, summary, terms[], rationale, estado
- **Privacidad:** Contenido de SharedProposal aceptada. Sin posiciones privadas.
- **Rutas:** AgreementScreen, SignScreen

### SharedAgreementTermCard (Término del acuerdo)
- **Propósito:** Un término individual del acuerdo
- **Datos necesarios:** title, description
- **Rutas:** SharedAgreementCard

### SignatureProgressCard (Progreso de firmas)
- **Propósito:** Mostrar quién firmó y quién falta
- **Datos necesarios:** signers[] (role + status + signedAt)
- **Estados:** pendiente, propia firmada (waiting), ambas firmadas (completed)
- **Privacidad:** Sin identificadores de usuario. Solo roles (authenticated_party, other_party).
- **Rutas:** AgreementScreen

### SignerStatusRow (Fila de estado de firmante)
- **Propósito:** Una fila en el progreso de firmas
- **Datos necesarios:** role, status, signedAt
- **Rutas:** SignatureProgressCard

### MockSignatureConfirmation (Checkbox de confirmación)
- **Propósito:** Checkbox "Confirmo que revisé el acuerdo"
- **Estados:** unchecked, checked, disabled (submitting)
- **Rutas:** SignScreen

### SignatureEnvironmentNotice (Aviso de entorno de prueba)
- **Propósito:** Aviso legal de que la firma es simulada
- **Rutas:** SignScreen

### DocumentPreparationState (Estado de preparación)
- **Propósito:** Indicar que el documento se está preparando
- **Rutas:** AgreementScreen

### AgreementExportAction (Botón de exportación)
- **Propósito:** Exportar el acuerdo
- **Estados:** idle (placeholder), pending, success, error
- **Nota:** Actualmente es no-op. Placeholder para futura integración.
- **Rutas:** AgreementScreen

### BreachNoticeForm (Formulario de incumplimiento)
- **Propósito:** Describir un incumplimiento del acuerdo
- **Datos necesarios:** descripción (texto)
- **Validación:** descripción no vacía
- **Rutas:** AgreementScreen (solo si `estado ∈ {firmado, con_aviso}`)

### BreachNoticeDialog (Confirmación de incumplimiento)
- **Propósito:** Diálogo de confirmación antes de registrar
- **Estados:** idle, submitting, error
- **Rutas:** AgreementScreen

### AgreementHistoryCard (Card de evento de historial)
- **Propósito:** Un evento en el historial del acuerdo
- **Datos necesarios:** eventKey, timestamp, status
- **Rutas:** AgreementHistoryScreen

---

## Componentes de Avisos y Actividad

### NoticeCard (Card de aviso)
- **Propósito:** Una notificación en el centro de avisos
- **Datos necesarios:** category, title, body, createdAt, read, priority, destination
- **Variantes:** leído/no leído, actionable/informational
- **Estados:** normal, marcando como leído, error al marcar
- **Rutas:** `/messages`

### NoticeFilterBar (Barra de filtro)
- **Propósito:** Filtrar avisos por todas/no leídas
- **Datos necesarios:** filtro activo
- **Rutas:** `/messages`

### NoticeCategoryBadge (Badge de categoría)
- **Propósito:** Icono + texto de categoría del aviso
- **Datos necesarios:** category
- **Rutas:** NoticeCard

### UnreadSummaryCard (Resumen de no leídos)
- **Propósito:** Contador visual de avisos sin leer
- **Datos necesarios:** count
- **Rutas:** Tab bar, DesktopSidebar

### MarkAllReadAction (Marcar todas leídas)
- **Propósito:** Acción para marcar todos los avisos como leídos
- **Rutas:** `/messages`

### ActivityTimelineItem (Ítem de línea de tiempo)
- **Propósito:** Un hito en la actividad compartida del proceso
- **Datos necesarios:** eventKey, createdAt, caseTitle?
- **Privacidad:** Solo eventos compartidos. Sin actividad de posiciones privadas.
- **Rutas:** `/notices/activity`, MediatorActivityScreen

### DeadlineNoticeCard (Aviso de deadline)
- **Propósito:** Aviso visual de SLA próximo a vencer
- **Datos necesarios:** slaHours
- **Rutas:** Dashboard, CaseDetailScreen

---

## Componentes de Tareas

### TaskCard (Card de tarea)
- **Propósito:** Una tarea post-acuerdo
- **Datos necesarios:** title, description, status, deadline?
- **Acciones:** completar, posponer
- **Estados:** pendiente, en_progreso, completada
- **Rutas:** A integrar en CaseDetailScreen/AgreementScreen

### TaskListSection (Sección de tareas)
- **Propósito:** Agrupar tareas por estado
- **Datos necesarios:** tasks[], title
- **Rutas:** A integrar

### TaskStatusBadge (Badge de estado de tarea)
- **Propósito:** Indicador visual del estado de la tarea
- **Datos necesarios:** status
- **Rutas:** TaskCard

### TaskCalendarAction (Agregar al calendario)
- **Propósito:** Botón para agregar tarea al calendario del dispositivo
- **Rutas:** TaskCard

---

## Componentes de Perfil

### ProfileHeaderCard (Cabecera de perfil)
- **Propósito:** Mostrar nombre, rol y avatar
- **Datos necesarios:** nombre, apellido, rol
- **Rutas:** `/profile`

### ProfileMenuItem (Ítem de menú de perfil)
- **Propósito:** Link a sub-sección del perfil
- **Datos necesarios:** icon, label, destino
- **Rutas:** `/profile`

### SignOutDialog (Confirmación de cierre de sesión)
- **Propósito:** Diálogo antes de cerrar sesión
- **Estados:** idle, signingOut
- **Rutas:** `/profile/account`

### DeactivationDialog (Confirmación de desactivación)
- **Propósito:** Diálogo antes de solicitar desactivación
- **Estados:** idle, requesting, error
- **Rutas:** `/profile/account`

### LanguageSelector (Selector de idioma)
- **Propósito:** Cambiar idioma de la app
- **Datos necesarios:** idioma actual
- **Rutas:** `/profile/edit`

### NotificationPreferenceRow (Preferencia de notificación)
- **Propósito:** Toggle para un tipo de notificación
- **Datos necesarios:** label, enabled
- **Rutas:** `/profile/notifications`

---

## Componentes Transversales

### EmptyState
- **Propósito:** Estado vacío genérico (sin datos)
- **Datos necesarios:** icon, title, description, action opcional
- **Rutas:** Dashboard, Posiciones, Acuerdo, Avisos

### ErrorState
- **Propósito:** Estado de error con opción de reintentar
- **Datos necesarios:** title, description opcional, retryLabel, onRetry
- **Rutas:** Todas las pantallas

### LoadingState
- **Propósito:** Indicador de carga genérico
- **Datos necesarios:** label
- **Rutas:** Todas las pantallas

### AIProcessingState
- **Propósito:** Estado específico de procesamiento de IA
- **Datos necesarios:** badgeLabel, statusLabel, description
- **Rutas:** NegotiationScreen (generando propuesta)

### ConfirmationDialog
- **Propósito:** Diálogo de confirmación genérico
- **Datos necesarios:** title, body, confirmLabel, cancelLabel, variant
- **Estados:** idle, submitting, error
- **Rutas:** Usado por múltiples features

### StatusPill
- **Propósito:** Pastilla de estado visual
- **Datos necesarios:** status (success, warning, error, info, neutral, ai), children
- **Rutas:** Dashboard, CaseDetail, Negotiation, Agreement

### Badge
- **Propósito:** Etiqueta visual pequeña
- **Datos necesarios:** variant, children
- **Rutas:** CaseDetail (método)

### EntityTypeIndicator
- **Propósito:** Ícono + color para indicar tipo de entidad o estado
- **Datos necesarios:** icon, status/color
- **Rutas:** CaseCard, SignatureInboxCard, NoticeCard

### ResponsiveColumns
- **Propósito:** Layout responsive primario/secundario
- **Datos necesarios:** primary, secondary
- **Comportamiento:** Mobile: stack vertical. Desktop (≥1024px): 2 columnas (2:1).
- **Rutas:** CaseDetailScreen, NegotiationScreen, AgreementScreen, MediatorScreen, ProfileScreen
