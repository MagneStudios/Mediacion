# Proyecto Mediación — Reglas de privacidad y seguridad funcional

> **CRÍTICO para Stitch:** Estas reglas son no negociables. El diseño visual debe respetarlas sin excepción.

---

## RN-01: Aislamiento absoluto de posiciones

**Regla:** Una parte NUNCA ve las posiciones privadas de la contraparte.

**Implementación verificada:**
- `positions.service.ts` solo expone `getOwnPositions(caseId)` — filtrado por `ownerId === MOCK_OWNER_ID`
- No existe `getAllPositions`, `getCounterpartyPositions`, `comparePositions`
- `negotiation.service.ts` solo lee `positionsService.getOwnPositions(caseId).length` (un count)
- `agreements.service.ts` NUNCA importa `positionsService`
- `mediator.service.ts` NUNCA importa `positionsService`

**Qué significa para Stitch:**
- No puede existir una pantalla o componente que muestre posiciones de ambas partes lado a lado
- No puede haber una "vista comparativa" de posiciones
- Cualquier tabla o lista etiquetada como "Posiciones" solo muestra las del usuario autenticado

---

## RN-02: Propuestas sanitizadas

**Regla:** Las propuestas de IA solo contienen puntos medios derivados, nunca valores privados.

**Implementación verificada:**
- `SharedProposal.meetingPoint` contiene `MeetingPointEntry[]` con `punto` (derivado) y `estado` (`acordable` | `negociable`)
- Los fixtures de propuestas en `mocks/negotiation.ts` son contenido predeterminado, seleccionado por caseId + roundNumber + idioma
- NUNCA se interpolan `valueMin`, `valueMax`, `concessionConditions`, `description` o `canConcede`

**Qué significa para Stitch:**
- Las propuestas pueden mostrar puntos medios numéricos y texto narrativo
- No pueden mostrar "La Parte A pidió X, la Parte B pidió Y"
- No pueden revelar qué parte cedió en qué

---

## Información privada para cada parte

### Datos que SOLO ve el dueño
- Posiciones propias (valueMin, valueMax, concessionConditions, description, canConcede)
- Respuesta propia a propuesta (`OwnProposalResponse`)
- Preferencias de perfil (communicationPreference, accessibilityPreference, notificationPreferences)
- Estado de desactivación solicitada

### Datos que SON COMPARTIDOS (ambas partes ven lo mismo)
- Datos del caso (title, caseCode, estado, metodo, roundNumber)
- Propuesta (meetingPoint, narrative, rationale, estado)
- Acuerdo (title, summary, terms, rationale, estado)
- Progreso de firmas (rol + estado de firma, sin identificadores)
- Mediación (estado, perfil del mediador si asignado)
- Actividad compartida (hitos del proceso)
- Historial de rondas (número, resumen, estado final)

### Datos que NUNCA aparecen en la UI
- Email de cualquier usuario
- Documento, teléfono
- `usuario_id` de la contraparte
- Tokens de invitación (salvo al generarlos, y solo para el creador)
- `docusign_envelope_id`
- Cualquier credencial o hash

---

## Qué puede ver el mediador

**Actualmente:** Solo existe como perfil demo. No tiene sesión ni vista de casos.

**Perfil de mediador (`SharedMediatorProfile`):**
- `displayName` (ficticio: "Lucía Fernández")
- `roleLabelKey`, `summaryKey` (i18n keys)
- `languageCodes` (['es', 'en'])
- **Sin:** email, teléfono, dirección, documento, matrícula, credenciales, rating, organización

**Cuando se implemente completamente:** El mediador debería ver el contenido compartido del caso (propuestas, acuerdos, actividad) pero NO las posiciones privadas de ninguna parte.

---

## Qué datos sensibles aparecen en onboarding

**Backend:** `POST /auth/biometria` (resultado: `aprobada`/`rechazada`), `POST /auth/consentimiento` (timestamp first-write-wins)

**Frontend:** NO hay pantallas de onboarding implementadas.

**Qué significa para Stitch:**
- Si se diseña onboarding, incluir pantalla de consentimiento legal explícito
- No almacenar datos biométricos en el frontend
- El consentimiento es first-write-wins (no se puede cambiar)

---

## Qué datos no deben almacenarse en frontend

- Posiciones de la contraparte
- Tokens de acceso (manejados por Supabase)
- Datos de pago (manejados por MercadoPago)
- Resultados biométricos
- Cualquier PII (Personally Identifiable Information) de terceros

---

## Qué acciones requieren pertenencia al caso

**TODAS las acciones sobre un caso requieren pertenencia.** Verificado en backend:
- `MembershipService.assertMembership(casoId, callerId)` se llama en TODOS los servicios case-scoped
- No-miembros reciben 404 (no 403) — no pueden distinguir "el caso no existe" de "no es mío"
- El frontend refleja esto: solo muestra casos donde el usuario es parte

---

## Qué estados deben venir del backend (no derivar en frontend)

| Estado | Fuente autoritativa | NO derivar de |
|--------|---------------------|---------------|
| `estado_caso` | `casos.estado` | `statusLabelKey` |
| `estado_propuesta` | `propuestas.estado` | `ownResponse` |
| `estado_acuerdo` | `acuerdos.estado` | `signers[].status` |
| `estado_mediacion` | `mediaciones.estado` | `eligibility` |
| `estado_invitacion` | `invitaciones.estado` | N/A |
| `firma.docusign_status` | `firmas.docusign_status` | `MockSignatureStatus` |

---

## Posibles filtraciones (auditadas)

### Componentes
- **Sin filtraciones encontradas.** Todos los componentes de features usan servicios que respetan la privacidad.

### Props
- **Sin filtraciones encontradas.** Las props de componentes compartidos no incluyen datos privados.

### Fixtures
- `mocks/cases.ts`: Solo datos compartidos (title, estado, metodo, counterpartyName). Sin posiciones.
- `mocks/negotiation.ts`: Solo decisiones simuladas (acepta/rechaza) y fixtures de propuestas sanitizadas.
- `mocks/agreements.ts`: Solo estados de firma y fixtures de acuerdos ya sanitizados.
- `mocks/profile.ts`: Solo datos del propio perfil (mock).

### Logs
- **Sin console.log de datos sensibles encontrados en el código de producción.**
- `mocks/mediator.ts`: Perfil ficticio. No es un dato real.

### Tests
- **Sin datos reales en tests.** Usan fixtures mock.

### Nombres visibles
- `counterpartyName` en casos: "Marco D." (nombre de pila + inicial). Es un dato mock.
- `displayName` de mediador: "Lucía Fernández" (nombre ficticio).

### Mensajes de error
- Errores usan códigos snake_case (`invitation_not_found`, `negotiation_not_ready`). Sin datos.
- Backend: errores con `{ code, message }`. Sin stack traces ni datos internos.

### Estados de debugging
- `__mockForceNextFailure` y similares son dev-only. No se importan en pantallas.

---

## Reglas para screenshots y prompts de diseño

Stitch NO debe incluir en prompts o screenshots:
- Nombres reales de personas
- Datos financieros reales
- Información de contacto real
- Tokens o claves
- URLs de API

Stitch PUEDE usar los datos mock del repositorio (son ficticios por diseño):
- "Custodia compartida", "Marco D.", "Lucía Fernández"
- Montos: 50000, 85000
- Códigos de caso: CASO-2026-0431
