# Proyecto Mediación — Contexto de producto para Stitch

> **Propósito:** Permitir que Stitch entienda el producto sin leer todo el repositorio.
> **Enfoque:** Funcional, no visual. Reglas de negocio, flujos, roles y privacidad.
> **El diseño visual actual no es una restricción.**

---

## 1. Resumen del producto

Proyecto Mediación es una aplicación de resolución de conflictos familiares mediante negociación, conciliación y mediación.

Dos partes en conflicto:
1. Crean o se unen a un caso
2. Cargan posiciones de forma privada (cada una no ve las de la otra)
3. Indican rangos de acuerdo y condiciones de cesión
4. Reciben propuestas generadas por IA (sanitizadas, sin exponer datos privados)
5. Aceptan o rechazan propuestas
6. Avanzan por rondas de negociación
7. Desde la ronda 3 pueden solicitar un mediador humano
8. Al alcanzar acuerdo se genera un documento de acuerdo
9. Firman digitalmente (mock en la versión actual)
10. Exportan el acuerdo
11. Registran avisos de incumplimiento
12. Gestionan tareas posteriores al acuerdo

El producto también contempla roles de Mediador, Estudio jurídico y Administrador, aunque varios están en desarrollo temprano.

---

## 2. Usuarios y roles

| Rol | Descripción | Estado de implementación |
|-----|-------------|--------------------------|
| **Parte** | Usuario principal. Crea/se une a casos, carga posiciones, negocia, firma. | Implementado (frontend mock) |
| **Contraparte** | La otra parte del caso. No tiene login propio en el mock. Comportamiento simulado. | Simulado |
| **Mediador** | Profesional humano que interviene desde ronda 3. | Mock de perfil y solicitud. Sin backend real ni sesión. |
| **Estudio jurídico** | Firma o bufete que supervisa casos. | Shell — solo package.json en apps/panel. No hay UI. |
| **Admin** | Administrador de plataforma. | No implementado en frontend. Backend tiene roles. |

---

## 3. Problema que resuelve

Conflictos familiares (custodia, alimentos, bienes, cronogramas) que necesitan resolución sin litigio judicial. La app permite negociar de forma estructurada con asistencia de IA que propone puntos medios sin exponer información privada de cada parte.

---

## 4. Arquitectura funcional

### Stack técnico

| Componente | Tecnología |
|------------|-----------|
| Framework | React Native 0.81.5 + Expo 54 + Expo Router 6 |
| Lenguaje | TypeScript 5.9 strict mode |
| UI | Design system propio (design-system/tokens + components) |
| Estado | Sin librería global. Servicios mock + hooks locales + useFocusEffect |
| i18n | i18next + react-i18next (es-AR / en) |
| Autenticación | Supabase Auth (AuthGate se desactiva sin backend) |
| Backend | NestJS 11 + Kysely + Supabase Postgres |
| Testing | Jest + @testing-library/react-native |

### Arquitectura de capas

```
app/          → Expo Router routes (thin — delegan en features)
features/     → Pantallas, componentes y hooks por dominio
services/     → Lógica de negocio mock (singleton + factory)
  api/        → Capa HTTP real (backend.ts, http-client.ts)
mocks/        → Fixtures y matrices determinísticas
types/        → Tipos de dominio (1 archivo por dominio)
design-system/→ Componentes base y tokens
i18n/         → Locale strings
utils/        → Funciones puras (eligibilidad, validación)
```

### Estrategia de datos

- **Sin backend:** todos los servicios usan mocks in-memory. Se limpian al reiniciar la app.
- **Con backend:** `backend-instance.ts` crea un cliente HTTP real. Si no hay backend configurado, todos los servicios usan sus versiones mock.
- **Persistencia:** Solo session de Supabase vía AsyncStorage. Nada de casos o posiciones persiste localmente.
- **Estado:** Hooks por feature con patrón `status: loading|error|empty|success`. Mutaciones con `MutationStatus: idle|pending|error`.
- **Sin librerías de estado global:** No Redux, Zustand, TanStack Query, ni XState. Solo Context para wizards efímeros (creación de caso y posición).

### Internacionalización

- Detecta idioma del dispositivo vía `expo-localization`
- es-AR (default), en (fallback)
- Strings en `i18n/locales/{es-AR,en}.json`
- Contenido de dominio (títulos de casos, propuestas) es "backend-provided content", no strings de UI

---

## 5. Mapa de navegación

### Estructura de rutas (simplificada)

```
/(tabs)                   → Tab navigator (mobile) / Desktop sidebar (web ≥1024px)
  /                       → Dashboard de casos
  /messages               → Centro de avisos (notices)
  /signatures             → Bandeja de firmas pendientes
  /profile                → Perfil y configuración

/case/create              → Wizard de creación de caso (4 pasos)
/case/join                → Unirse a caso por token
/case/[id]                → Detalle de caso
/case/[id]/positions      → Lista de posiciones propias
/case/[id]/positions/create → Carga de nueva posición
/case/[id]/positions/[positionId]/edit → Editar posición
/case/[id]/positions/review → Revisar antes de guardar
/case/[id]/negotiation    → Dashboard de negociación
/case/[id]/negotiation/history → Historial de rondas
/case/[id]/agreement      → Dashboard de acuerdo
/case/[id]/agreement/sign → Firma del acuerdo
/case/[id]/agreement/history → Historial de acuerdo
/case/[id]/mediator       → Dashboard de mediador
/case/[id]/mediator/activity → Actividad del mediador

/profile/edit             → Editar perfil
/profile/account          → Cuenta (sign-out, desactivación)
/profile/notifications    → Preferencias de notificación
/profile/help             → Ayuda
/profile/legal            → Información legal
/profile/privacy          → Privacidad

/notices/activity         → Línea de tiempo compartida

/login                    → Inicio de sesión
/signup                   → Registro
/signed-out               → Pantalla post sign-out
```

### Navegación responsive

- **Mobile (<768px):** Bottom tabs + stacks anidados
- **Tablet (768-1023px):** Misma estructura que mobile
- **Desktop (≥1024px):** Sidebar izquierda (248px) + contenido. Bottom tabs ocultos. Sidebar solo en web.

---

## 6. Flujos principales

Ver `user-flows.md` para diagramas Mermaid detallados de cada flujo.

### Resumen de flujos

1. **Registro/Login:** Supabase Auth. Email + password + nombre/apellido. Con backend real, auth gate bloquea acceso sin sesión. Sin backend, pasa directo a mocks.
2. **Creación de caso:** Wizard 4 pasos (nombre/descripción → método → revisión → éxito). Crea caso con `estado: 'nuevo'`.
3. **Invitación de contraparte:** Link, código o email. Token generado por mock.
4. **Unión a caso:** Por token. Backend: `POST /casos/unirse`.
5. **Simulación de aceptación:** Botón en CaseDetailScreen para avanzar el mock `nuevo → activo`.
6. **Carga de posiciones:** CRUD privado. Cada parte solo ve las propias.
7. **Negociación:** Rondas secuenciales. Generar propuesta IA → revisar → aceptar/rechazar → siguiente ronda.
8. **Mediador desde ronda 3:** Solicitar → mock asigna (aceptada/solicitada/rechazada).
9. **Acuerdo:** Se materializa automáticamente de propuesta aceptada.
10. **Firma:** Preparar documento → firmar (mock) → esperar contraparte → completado.
11. **Incumplimiento:** Solo desde `firmado`/`con_aviso`. Formulario + diálogo de confirmación.
12. **Tareas post-acuerdo:** Backend genera accionables. Frontend no tiene UI de tareas aún (solo componentes en features/tasks/).
13. **Avisos:** Centro de notificaciones con filtros (todas/no leídas) y navegación tipada.

---

## 7. Entidades del dominio

Ver `domain-model.md` para detalle completo.

| Entidad | Estados | Visibilidad |
|---------|---------|-------------|
| **Caso** | nuevo, activo, en_negociacion, acordado, cerrado, terminado, vencido | Ambas partes ven lo mismo |
| **Posición** | Sin estados. Es privada. | Solo el dueño |
| **Ronda** | activa, completada | Compartido |
| **Propuesta** | pendiente, aceptada, rechazada | Compartido (sanitizado) |
| **Mediación** | solicitada, aceptada, rechazada, activa, finalizada | Compartido |
| **Acuerdo** | borrador, enviado_a_firma, firmado, con_aviso | Compartido |
| **Firma** | pendiente, firmado (mock) | Compartido (sin identificadores) |
| **Aviso** | Categorías: case, invitation, proposal, response, round, agreement, signature, mediator, deadline, institutional, system | Personal |
| **Tarea** | pendiente, en_progreso, completada | Compartido |

---

## 8. Estados del producto

Ver `state-machines.md` para máquinas de estado completas con Mermaid.

### Regla fundamental de estado

- **El estado autoritativo viene del backend.** El frontend nunca inventa estados.
- **Estados derivados:** eligibility, canRequest, readOnly, waitingForOtherParty, etc. se calculan fresh en cada lectura.
- **Estados transitorios:** generating, preparing, submitting son MutationStatus locales, nunca persistentes.

---

## 9. Reglas de negocio

### RN-01: Aislamiento absoluto de posiciones (CRÍTICA)
Una parte NUNCA ve las posiciones privadas de la contraparte. No existe ningún método `getAllPositions`, `getCounterpartyPositions`, ni `comparePositions` en el código.

### RN-02: Propuestas sanitizadas
Las propuestas de IA contienen solo puntos medios derivados (meeting points), nunca valores privados de ninguna parte.

### RN-03: Mediador desde ronda 3
El botón de solicitar mediador solo aparece cuando el caso está en estado `activo`/`en_negociacion` Y la ronda actual es ≥3.

### RN-04: Transiciones de estado del caso
- `nuevo → activo` (cuando la contraparte acepta invitación)
- `activo → en_negociacion` (al iniciar primera ronda)
- `en_negociacion → acordado` (cuando ambas partes aceptan propuesta)
- `acordado → cerrado` (tras firma completa)
- Las transiciones las valida el backend con triggers. El frontend solo refleja.

### RN-05: Pertenencia al caso
Toda acción sobre un caso requiere que el usuario sea parte del caso. El backend devuelve 404 (no 403) para no revelar existencia de casos ajenos.

### RN-06: Firma conjunta obligatoria
El acuerdo pasa a `firmado` solo cuando AMBAS partes firman. El frontend deriva `allSignaturesComplete` de este hecho, no al revés.

### RN-07: Solo una ronda activa por caso
No puede haber dos rondas `activa` simultáneas en el mismo caso.

### RN-08: Solo una propuesta por ronda
Cada ronda activa puede tener exactamente una propuesta. `generateSharedProposal` rechaza si ya existe.

### RN-09: Propuesta pendiente bloquea nueva ronda
No se puede iniciar nueva ronda mientras haya una propuesta `pendiente` sin respuesta de ambas partes.

### RN-10: Incumplimiento solo post-firma
Solo acuerdos en estado `firmado` o `con_aviso` pueden recibir avisos de incumplimiento.

### RN-11: Contraparte simulada no revela decisión antes que la parte autenticada
La decisión simulada de la contraparte solo se aplica DESPUÉS de que la parte autenticada envía su propia respuesta.

### RN-12: No cancelación de mediación
No existe flujo de cancelación de solicitud de mediador. Una vez creada, es inmutable en la sesión.

---

## 10. Privacidad y datos sensibles

Ver `privacy-rules.md` para documentación exhaustiva.

### Reglas críticas

1. **Posiciones privadas:** Nunca visibles para la contraparte. El servicio `positions.service.ts` solo expone `getOwnPositions`.
2. **Propuestas:** Solo muestran `meetingPoint` (punto medio derivado) y `narrative` (texto generado). Nunca incluyen valores originales.
3. **Firmantes:** `SharedSignerStatus` solo expone `role: 'authenticated_party' | 'other_party'`. Sin `usuario_id`, email, ni identificadores.
4. **Mediador:** Perfil demo ficticio ("Lucía Fernández"). Sin credenciales reales, matrícula, ni datos de contacto.
5. **Datos nunca expuestos en UI:** email, documento, teléfono, password_hash, verif_biometrica, tokens, estudio_id.
6. **Datos nunca en frontend:** `position.valueMin/valueMax` de la contraparte, `concessionConditions` ajenas, descripciones privadas ajenas.
7. **Backend 404 para no-miembros:** Un no-miembro del caso recibe 404, no 403, para no revelar que el caso existe.
8. **Onboarding:** `POST /auth/consentimiento` es first-write-wins. `POST /auth/biometria` solo acepta resultado final (`aprobada`/`rechazada`), no `pendiente`.

---

## 11. Jerarquía de contenido por pantalla

Ver `screen-content-model.md` para el modelo completo por pantalla.

---

## 12. Acciones primarias y secundarias

| Pantalla | Acción primaria | Acciones secundarias |
|----------|----------------|---------------------|
| Dashboard casos | Crear caso | Abrir caso existente |
| Detalle caso (nuevo) | Ver/crear invitación | Simular aceptación |
| Detalle caso (activo) | Cargar posiciones | Ir a negociación, mediador |
| Posiciones | Crear posición | Editar, eliminar, ver lista |
| Negociación | Generar propuesta / Responder | Ver historial, solicitar mediador |
| Acuerdo | Preparar documento | Firmar, exportar, reportar incumplimiento |
| Perfil | Editar perfil | Cerrar sesión, desactivar cuenta |

---

## 13. Estados vacíos, errores y cargas

| Estado | Componente design-system | Uso |
|--------|--------------------------|-----|
| Loading | `LoadingState` | Carga inicial de datos |
| Empty | `EmptyState` | Sin casos, sin posiciones, sin acuerdo |
| Error | `ErrorState` | Fallo de red/mock, con retry |
| AI Processing | `AIProcessingState` | Generación de propuesta en curso |
| Document preparing | `DocumentPreparationState` | Preparación de documento de firma |

---

## 14. Requisitos mobile, tablet y web

- **Android/iOS:** React Native + Expo. Funcionalidad completa.
- **Web:** react-native-web. Misma base de código.
- **Breakpoints:** compactMax 767px, mediumMin 768px, wideMin 1024px, extraWideMin 1440px.
- **Sidebar desktop:** Solo web ≥1024px. 248px de ancho.
- **Touch targets:** Mínimo 44×44px.

---

## 15. Accesibilidad

- Roles ARIA en componentes (`accessibilityRole="header"`, `accessibilityRole="button"`, `accessibilityRole="link"`)
- `accessibilityLabel` en acciones
- `accessibilityLiveRegion="polite"` en cambios de estado
- Badge de no leídos oculto de accessibility tree (ya anunciado en label)
- Sin dependencia exclusiva de color para estados

---

## 16. Internacionalización

- **Idiomas:** español (es-AR, default) e inglés (en)
- **Detección:** `expo-localization` → device language code
- **Copia:** Argentino (voseo: "Generá", "Podés", "Elegí"). Sin emojis, sin ALL-CAPS.
- **Contenido de dominio** (títulos, propuestas) es bilingüe en fixtures.

---

## 17. Componentes conceptuales necesarios

Ver `component-requirements.md` para el inventario completo.

Componentes clave que Stitch debe diseñar:
- CaseCard, CaseStatusBadge, CaseCreationProgress
- PrivatePositionForm, PositionList, PositionCard
- NegotiationRoundCard, ProposalCard, ProposalResponseActions
- MediatorStatusPanel, MediatorRequestButton
- AgreementCard, SignatureProgress, SignatureConfirmation
- BreachNoticeForm, PostAgreementTaskCard
- NoticeCard, NoticeFilterBar, ActivityTimelineItem
- InvitationPanel, EmptyState, ErrorState, LoadingState

---

## 18. Funcionalidades implementadas

- [x] Dashboard de casos
- [x] Creación de caso (wizard completo)
- [x] Invitación (link, código, email)
- [x] Unión a caso por token
- [x] Simulación de aceptación de invitación
- [x] CRUD de posiciones privadas
- [x] Negociación por rondas
- [x] Generación de propuestas IA (mock)
- [x] Aceptación/rechazo de propuestas
- [x] Centro de avisos con filtros y badge
- [x] Línea de tiempo de actividad compartida
- [x] Solicitud de mediador (desde ronda 3)
- [x] Acuerdo (materialización + preparación)
- [x] Firma mock
- [x] Perfil, preferencias, cuenta
- [x] Responsive (mobile + tablet + desktop web)
- [x] i18n (es-AR + en)
- [x] Dark mode (no implementado — phase 1 light-only)

## 19. Funcionalidades parciales o shells

- [~] **Exportación de acuerdo:** Botón existe pero es no-op. Backend retorna texto plano.
- [~] **Registro de incumplimiento:** Formulario + diálogo, pero sin backend real (placeholder).
- [~] **Tareas post-acuerdo:** Componentes en features/tasks/ y backend implementado, pero sin integración en UI de caso.
- [~] **Mediador:** Solo mock de solicitud. Sin sesión de mediador real, sin chat, sin gestión de casos.
- [~] **Panel de estudio jurídico:** Solo package.json. Sin UI.
- [~] **Planes/pagos:** Backend implementado (planes, suscripciones, MercadoPago). Frontend sin UI.
- [~] **Onboarding (biometría, consentimiento):** Backend implementado. Frontend sin pantallas dedicadas.
- [~] **Notificaciones push:** Backend tiene tabla `notificaciones`. Sin integración frontend.
- [ ] **Administración:** Sin UI de admin.

## 20. Diferencias entre documentación y código

Ver `route-map.md` para hallazgos detallados con severidad.

---

## 21. Libertades del redesign

Stitch PUEDE cambiar:
- Layout completo de cada pantalla
- Navegación visual (tabs, sidebar, breadcrumbs, etc.)
- Jerarquía visual de información
- Paleta de colores, tipografía, iconografía
- Estilo de cards, formularios, botones
- Composición y densidad de información
- Presentación de estados (loading, empty, error)
- Lenguaje visual general
- Orden visual de elementos (mientras no altere el flujo lógico)
- Animaciones y transiciones
- Estilo de tabs, sidebar, navegación inferior

## 22. Restricciones no negociables

Stitch NO PUEDE cambiar sin validación:
- Reglas de negocio (RN-01 a RN-12)
- Permisos por rol
- Privacidad entre partes (posiciones nunca visibles para contraparte)
- Disponibilidad de mediador desde ronda 3 (con round number ≥ 3)
- Estados autoritativos (enums del backend)
- Condiciones de firma (ambas partes deben firmar)
- Significado legal de acuerdos
- Acciones existentes en el producto
- Soporte Android/iOS (React Native + Expo)
- Soporte español/inglés
- Pertenencia al caso para cualquier acción
- Confirmación de pagos vía backend/webhook (no local)

---

## 23. Capturas de contexto

Ver `screenshot-manifest.json` para el inventario de capturas.

---

## 24. Preguntas abiertas

1. **UI de tareas post-acuerdo:** El backend genera tareas, pero ¿dónde y cómo se muestran en la app?
2. **Panel de estudio jurídico:** ¿Qué funcionalidad específica necesita? ¿Dashboard multi-caso? ¿Reportes?
3. **Onboarding UI:** ¿Pantalla dedicada de consentimiento legal? ¿Flujo de verificación biométrica?
4. **Planes y suscripciones:** ¿Se muestran en la app móvil? ¿Solo web?
5. **Chat mediador-partes:** No existe en el schema de backend. ¿Se necesita?
6. **Notificaciones push:** ¿Proveedor? ¿Expo Push Notifications?

---

## 25. Checklist para Stitch

- [ ] Leer `stitch-product-context.md` (este archivo)
- [ ] Leer `route-map.md` para entender cada pantalla
- [ ] Leer `user-flows.md` para entender flujos completos
- [ ] Leer `roles-permissions.md` para matriz de permisos
- [ ] Leer `domain-model.md` para entidades y relaciones
- [ ] Leer `state-machines.md` para estados y transiciones
- [ ] Leer `privacy-rules.md` para restricciones de datos
- [ ] Leer `component-requirements.md` para inventario funcional
- [ ] Leer `stitch-master-prompt.md` para el brief de diseño
- [ ] Proponer 3 direcciones de diseño distintas
- [ ] Diseñar mobile-first (375px)
- [ ] Contemplar tablet (768px) y desktop (1280px+)
- [ ] Preservar todos los flujos funcionales
- [ ] Respetar privacidad entre partes
- [ ] Incluir todos los estados (loading, empty, error, success, transiciones)
- [ ] Mantener neutralidad visual entre partes
- [ ] Evitar estética judicial agresiva
- [ ] Priorizar calma, confianza y claridad
- [ ] Entregar sistema de diseño consistente
