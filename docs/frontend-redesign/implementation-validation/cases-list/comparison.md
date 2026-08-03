# Listado de casos — comparación visual (Stitch v4 → implementación anterior → implementación nueva)

Todas las capturas usan los mismos fixtures (`mocks/cases.ts`: `case-1` Custodia compartida/mediación/en_negociación, `case-2` Reparto de bienes/negociación/propuesta lista, `case-3` Pensión de alimentos/conciliación/firmado) y el mismo locale (`es-AR`). Viewports: mobile 390×844, desktop 1440×1000.

## VALIDACIÓN FINAL — 2026-07-31

### Veredicto definitivo: MATCH

| Verificación | Estado |
|---|---|
| Validación visual manual | **Realizada por el usuario — dirección visual aprobada** |
| Capturas automatizadas | **Omitidas por decisión del usuario** (no se generan screenshots ni scripts de Playwright) |
| Código adicional modificado | No |
| Lógica modificada | No |
| Hooks/services/rutas modificados | No |
| Design-system modificado | No |
| Tests | 52/52 pass |
| Lint | Pass (sin errores) |
| TypeScript | 1 error preexistente (`case-mapper.test.ts`), 0 nuevos |
| git diff --check | OK |
| Problemas visuales encontrados en código | 0 |

### Verificación por código

La validación visual fue aprobada manualmente por el usuario; las capturas automatizadas se omitieron por decisión explícita. El código se verificó por comportamiento declarado en todos los viewports:

| Viewport | isWide | numColumns | gridItem.maxWidth | header gap | listContentMobile | Filtros scroll |
|---|---|---|---|---|---|---|
| 320×800 | false | 1 | n/a | spacing.sm | paddingBottom: 48px | ✓ horizontal |
| 375×812 | false | 1 | n/a | spacing.sm | paddingBottom: 48px | ✓ horizontal |
| 390×844 | false | 1 | n/a | spacing.sm | paddingBottom: 48px | ✓ horizontal |
| 768×1024 | false | 1 | n/a | spacing.sm | paddingBottom: 48px | ✓ horizontal |
| 1024×900 | true | 2 | '50%' | spacing.md | n/a | ✓ horizontal |
| 1280×900 | true | 2 | '50%' | spacing.md | n/a | ✓ horizontal |
| 1440×1000 | true | 2 | '50%' | spacing.md | n/a | ✓ horizontal |

**Comportamiento de grilla (código):**
- `numColumns = isWide ? 2 : 1` — 1 columna en <1024px, 2 en ≥1024px
- `gridItem: { flex: 1, maxWidth: '50%', minWidth: 0 }` — cada ítem ocupa como máximo 50% de la fila. Ultima card de fila impar limitada a 50%, alineada izquierda.
- `columnWrapper: { gap: spacing.md, marginBottom: spacing.md }` — separación consistente entre columnas y filas

**Filtros (código):**
- `paddingRight: spacing.sm` en `contentContainerStyle` del ScrollView horizontal — último chip con respiración
- `minHeight: 44` en cada chip — touch targets accesibles
- `paddingVertical: 2, paddingHorizontal: spacing.xxs` en superficie — contenedor compacto
- CSS `:focus-visible` via `testID="case-filter-chip"` — focus ring Cerúleo en web

**Métricas (código):**
- `paddingVertical: spacing.xs` (8px), `paddingHorizontal: spacing.sm` (12px) — compactas

### Diferencias deliberadas frente a Stitch v4

| Diferencia | Motivo |
|---|---|
| Sin saludo personalizado ("Buen día, Marco") | Dato personal; nunca implementado |
| Sin avatares múltiples en footer | Sin datos de avatar en el modelo actual |
| Sin métricas de mensajes ni fechas | No existen en el modelo de datos |
| Sin "Ordenar por" | No existe funcionalidad de ordenamiento |
| Sin buscador | No implementado |
| Método con color unificado muted | Menor protagonismo frente a título y estado |
| Botones: solid para pendiente, outline para cerrado | Derivado de `ctaKey`, no de `visualStatus` |

### Resumen de archivos modificados (todas las iteraciones)

| Archivo | Iteraciones |
|---|---|
| `CasesDashboardScreen.tsx` | 1 (header compact, padding mobile) + 2 (isWide a CaseCard) + 4 (gridItem maxWidth 50%) |
| `CaseCard.tsx` | 1 (gaps, nextAction) + 2 (jerarquía 5 secciones, CTA desktop/mobile, contextualBlock, buttonVariant) + 4 (mute method labels) |
| `CaseFilters.tsx` | 1 (paddingRight) + 3 (superficie agrupada, selected/unselected/hover/focus CSS) + 4 (paddingVertical compacto) |
| `CaseSummaryBar.tsx` | 1 (superficies compactas) + 4 (padding reducido) |
| `es-AR.json` / `en.json` | 2 (resultLabel) |
| `CasesDashboardScreen.test.tsx` | 2 (getAllByText[0] en tests de filtro) |

NOTA: Las capturas automatizadas se omitieron por decisión explícita del usuario — no se generaron screenshots ni se crearon scripts de Playwright. La validación visual final fue realizada manualmente por el usuario y aprobada. No hay cambios funcionales; todos los cambios son visuales.

---

## Iteración visual exclusiva (2026-07-31)

### Iteración 4 (final): Ajustes de grilla, compactación y jerarquía

Correcciones finales sin modificar lógica, hooks, servicios, estados, traducciones, callbacks ni design-system tokens.

#### Ajuste 1 — Grid desktop: última card sin stretch

| Archivo | Cambio |
|---|---|
| `CasesDashboardScreen.tsx:147` | `gridItem` agrega `maxWidth: '50%'`. Con `flex: 1`, los ítems de una fila de 2 columnas comparten el espacio equitativamente. Una card solitaria queda limitada al 50% del ancho de fila, alineada a la izquierda, con el slot derecho vacío. |

```
[ Card 1 ][ Card 2 ]
[ Card 3 ][        ]
```

#### Ajuste 2 — Filtros: superficie más compacta

| Archivo | Cambio |
|---|---|
| `CaseFilters.tsx:105-110` | `padding: spacing.xxs` (4px all) → `paddingVertical: 2, paddingHorizontal: spacing.xxs`. Touch targets 44px conservados. Scroll horizontal y paddingRight mantenidos. |

#### Ajuste 3 — Métodos en CaseCard: menor protagonismo

| Archivo | Cambio |
|---|---|
| `CaseCard.tsx:84-87` | Eliminado `METHOD_COLOR` (colores distintos por método). Icono: 14→12px. Texto: `variant="eyebrow"` semibold 14px → `variant="caption"` regular 12px. Color unificado `text.secondary` (#526B7B, ≥5.0:1 contraste). `accessibilityLabel` conservado. |

#### Ajuste 4 — Métricas superiores: más compactas

| Archivo | Cambio |
|---|---|
| `CaseSummaryBar.tsx:51-54` | `paddingVertical: sm` (12px) → `xs` (8px). `paddingHorizontal: md` (16px) → `sm` (12px). |

#### Ajuste 5 — Card finalizada: balance del footer

El `maxWidth: '50%'` del grid asegura que la card de estado `signed` conserve su ancho de columna. La CTA outline `secondary` se alinea a la derecha en desktop y full-width en mobile como en el resto de estados. Sin cambios en lógica ni callbacks.

### Resumen de archivos modificados (iteración 4)

| Archivo | Líneas | Tipo |
|---|---|---|
| `CasesDashboardScreen.tsx` | +1 | `gridItem.maxWidth: '50%'` |
| `CaseCard.tsx` | −7 / +4 | Sin `METHOD_COLOR`, ícono 12px, `variant="caption"`, `color="secondary"` |
| `CaseFilters.tsx` | +1/−1 | `paddingVertical: 2` |
| `CaseSummaryBar.tsx` | +2/−2 | `paddingVertical: xs`, `paddingHorizontal: sm` |

### Iteraciones anteriores (referencia)

- **Iteración 3:** Rediseño visual del bloque de filtros (superficie agrupada, selected/unselected/hover/focus, CSS focus ring Cerúleo)
- **Iteración 2:** Reorganización de jerarquía de CaseCard (5 secciones, CTA contextual desktop/mobile, SLA integrado, variante de botón por ctaKey)
- **Iteración 1:** Compactado visual inicial (gaps reducidos, CaseSummaryBar en superficies compactas, header compact mobile, paddingBottom mobile)

### Veredicto final

| Requisito | Estado |
|---|---|
| Desktop: grilla de 2 columnas estable, última card sin stretch | MATCH |
| Desktop: card solitaria mismo ancho, alineada izquierda | MATCH |
| Desktop: max-width razonable (1240px) | MATCH |
| Desktop: jerarquía de 5 secciones en cada card | MATCH |
| Desktop: CTA alineado derecha, no full-width | MATCH |
| Desktop: métodos muted (caption 12px, text.secondary) | MATCH |
| Mobile: una columna, filtros sin corte, padding inferior | MATCH |
| Mobile: filtros en superficie agrupada con scroll horizontal | MATCH |
| Mobile: CTA full-width, min-height 44px | MATCH |
| Mobile: touch targets filtros 44px | MATCH |
| Bloque contextual: "Próxima acción" / "Resultado", SLA integrado | MATCH |
| Métricas superiores: compactas, datos reales, sin gráficos | MATCH |
| Filtros: selected claro sin competir con CTA principal | MATCH |
| Filtros: focus ring Cerúleo, hover, keyboard nav | MATCH |
| Card finalizada (signed): verde semántico, outline CTA, balance OK | MATCH |
| Privacidad: sin posiciones, métricas ni avatares | MATCH |
| Cards no interactivas (1 solo button role) | MATCH |
| Tests: 52/52 | MATCH |

**Resultado global: MATCH**

| | Sí/No |
|---|---|
| Lógica modificada | No |
| Design-system modificado | No |
| Desktop validado (1440×1000) | Código OK — pendiente captura visual |
| Mobile validado (390×844) | Código OK — pendiente captura visual |
| TypeScript | Error preexistente en `case-mapper.test.ts` |
| Tests | 52/52 pass |

> Las capturas deben regenerarse con el script de captura. No commitear.

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
