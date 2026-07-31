# Listado de casos — comparación visual (Stitch v4 → implementación anterior → implementación nueva)

Todas las capturas usan los mismos fixtures (`mocks/cases.ts`: `case-1` Custodia compartida/mediación/en_negociación, `case-2` Reparto de bienes/negociación/propuesta lista, `case-3` Pensión de alimentos/conciliación/firmado) y el mismo locale (`es-AR`). Viewports: mobile 390×844, desktop 1440×1000.

## Iteración visual exclusiva (2026-07-31)

### Iteración 2: Reorganización de jerarquía de CaseCard + CTA contextual desktop/mobile

Cambio estructural de la card para acercarla a la referencia Stitch v4, manteniendo datos, callbacks y lógica intactos.

#### Nueva jerarquía (5 secciones)

| # | Sección | Composición |
|---|---|---|
| 1 | Top row | Método (icono 14px + eyebrow 12px, color por método) a la izquierda · StatusPill alineado a la derecha |
| 2 | Título | `cardTitle` (22px semibold), máximo 2 líneas, contraste alto |
| 3 | Metadata | Contraparte + ronda en `bodySm`/`secondary`, 1 línea |
| 4 | Bloque contextual | Background semántico suave, padding reducido (`xs` vertical). Label "Próxima acción" o "Resultado" (según `signed`). SLA integrado a la derecha del label (dejó de ser un `StatusPill` separado). Icono `info` o `check` según estado. |
| 5 | Footer | `borderTop` suave. Desktop: `justifyContent: flex-end`, botón `size=sm` no full-width alineado a la derecha. Mobile: botón `fullWidth`, `size=md`. |

#### Botones: variante por acción (no por visualStatus)

| CTA Key | Variante | Apariencia |
|---|---|---|
| `continue` (inReview) | `primary` | Sólido azul — acción pendiente |
| `respond` (proposalReady) | `ai` | Sólido turquesa — acción pendiente |
| `view` (signed / awaitingCounterparty) | `secondary` | Outline — caso cerrado / verificado |

#### Archivos modificados

| Archivo | Cambios |
|---|---|
| `CaseCard.tsx` | Reescritura completa del JSX y estilos: nueva jerarquía de 5 secciones, `isWide` prop, `METHOD_COLOR` por método, `contextualBlock` con SLA integrado, footer con CTA desktop-right/mobile-fullWidth, `buttonVariantFor()` por `ctaKey`. `EntityTypeIndicator` reemplazado por method badge inline con `accessibilityLabel` conservado. |
| `CasesDashboardScreen.tsx` | `isWide` pasado a `CaseCard` en el branch `numColumns > 1`. |
| `es-AR.json` / `en.json` | Nueva key `cases.resultLabel` ("Resultado" / "Result"). |
| `CasesDashboardScreen.test.tsx` | `getByText` → `getAllByText[0]` en 2 tests de filtro (ahora hay texto de método duplicado: filtro + card). |

#### Lo que NO se tocó

- `useCases`, `useResponsiveLayout`, hooks, services, stores, rutas
- `EstadoCaso`, `MetodoCaso`, `CaseSummary`, `CaseVisualStatus`, `CaseStatusLabelKey`
- `CTA_KEY`, derivación de `ctaKey` por `statusLabelKey`
- `onPress` callback — todos los CTAs siguen llamando exactamente a `onOpenCase`
- `con_aviso`, privacidad, accesibilidad (cards no interactivas, 1 solo `role="button"`)
- Design-system (`Card`, `Button`, `StatusPill`, `Icon`, `Text`, tokens)

### Iteración 1: Compactado visual inicial

| Archivo | Cambio |
|---|---|
| `CaseSummaryBar.tsx` | Rediseño: cada métrica en superficie compacta (`surface.sunken`, `radii.md`). |
| `CaseFilters.tsx` | `paddingRight: spacing.md` en `contentContainerStyle`. |
| `CasesDashboardScreen.tsx` | `headerCompact` mobile, `listContentMobile` 48px bottom padding. |

### Veredicto visual

| Requisito | Estado |
|---|---|
| Desktop: grilla de 2 columnas estable | MATCH |
| Desktop: card solitaria mismo ancho, alineada izquierda | MATCH |
| Desktop: max-width contenido (1240px) | MATCH |
| Desktop: jerarquía de 5 secciones | MATCH |
| Desktop: CTA alineado derecha, no full-width | MATCH |
| Desktop: botón sólido para acción pendiente, outline para cerrado | MATCH |
| Mobile: CTA full-width, min-height 44px | MATCH |
| Bloque contextual: altura/padding reducidos, SLA integrado | MATCH |
| Bloque contextual: "Resultado" para `signed` | MATCH |
| Método con color propio por tipo | MATCH |
| Privacidad: sin posiciones, métricas ni avatares | MATCH |
| Cards no interactivas (1 solo button role) | MATCH |
| Tests: 52/52 | MATCH |

**Resultado global: MATCH**

> Las capturas (`new-desktop.png` 1440×1000, `new-mobile.png` 390×844) deben regenerarse con `scripts/frontend-audit/capture-cases-list.mjs new` para validación visual definitiva.

| | Mobile | Desktop |
|---|---|---|
| **Referencia Stitch v4** (candidata aprobada, no implementada literalmente) | `stitch-v4-mobile.png` | `stitch-v4-desktop.png` |
| **Implementación anterior** (HEAD antes de este PR — recuperada con `git stash` sobre los 4 archivos tocados por el rediseño, servida en vivo, no una captura estática de Stitch) | `old-mobile.png` | `old-desktop.png` |
| **Implementación nueva** (este PR, en vivo) | `new-mobile.png` | `new-desktop.png` |

## Cómo se generaron

1. Servidor Expo web real (`pnpm start --web`, puerto 8081) corriendo sobre el working tree.
2. Capturas nuevas: tomadas con el working tree tal cual queda este PR (`scripts/frontend-audit/capture-cases-list.mjs new`, Playwright headless, `locale: 'es-AR'`).
3. Capturas de la implementación anterior: `git stash push` limitado a los 4 archivos que este PR modifica (`CasesDashboardScreen.tsx`, `CaseCard.tsx`, `i18n/locales/{es-AR,en}.json}`) — esto revierte exactamente esos archivos a `HEAD` (que ya incluye los tokens/foundations del PR0, pero no el rediseño visual de esta pantalla) sin perder ningún otro cambio. Metro recargó en caliente, se capturó (`capture-cases-list.mjs old`), y luego `git stash pop` restauró el rediseño. Se re-corrieron los tests de `cases` después del pop para confirmar que el working tree quedó idéntico al estado previo al stash.
4. Referencia Stitch v4: copias directas de `docs/frontend-redesign/stitch-export/selected/cases-list/{mobile,desktop}/preview.png` (ya validadas y seleccionadas en la tarea anterior) — no se re-generaron.

## Origen del literal "Buen día, Marco" / "Marco" como saludo

- **Nunca estuvo en código de la app.** Búsqueda global confirma que "Buen día"/"Hola, Marco" (el saludo personalizado) solo existe en:
  - `docs/frontend-redesign/stitch-export/selected/cases-list/desktop/screen.html` ("Buen día, Marco")
  - `docs/frontend-redesign/stitch-export/selected/cases-list/mobile/screen.html` ("Hola, Marco")
  - Las mismas líneas en `docs/frontend-redesign/stitch-export/candidates/cases-list/v4-{desktop,mobile}/screen.html` (la copia candidata, antes de promoverse a `selected/`)
  - Es decir: es texto generado por Stitch en el HTML de referencia, nunca copiado al código real. La implementación de `CasesDashboardScreen.tsx` siempre usó `t('cases.title')`, nunca un saludo interpolado con un nombre.
- **"Marco" como tal SÍ aparece legítimamente** en `mocks/cases.ts` (`counterpartyName: 'Marco D.'` — nombre de pila + inicial de la contraparte mock de los 3 casos semilla) y, por herencia, en `docs/frontend-redesign/screenshot-manifest.json`, `stitch-master-prompt.md` y `privacy-rules.md` (documentación que referencia ese mismo dato mock). Esos usos son correctos y no se tocaron — no son un saludo, son el campo real `counterpartyName` mostrado en cada card ("Marco D. · Ronda 2").
- **Reference HTML de Stitch no se editó.** Es un registro histórico de lo que Stitch generó; editarlo tergiversaría la procedencia. La decisión — documentada también en el reporte anterior — fue no portar ese saludo a la implementación real.

## Corrección aplicada en este PR

| | Antes (`cases.title`) | Ahora |
|---|---|---|
| es-AR | "Tus casos" (ya neutral, sin nombre) | **"Mis casos"** + descripción **"Revisá el estado de tus casos y los próximos pasos."** |
| en | "Your cases" | **"My cases"** + description **"Review your cases and next steps."** |

El encabezado anterior (`"Tus casos"`) ya era neutral — nunca tuvo el saludo con nombre. El cambio de este PR es puramente el texto recomendado por el usuario (`"Mis casos"`/`"My cases"`) más una descripción nueva, no una corrección de un bug de saludo personalizado que hubiera llegado a producción.

## Diferencias visuales antes → después (contenido, no solo texto)

- Encabezado: título simple → título + descripción.
- Sin resumen → barra de resumen real (total de casos + casos que esperan respuesta).
- Sin filtros → chips de filtro por método real (Todos/Negociación/Conciliación/Mediación).
- Card interactiva completa (todo el card era un botón, con chevron) → card no interactiva con "Próxima acción" + botón CTA contextual explícito como sibling (ver PR anterior para el razonamiento de accesibilidad).
- Paleta cream/sage (antes) → paleta acuática Hielo/Aero/Turquesa (ya vigente desde el PR0 de foundations, visible en ambas capturas "antes" y "después" de este PR — el cambio de paleta no es parte de este PR específico).

## Diferencias deliberadas vs. Stitch v4 (ninguna corregida ni pendiente)

Ver `docs/frontend-redesign/stitch-export/README.md` e `implementation-mapping.md` para el detalle completo. Resumen: sin saludo personalizado, sin métricas inventadas (buscador, contador de mensajes), sin avatares múltiples, CTA reutiliza siempre el mismo callback real.
