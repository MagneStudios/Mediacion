# Proyecto Mediación — Roles y permisos

> Matriz verificada contra código, mocks y documentación del backend.
> Leyenda: ✓ = implementado, ~ = parcial/mock, ✗ = no implementado, ? = a confirmar

---

## Matriz de acciones por rol

| Acción | Parte | Contraparte (simulada) | Mediador | Estudio | Admin | Fuente | Estado |
|--------|-------|------------------------|----------|---------|-------|--------|--------|
| Crear caso | ✓ | ✗ | ✗ | ✗ | ✗ | `POST /casos` | mock |
| Invitar contraparte | ✓ | ✗ | ✗ | ✗ | ✗ | `POST /casos/:id/invitaciones` | mock |
| Unirse a caso | ✓ | ✓ | ✗ | ✗ | ✗ | `POST /casos/unirse` | mock |
| Ver lista de casos propios | ✓ | ✓ | ? | ? | ? | `GET /casos` (membership-gated) | mock |
| Ver detalle de caso | ✓ | ✓ | ? | ? | ? | `GET /casos/:id` (membership) | mock |
| Cargar posiciones privadas | ✓ | ✓ (propias) | ✗ | ✗ | ✗ | `POST /casos/:id/items` | mock |
| Ver posiciones propias | ✓ | ✓ (propias) | ✗ | ✗ | ✗ | `GET /casos/:id/items` (owner-gated) | mock |
| Ver posiciones de contraparte | ✗ | ✗ | ✗ | ✗ | ✗ | RN-01 — NUNCA | mock |
| Iniciar ronda | ✓ | ✓ (simulado) | ✗ | ✗ | ✗ | `NegotiationEligibility = 'ready'` | mock |
| Generar propuesta | ✓ | ✓ (simulado) | ✗ | ✗ | ✗ | `POST /casos/:id/propuestas` | mock |
| Ver propuesta | ✓ | ✓ (compartido) | ? | ? | ? | SharedProposal — sanitizado | mock |
| Responder propuesta | ✓ | ✓ (simulado) | ✗ | ✗ | ✗ | `submitOwnProposalResponse` | mock |
| Ver respuesta de contraparte | Solo derivado | Solo derivado | ? | ? | ? | nunca raw response object | mock |
| Solicitar mediador (ronda ≥ 3) | ✓ | ✓ (simulado) | ✗ | ✗ | ✗ | `requestMediator` | mock |
| Ver perfil de mediador | ✓ (si asignado) | ✓ (si asignado) | N/A | ? | ? | SharedMediatorProfile | mock |
| Intervenir como mediador | ✗ | ✗ | ✗ (sin UI) | ✗ | ✗ | No implementado en frontend | no implementado |
| Preparar documento de acuerdo | ✓ | ✓ (compartido) | ✗ | ✗ | ✗ | `prepareSignatureDocument` | mock |
| Firmar acuerdo | ✓ | ✓ (simulado) | ✗ | ✗ | ✗ | `submitOwnMockSignature` | mock |
| Ver progreso de firmas | ✓ (compartido) | ✓ (compartido) | ? | ? | ? | SignatureProgressCard | mock |
| Exportar acuerdo | ~ (no-op) | ~ (no-op) | ✗ | ✓ (backend) | ? | Botón placeholder | parcial |
| Registrar incumplimiento | ✓ | ✓ | ✗ | ✗ | ✗ | `POST /acuerdos/:id/incumplimiento` | parcial |
| Ver tareas post-acuerdo | ~ (componentes sin integrar) | ~ | ✗ | ? | ? | `GET /casos/:id/tareas` | parcial |
| Completar tareas | ~ (sin UI) | ~ | ✗ | ? | ? | `PATCH /tareas/:id` | no implementado |
| Gestionar carpetas de estudio | ✗ | ✗ | ✗ | ✗ | ? | No implementado | no implementado |
| Ver/contratar planes | ✗ | ✗ | ✗ | ✗ | ✗ | Sin UI frontend | no implementado |
| Gestionar suscripciones | ✗ | ✗ | ✗ | ✗ | ✗ | Solo backend | no implementado |
| Cambiar configuración de IA | ✗ | ✗ | ✗ | ✗ | ✓ (backend) | `PATCH /configuracion/ia` | no implementado |
| Ver métricas/auditoría | ✗ | ✗ | ✗ | ? | ✓ (backend) | `GET /metricas`, `GET /auditoria` | no implementado |
| Ver avisos/notificaciones | ✓ | ✓ | ? | ? | ? | Notice center | mock |
| Ver actividad compartida | ✓ | ✓ | ? | ? | ? | Activity timeline | mock |
| Editar perfil propio | ✓ | ✓ | ? | ? | ? | `PATCH /me` | mock |
| Cerrar sesión | ✓ | ✓ | ✓ | ✓ | ✓ | Supabase signOut | mock |
| Desactivar cuenta | ~ (mock) | ~ | ? | ? | ? | Solo frontend mock | mock |

---

## Verificación de reglas de negocio por rol

### ¿Quién crea casos?
**Parte** (rol `parte`). Servicio `cases.service.ts`. Confirmado en código y backend (`POST /casos`).

### ¿Quién invita?
**Parte creadora** (`parte_a`). Backend: solo `parte_a` puede invitar. `POST /casos/:id/invitaciones`.

### ¿Quién se une?
**Contraparte** mediante token. Backend: `POST /casos/unirse`. La parte creadora no puede unirse a su propio caso.

### ¿Quién carga posiciones?
**Cada parte carga las suyas.** `positions.service.ts` solo expone `getOwnPositions`. `ownerId` filtra en todas las operaciones.

### ¿Quién ve propuestas?
**Ambas partes** (compartido). SharedProposal contiene solo meeting points sanitizados.

### ¿Quién responde propuestas?
**Ambas partes** (cada una su respuesta). `submitOwnProposalResponse` guarda solo la respuesta propia.

### ¿Quién solicita mediador?
**Cualquier parte** desde ronda 3. `canRequest = eligibility === 'available'`. Backend: RN-05 — "A confirmar: basta una parte o acuerdo de ambas". Frontend interpreta que basta una.

### ¿Quién interviene como mediador?
**Sin implementar en frontend.** Backend tiene `mediaciones` table pero sin write RLS policy. El mediador existe como perfil demo, no como usuario con sesión.

### ¿Quién genera acuerdos?
**Sistema.** `ensureAgreementFromAcceptedProposal` se materializa lazy al leer `getAgreementState`. Basado en propuesta aceptada.

### ¿Quién firma?
**Ambas partes.** `submitOwnMockSignature`. La firma de la contraparte simulada se revela solo después.

### ¿Quién exporta?
**Backend:** Parte y Estudio. `GET /acuerdos/:id/exportar`. **Frontend:** Botón es no-op placeholder.

### ¿Quién registra incumplimientos?
**Parte.** Backend: `POST /acuerdos/:id/incumplimiento`. Solo `parte`; `mediador` recibe 403. Frontend: formulario + diálogo sin backend.

### ¿Quién gestiona carpetas?
**Estudio jurídico.** Sin implementar. Panel es solo package.json.

### ¿Quién administra planes?
**Sin UI.** Backend tiene `GET /planes`, `POST /suscripciones`.

### ¿Quién cambia configuración de IA?
**Admin.** Backend: `PATCH /configuracion/ia`. Sin UI.

---

## Contradicciones código vs documentación

### C-001: Mediador puede registrar incumplimiento
- **Severidad:** baja
- **Documentación técnica PDF:** Matriz muestra mediador con "✓" en registro de incumplimiento
- **Código backend:** `incumplimientos.service.ts` rechaza `mediador` con `403 forbidden_role`
- **Evidencia:** `agents/back/AGENTS.md:59` — "only a Parte may report"
- **Recomendación:** Alinear documentación con código. El mediador NO puede registrar incumplimientos.

### C-002: Solicitud de mediador — una parte o ambas
- **Severidad:** media
- **Documentación:** DBML nota: "RN-05: desde ronda 3. A confirmar: basta una parte o acuerdo de ambas."
- **Código frontend:** Implementado como single-party request (cualquier parte puede solicitar)
- **Recomendación:** Confirmar con producto si se requiere acuerdo de ambas partes para solicitar mediador.

### C-003: Panel de estudio listado en documentación
- **Severidad:** baja
- **Documentación:** Menciona panel web para estudios
- **Código:** `apps/panel/package.json` vacío
- **Recomendación:** El panel es un proyecto independiente. No incluirlo en el rediseño mobile.
