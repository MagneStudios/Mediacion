# Implementation mapping — Stitch → React Native (análisis, sin implementar)

Este documento es solo análisis. No se tocó ningún archivo de producto (`app/`, `features/`, `components/`, `services/`, `hooks/`, `types/`, ni tests) para producirlo.

**Hallazgo transversal más importante:** los tres diseños seleccionados usan una **paleta acuática** (`bg-hielo`, `mediation-aqua`, tonos azul/turquesa) completamente distinta de la paleta actual del código (`design-system/tokens/colors.ts`: canvas crema `#f5f1ec`, tinta carbón `#111`, acento sage `#45645e` reservado para IA). Esto no es un ajuste visual menor — implica introducir un set de tokens nuevo (o reemplazar el existente) antes de que cualquier pantalla pueda parecerse de verdad al diseño aprobado. Se documenta como su propia línea de trabajo en la sección de PRs.

---

## 1. Listado de casos

- **Ruta real:** `app/(tabs)/index.tsx` (`CasesDashboardScreen`).
- **Componentes actuales:** `features/cases/components/CaseCard.tsx` (ya tiene `EntityTypeIndicator` + accent bar por `visualStatus`, ver `agents/front/AGENTS.md` fase 11), grid responsive (`numColumns={isWide ? 2 : 1}`).
- **Hooks a conservar:** `features/cases/hooks/useCases.ts` — union discriminada `status: loading|error|empty|success`, silent refresh vía `useFocusEffect`. No cambiar esta forma de estado.
- **Servicios a conservar:** `services/cases.service.ts` (mock, in-memory, singleton + `createMockCasesService()`).
- **Callbacks existentes:** navegación a `/case/[id]` por tarjeta; `reload()` en el estado `error`.
- **Estados loading/empty/error/success:** ya cubiertos 1:1 por `UseCasesResult` — el rediseño solo debe re-skinnear cada rama, nunca colapsarlas.

**Piezas visuales tomadas de Stitch (v4-desktop/v4-mobile):**
- Bloque "Próxima acción" por tarjeta con texto concreto ("Revisar propuesta de ajuste enviada por la contraparte").
- CTA contextual por tarjeta ("Responder propuesta" / "Continuar caso") — hoy `CaseCard` no tiene un CTA de texto explícito, solo navega al tocar la tarjeta completa.
- Chip de método ("Negociación Directa") + indicador de estado, coherente con el patrón `EntityTypeIndicator` ya existente (reusar el primitivo, no crear uno nuevo).
- Buscador superior ("Buscar casos...") — no existe hoy en el dashboard.

**Reutilizable:** estructura de grid 1/2 columnas, la idea de accent bar + chip de estado (ya existe como `EntityTypeIndicator`, solo hay que mapear los nuevos colores acuáticos a sus tokens).

**Debe reinterpretarse para RN:** el sidebar fijo de escritorio en el HTML de Stitch (`<aside>` con nav Casos/Avisos/Firmas/Perfil) es **exactamente** lo que ya construyó `components/DesktopSidebar.tsx` en la fase 10 — no crear un segundo sidebar, mapear solo el estilo. El header sticky con `backdrop-blur-xl` no tiene equivalente nativo directo fuera de web (`Platform.OS !== 'web'` gating, como ya hace el resto del código con animaciones/blur).

**Patrones web-only que NO deben copiarse:** `backdrop-blur`, `hover:` (RN no tiene hover real), URLs de imagen absolutas de `lh3.googleusercontent.com` (son placeholders de Stitch, no assets reales del producto), fuente cargada por `<link>` a Google Fonts (el proyecto ya usa `@expo-google-fonts/*`).

**Assets reutilizables:** ninguno directamente descargable — los íconos son `material-symbols-outlined` (Google Material Symbols font); el proyecto ya usa `lucide-react-native`, por lo que hay que mapear ícono-a-ícono, no importar la fuente de Material Symbols.

**Diferencias funcionales Stitch vs. real:** el HTML no tiene loading/empty/error states — Stitch solo genera el estado "success con datos". El buscador visible en el HTML no tiene service/hook detrás hoy.

**Riesgos funcionales:** ninguno de privacidad — el listado de casos no expone datos de la contraparte, solo resúmenes ya sanitizados (`CaseSummary`).

**Restricciones de privacidad:** N/A para esta pantalla (no hay posiciones privadas involucradas).

---

## 2. Detalle del caso

- **Ruta real:** `app/case/[id]/index.tsx` (`CaseDetailScreen`).
- **Componentes actuales:** `ResponsiveColumns` (primary: posiciones + negociación; secondary: mediador + acuerdo), `MediatorSummaryCard` (con `hideWhenUnavailable`), tarjetas de posiciones propias.
- **Hooks a conservar:** `features/cases/hooks/useCaseDetail.ts`; la elegibilidad del mediador sigue viniendo de `utils/mediator-eligibility.ts` (`getMediatorEligibility`), nunca hardcodeada en la UI.
- **Servicios a conservar:** `services/cases.service.ts`, `services/mediator.service.ts`, `services/negotiation.service.ts` (solo para el conteo de posiciones propias, nunca las de la contraparte).
- **Callbacks existentes:** `simulateInvitationAcceptance`, navegación a positions/negotiation/agreement/mediator.

**Piezas visuales tomadas de Stitch (v3-desktop/v3-mobile):**
- Header con banner de acción principal ("Revisar propuesta de custodia compartida" + CTA).
- Tarjeta "Tu Posición Privada" con leyenda explícita "La contraparte no puede verla." — **coincide exactamente** con RN-01 y debe conservarse literalmente, no suavizarse.
- Tarjeta de "Contraparte" (solo muestra que existe, nunca su contenido).
- Sección de mediador **condicional**: "La asignación de un mediador se confirmará en la siguiente fase de negociación." cuando no hay mediador asignado — coincide con el patrón real (`hideWhenUnavailable`/eligibilidad por ronda).

**Reutilizable:** la jerarquía "estado → próxima acción → posición propia → contraparte (sanitizada) → mediador (condicional)" es prácticamente 1:1 con lo que `CaseDetailScreen` ya organiza vía `ResponsiveColumns`.

**Debe reinterpretarse para RN:** el layout de dos columnas de escritorio en el HTML de Stitch debe mapearse a `ResponsiveColumns` existente, no a un grid CSS nuevo.

**Patrones web-only que NO deben copiarse:** ninguno adicional a los ya listados en la pantalla 1.

**Diferencias funcionales Stitch vs. real:** el HTML estático no puede mostrar los distintos estados reales de `estado_caso` (`nuevo|activo|en_negociacion|acordado|cerrado|terminado|vencido`) — solo representa un caso `en_negociacion`. La implementación real debe seguir cubriendo los 7 estados, no solo el que Stitch dibujó.

**Riesgos funcionales / privacidad:** el diseño **v3 seleccionado no expone posiciones privadas de la contraparte ni afirma que el mediador las vea** — verificado por lectura del HTML, no asumido. La versión v2 descartada sí violaba dos criterios (métrica de consenso inventada + mediador asignado incondicionalmente) — **no usar v2 como referencia ni siquiera parcialmente**.

---

## 3. Propuesta de IA

- **Ruta real:** `app/case/[id]/negotiation/index.tsx`.
- **Componentes actuales:** `SharedProposalCard`, `ProposalResponseDialog` + `ProposalResponseActions`, `CurrentRoundCard`, `MeetingPointRow`, `WaitingForPartyState`, `NegotiationSummaryCard`, `RoundHistoryCard`.
- **Hooks a conservar:** `features/negotiation/hooks/useNegotiation.ts` — `status: loading|error|success` para el fetch, más tres `MutationStatus` independientes (`startRoundStatus`, `generateStatus`, `respondStatus`). El rediseño **no debe** colapsar estas tres mutaciones en una sola, es un patrón deliberado (fases separadas: iniciar ronda / generar propuesta / responder).
- **Servicios a conservar:** `services/negotiation.service.ts` — el punto de encuentro (`MeetingPoint`) es una fixture predeterminada por `caseId`+ronda, nunca interpolada de rangos privados (documentado también en `agents/back/AGENTS.md` para el motor real).
- **Callbacks existentes:** `generateProposal()`, `submitResponse(proposalId, decision)`, `startNextRound()`, `resetRespondStatus()`.

**Piezas visuales tomadas de Stitch (v3-desktop/v3-mobile):**
- Encabezado "Nueva Propuesta" con navegación atrás.
- Sin burbujas decorativas de fondo (a diferencia de v1/v2, descartadas).
- Uso de `mediation-aqua` como color de acento — coincide con la intención de reservar un color distintivo para lo asistido-por-IA (hoy es `mediationSage` en el token actual; el rediseño reemplaza sage por el acento acuático, ver nota transversal arriba).

**Reutilizable:** la estructura general "encabezado de contexto → contenido de la propuesta → acciones" mapea directo a `SharedProposalCard` + `ProposalResponseActions`.

**Debe reinterpretarse para RN:** cualquier copy o call-to-action del HTML que sugiera que la IA "decide" en vez de "sugiere" debe corregirse en la traducción — el producto es explícito en que **la IA nunca decide, solo propone** (`agents/front/AGENTS.md`, contexto de producto). Verificar el copy exacto del HTML seleccionado contra esa regla antes de portar ningún texto literal.

**Patrones web-only que NO deben copiarse:** los mismos de las pantallas 1-2 (`backdrop-blur`, fuentes web, URLs placeholder de imagen).

**Elementos inventados por Stitch a vigilar (presentes en versiones descartadas, ausentes en la seleccionada, pero repasar igual antes de portar copy):** "65% de Consenso" (v2-desktop de Detalle del Caso, no de esta pantalla, pero mismo proyecto — confirmar que no reaparece en ningún string de v3 de Propuesta de IA antes de portar texto literal) y la etiqueta "Mediador IA" (v2-mobile de Detalle del Caso) que confunde IA con mediador humano.

**Riesgos funcionales / privacidad:** ninguna posición privada visible; el contenido de la propuesta debe seguir viniendo de la fixture sanitizada (`SharedProposal`), nunca interpolado desde `valueMin`/`valueMax` reales, tal como ya impone `negotiation.service.ts`.

---

## Separación presentación / lógica / integración / inventado-por-Stitch

| | Presentación (portar visualmente) | Lógica existente (conservar intacta) | Integración (services/hooks, sin cambios de contrato) | Inventado por Stitch (no portar literal) |
|---|---|---|---|---|
| Listado de casos | Cards, chips de método/estado, bloque "próxima acción", CTA contextual | `UseCasesResult` (4 estados), silent refresh por foco | `casesService.listCases()` | Buscador (no existe hook detrás hoy) |
| Detalle del caso | Jerarquía estado→acción→posición→contraparte→mediador, leyenda de privacidad | `getMediatorEligibility`, `ResponsiveColumns` | `casesService`, `mediator.service.ts`, conteo de posiciones propias | "65% de Consenso" y mediador incondicional (solo en v2, ya descartada — no portar aunque se vea "más simple") |
| Propuesta de IA | Encabezado, ausencia de burbujas decorativas, acento acuático | `useNegotiation` (3 mutation status independientes) | `negotiationService.generateSharedProposal/submitOwnProposalResponse` | Cualquier copy que implique que la IA decide en vez de sugerir |

---

## Propuesta de división en PRs

1. **PR0 — Design tokens.** Introducir la paleta acuática (Hielo/Aero/Aguamarina/Cerúleo/Turquesa) en `design-system/tokens/colors.ts` (o un archivo nuevo versionado), sin tocar ninguna pantalla todavía. Bloqueante para los siguientes 3 PRs — sin esto, cualquier port visual queda con los colores viejos.
2. **PR1 — Listado de casos.** Solo `features/cases/components/CaseCard.tsx` + `app/(tabs)/index.tsx`, reusando `UseCasesResult` y `EntityTypeIndicator` sin cambios de forma.
3. **PR2 — Detalle del caso.** Solo `app/case/[id]/index.tsx` + tarjetas de posición/mediador ya existentes, sin tocar `useCaseDetail` ni `mediator-eligibility.ts`.
4. **PR3 — Propuesta de IA.** Solo `features/negotiation/components/*` + `app/case/[id]/negotiation/index.tsx`, sin tocar `useNegotiation` ni `negotiation.service.ts`.

Cada PR debe verificarse en navegador real (mobile + desktop web, por el precedente ya establecido en fase 10-11) antes de mergear, no solo por lectura de código.
