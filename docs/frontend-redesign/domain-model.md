# Proyecto Mediación — Modelo de dominio

> Entidades del producto explicadas en lenguaje funcional.
> Cada entidad incluye propósito, relaciones, estados, acciones, visibilidad por rol y privacidad.

---

## Usuario

**Propósito:** Persona registrada en la plataforma.

**Roles:** `admin`, `parte`, `mediador`, `estudio`

**Datos de perfil (visibles para el propio usuario):**
- nombre, apellido
- rol
- idioma (`es` | `en`)
- activo (boolean)
- preferencias de comunicación y accesibilidad (mock, sin backend)
- preferencias de notificación (7 toggles booleanos, frontend-only)

**Datos NUNCA expuestos en frontend:** email, documento, teléfono, password_hash, tokens, estudio_id

**Representación frontend:** `MockProfile` en `types/profile.ts`. Datos de `mocks/profile.ts`.

---

## Parte

**Propósito:** Rol principal del usuario. Participa en casos como `parte_a` (creador) o `parte_b` (invitado).

**Relaciones:** Pertenece a uno o más casos vía `caso_partes`.

**Acciones:** Crear casos, invitar, unirse, cargar posiciones, negociar, firmar, reportar incumplimientos.

**Visibilidad de información:**
- Ve sus propios casos
- Ve posiciones PROPIAS solamente
- Ve propuestas sanitizadas (compartidas)
- Ve acuerdos y firmas (compartidos)
- NO ve posiciones de la contraparte
- NO ve respuestas raw de la contraparte (solo estado derivado)

---

## Contraparte

**Propósito:** La otra parte en un caso. En el mock actual, comportamiento simulado.

**Simulación:** Matrices determinísticas en `mocks/negotiation.ts` y `mocks/agreements.ts`. Sin sesión propia, sin perfil, sin identidad.

**En producción:** Es otro usuario con rol `parte` que se une al caso mediante token de invitación.

---

## Caso

**Propósito:** Unidad de resolución de conflicto. Contiene dos partes, posiciones, rondas, propuestas, acuerdo.

**Métodos:** `negociacion`, `conciliacion`, `mediacion`

**Estados:**
- `nuevo` — Creado, esperando que la contraparte se una
- `activo` — Contraparte unida. Se pueden cargar posiciones.
- `en_negociacion` — Primera ronda iniciada
- `acordado` — Propuesta aceptada por ambas partes
- `cerrado` — Acuerdo firmado completamente
- `terminado` — Finalizado por una parte (fin autónomo)
- `vencido` — Expirado por SLA

**Transiciones:**
```
nuevo → activo (contraparte se une)
nuevo → terminado (parte cierra)
activo → en_negociacion (primera propuesta generada)
en_negociacion → acordado (ambas aceptan propuesta)
acordado → cerrado (ambas firman)
* → vencido (sweep por SLA)
```

**Acciones por estado:**
- `nuevo`: Invitar, simular aceptación
- `activo` / `en_negociacion`: Cargar/editar posiciones, negociar, solicitar mediador
- `acordado`: Ver acuerdo, preparar firma, firmar
- `cerrado` / `terminado` / `vencido`: Solo lectura

**Representación frontend:** `CaseSummary` y `CaseDetail` en `types/case.ts`.

**Datos compartidos visibles:** title, caseCode, estado, metodo, roundNumber, counterpartyName (si existe)

**Datos privados:** Ninguno. Todo lo visible en el caso es compartido.

---

## Posición (PositionItem)

**Propósito:** Declaración privada de una parte sobre un ítem en disputa.

**Categorías:** `cuidado_ninos`, `cronogramas`, `bienes`, `economico`, `personalizado`

**Campos:**
- category, name, description
- valueMin, valueMax (rango de acuerdo)
- canConcede (booleano)
- concessionConditions (condiciones para ceder, si canConcede)

**Privacidad ABSOLUTA (RN-01):**
- `ownerId` identifica al dueño
- `private: true` (marcador explícito)
- Solo el dueño ve sus posiciones
- La contraparte NUNCA accede a estas posiciones
- El servicio de negociación solo lee `count` de posiciones propias (para eligibility)
- El servicio de acuerdos NUNCA toca posiciones (deriva de SharedProposal)

**Estados de edición:** editable (activo/en_negociacion), read_only (acordado), ineligible (nuevo/terminal)

**Representación frontend:** `PositionItem` en `types/position.ts`. CRUD via `positionsService`.

---

## Ronda (NegotiationRound)

**Propósito:** Una iteración del proceso de negociación. Cada ronda tiene una propuesta.

**Estados:** `activa` (en curso), `completada` (resuelta)

**Reglas:**
- Solo una ronda activa por caso
- Número secuencial (1, 2, 3...)
- `mediatorAvailable = true` cuando `number >= 3`
- Se completa cuando la propuesta asociada recibe respuesta de ambas partes

**Representación frontend:** `NegotiationRound` en `types/negotiation.ts`.

---

## Propuesta (SharedProposal)

**Propósito:** Resultado sanitizado del motor de IA. Propone puntos medios entre las posiciones de ambas partes.

**Contenido:**
- `meetingPoint: MeetingPointEntry[]` — Puntos de encuentro por categoría
  - `punto: number | null` (null = no numérico)
  - `estado: 'acordable' | 'negociable'` (overlap vs midpoint)
- `narrative: string | null` — Texto generado por IA. null = generando.
- `rationale?: string` — Fundamentación de la propuesta

**Estados:** `pendiente` (sin respuesta completa), `aceptada` (ambas aceptan), `rechazada` (al menos una rechaza)

**Privacidad:**
- Contenido 100% sanitizado. NUNCA incluye valores privados.
- `meetingPoint` son puntos medios derivados, no rangos originales.
- `narrative` es texto generado desde fixtures, no interpolado de posiciones.

**Representación frontend:** `SharedProposal` en `types/negotiation.ts`.

---

## Respuesta a propuesta (OwnProposalResponse)

**Propósito:** Decisión de la parte autenticada sobre una propuesta.

**Valores:** `acepta`, `rechaza`

**Privacidad:**
- Cada parte solo ve su propia respuesta
- La respuesta de la contraparte NUNCA se expone como objeto raw
- `waitingForOtherParty` y `bothAccepted` son estados derivados

**Representación frontend:** `OwnProposalResponse` en `types/negotiation.ts`.

---

## Mediación (MockMediation)

**Propósito:** Solicitud de intervención de un mediador humano.

**Estados:** `solicitada`, `aceptada`, `rechazada`, `activa`, `finalizada`

**Precondición:** Ronda actual ≥ 3

**Perfil de mediador:** Demo ficticio ("Lucía Fernández"). Sin backend real. Sin credenciales ni matrícula.

**Reglas:**
- Una mediación por caso
- Sin cancelación (sin `cancelada` en el schema)
- Outcome determinístico por caseId: case-1 → aceptada, case-2 → solicitada, default → rechazada

**Representación frontend:** `MockMediation` y `SharedMediatorProfile` en `types/mediator.ts`.

---

## Acuerdo (SharedAgreement)

**Propósito:** Documento de acuerdo generado a partir de una propuesta aceptada.

**Materialización:** Lazy. `ensureAgreementFromAcceptedProposal` lo crea la primera vez que se lee para un caso con propuesta aceptada.

**Estados:**
- `borrador` — Materializado, no preparado para firma
- `enviado_a_firma` — Documento preparado, listo para firmar
- `firmado` — Ambas firmas completas
- `con_aviso` — Incumplimiento registrado

**Contenido:**
- `title`, `summary` (de la propuesta aceptada)
- `terms: SharedAgreementTerm[]` (derivados del meetingPoint)
- `rationale` (de la propuesta aceptada)

**Privacidad:** Contenido deriva de SharedProposal aceptada, NUNCA de posiciones privadas.

**Reglas:**
- Un acuerdo por caso (`acuerdos_caso_unique` constraint)
- `readyAt` se setea al preparar (nunca en fallo parcial)
- `completedAt` se setea solo cuando AMBAS firmas están completas

**Representación frontend:** `SharedAgreement` y `AgreementState` en `types/agreement.ts`.

---

## Firma (SharedSignerStatus)

**Propósito:** Estado de firma de cada parte en un acuerdo.

**Roles:** `authenticated_party` (la parte actual), `other_party` (la contraparte)

**Estados:** `pendiente` (mock), `firmado` (mock)

**Privacidad:**
- Sin `usuario_id`, email, ni identificadores
- Solo rol y estado de firma
- `signedAt` es timestamp, no dato personal

**Representación frontend:** `SharedSignerStatus` en `types/agreement.ts`.

---

## Aviso (AppNotice)

**Propósito:** Notificación personal para el usuario sobre eventos del proceso.

**Categorías:** case, invitation, proposal, response, round, agreement, signature, mediator, deadline, institutional, system

**Campos:**
- category, titleKey, bodyKey (i18n keys)
- read (boolean)
- priority (normal | important)
- destination (tipado: case, negotiation, agreement, signature, mediator, activity, none)

**Navegación:** Tipada. `resolve-notice-destination.ts` mapea a rutas reales. Sin strings arbitrarios.

**Representación frontend:** `AppNotice` y `NoticeListItem` en `types/notice.ts`.

---

## Actividad (ActivityItem)

**Propósito:** Línea de tiempo compartida de hitos del proceso.

**Eventos:** case_created, invitation_sent, invitation_accepted, negotiation_started, proposal_ready, own_response_registered, round_completed, agreement_reached, signature_ready, own_mock_signature_registered, process_completed, mediator_requested, mediator_assigned, accompaniment_started

**Privacidad:**
- Solo eventos ya compartidos y seguros
- NUNCA incluye eventos de posiciones privadas
- `own_response_registered` describe solo la acción propia
- `own_mock_signature_registered` describe solo la acción propia

**Representación frontend:** `ActivityItem` y `ActivityListItem` en `types/activity.ts`.

---

## Tarea (post-acuerdo)

**Propósito:** Accionable generado automáticamente tras la firma del acuerdo.

**Estados:** `pendiente`, `en_progreso`, `completada`

**Generación:** `tarea-generation.ts` deriva una tarea por categoría del meetingPoint del acuerdo. Sin AI.

**Frontend:** Componentes `TaskCard`, `TaskListSection`, `TaskStatusBadge` existen en `features/tasks/` pero NO están integrados en ninguna pantalla de caso.

---

## Plazo / SLA

**Propósito:** Tiempo estimado para respuesta en un caso.

**Representación:** `CaseSummary.slaHours: number | null`

**Uso:** Indicador de deadline en notices. Estimación relativa, no fecha absoluta. No es un deadline legal.

---

## Semáforo (CaseVisualStatus)

**Propósito:** Indicador visual del estado de un caso.

**Valores:** `success`, `warning`, `error`, `info`, `neutral`, `ai`

**Regla:** Es una mapping de presentación. NUNCA fuente de verdad del estado del caso.

---

## Plan / Suscripción

**Propósito:** Planes de pago y suscripciones.

**Backend:** Implementado (`GET /planes`, `POST /suscripciones`, MercadoPago webhook).

**Frontend:** Sin UI.

---

## Estudio

**Propósito:** Firma o bufete jurídico que supervisa casos.

**Backend:** Tabla `estudios`. Miembros con `usuarios.estudio_id`.

**Frontend:** Sin UI. Panel de estudio es solo package.json.

---

## Carpeta

**Propósito:** Agrupación de casos bajo un estudio jurídico.

**Backend:** Sin referencias claras en el código.

**Frontend:** Sin implementar.
