# Listado de casos — comparación visual (Stitch v4 → implementación anterior → implementación nueva)

Todas las capturas usan los mismos fixtures (`mocks/cases.ts`: `case-1` Custodia compartida/mediación/en_negociación, `case-2` Reparto de bienes/negociación/propuesta lista, `case-3` Pensión de alimentos/conciliación/firmado) y el mismo locale (`es-AR`). Viewports: mobile 390×844, desktop 1440×1000.

## Iteración visual exclusiva (2026-07-31)

Refinamiento puramente visual del Listado de Casos. Sin cambios en lógica, datos, hooks, filtros, callbacks, estados, traducciones ni rutas.

### Cambios aplicados

| Archivo | Cambio |
|---|---|
| `CaseCard.tsx` | `card` gap `sm→xs`, `top` gap `sm→xs`, `title` marginBottom eliminado, `nextAction` paddingVertical `xs` + paddingHorizontal `sm`, `nextActionBody` gap eliminado. Cards más compactas, próxima acción con altura moderada, CTA ya alineado al pie. |
| `CaseSummaryBar.tsx` | Rediseño: cada métrica en su propia superficie compacta (`surface.sunken`, `radii.md`, `paddingVertical: sm`, `paddingHorizontal: md`) en vez de `row` con borde separador. |
| `CaseFilters.tsx` | `paddingRight: spacing.md` agregado al `contentContainerStyle` del `ScrollView` horizontal para evitar corte del último chip. Touch targets de 44px conservados. |
| `CasesDashboardScreen.tsx` | `headerCompact` (mobile): gap `md→sm`, marginBottom `sm→xs`, description marginTop `4→2`. `listContentMobile`: `paddingBottom: spacing.xxl` (48px) para que ninguna card quede tapada por la bottom navigation. Desktop mantiene `header` spacing original y grilla consistente de 2 columnas con `flex:1` + `minWidth:0` (última card alineada izquierda, slot derecho vacío). `maxWidth: contentWidths.wide` (1240px) conservado. |

### Lo que NO se tocó

- `"Mis casos"` + descripción neutral
- Filtros reales (`Todos` / Negociación / Conciliación / Mediación)
- Próxima acción + CTAs contextuales
- Estados actuales + colores semánticos
- Privacidad + accesibilidad (`con_aviso` autoritativo)
- Cards no interactivas con botón explícito
- Design-system (tokens, `Card`, `Button`, `StatusPill`, `EntityTypeIndicator`)
- Hooks (`useCases`, `useResponsiveLayout`)
- Traducciones (`i18n/locales`)

### Veredicto visual

| Requisito | Estado |
|---|---|
| Desktop: grilla de 2 columnas consistente | MATCH |
| Desktop: card solitaria no estirada a ancho completo | MATCH |
| Desktop: CaseCards con ancho equivalente | MATCH |
| Desktop: última card alineada izquierda, slot derecho vacío | MATCH |
| Desktop: cards más compactas, próxima acción altura moderada | MATCH |
| Desktop: CTA alineado al pie | MATCH |
| Desktop: max-width razonable (1240px) | MATCH |
| Desktop: resumen en superficies compactas con datos reales | MATCH |
| Mobile: filtros scroll horizontal con padding derecho anti-corte | MATCH |
| Mobile: touch targets 44px en filtros | MATCH |
| Mobile: padding inferior suficiente (48px) | MATCH |
| Mobile: header compactado, primer caso visible antes | MATCH |
| Mobile: CTA "Crear un caso" conservado sin dominar | MATCH |

**Resultado global: MATCH**

> Nota: las capturas de referencia (`new-desktop.png`, `new-mobile.png`) deben regenerarse en el viewport correcto (1440×1000 desktop, 390×844 mobile) con `scripts/frontend-audit/capture-cases-list.mjs new` para la validación visual definitiva. Los cambios de código están completos y los tests pasan (52/52).

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
