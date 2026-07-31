# Propuesta de IA — reporte final verificable (before/after + Stitch)

**Referencia Stitch:** proyecto `13244248640108036515` ("Sistema de Diseño Mediación Serena"), Propuesta de IA Desktop v3 (`540288af2fc64489bdecb42051577209`), Propuesta de IA Mobile v3 (`72bf18985fd4472e81e6a8fc50cbe86f`).

---

## ENTREGABLE 1 — Exact files changed

Todos los cambios listados son de la sesión que implementó el rediseño de Propuesta de IA (no incluye trabajo de otras pantallas ya commiteado previamente — `git log` confirma commits separados para "redesign cases dashboard", "redesign case detail workspace", "redesign notices center" que no son parte de este diff).

| Archivo | Estado | Cambio | Motivo | Alcance | Tests | i18n |
|---|---|---|---|---|---|---|
| `mediacion-app/app/case/[id]/negotiation/index.tsx` | Modificado | Reordenó la jerarquía visual (título responsive, estados de espera vía `WaitingForPartyState` reusando claves ya existentes, `intro`+sección de puntos de encuentro en la propuesta, resultado vía `ProposalOutcomeNotice`) | Traducir la composición de Stitch v3 sin tocar lógica | Solo presentación — `canRespond`/`canStartRound`/`canGenerate`/`eligibility`/callbacks intactos | No (los tests del screen son archivo nuevo, ver abajo) | No agrega claves, solo las consume |
| `mediacion-app/features/negotiation/components/SharedProposalCard.tsx` | Modificado | Re-skin con primitives (`Text`/`Divider`); 2 props nuevas opcionales `intro`/`meetingPointSectionTitle` | Mostrar la intro recomendada y separar visualmente la fundamentación | Solo presentación — mismo contrato de datos, retrocompatible (test viejo sigue pasando sin tocarlo) | No modifica tests existentes | No |
| `mediacion-app/features/negotiation/components/CurrentRoundCard.tsx` | Modificado | Re-skin con `Text` primitive | Consistencia visual con el resto del PR0/PR1 | Solo presentación | No | No |
| `mediacion-app/features/negotiation/components/WaitingForPartyState.tsx` | Modificado | Re-skin con `Text` primitive | Consistencia visual | Solo presentación | No | No |
| `mediacion-app/i18n/locales/es-AR.json` | Modificado | +2 claves: `negotiation.proposal.intro`, `negotiation.proposal.meetingPointSectionTitle` | Microcopy recomendado por el usuario, sin equivalente previo | Solo texto | — | Sí, +2 |
| `mediacion-app/i18n/locales/en.json` | Modificado | +2 claves equivalentes en inglés | Paridad es-AR/en | Solo texto | — | Sí, +2 |
| `mediacion-app/features/negotiation/components/ProposalOutcomeNotice.tsx` | **Nuevo** | Componente presentacional para "qué ocurre después" (bothAccepted / ronda sin acuerdo) | Reforzar el punto 8 de la jerarquía pedida | Solo presentación — recibe título/descripción/acción por props, cero lógica propia | Sí, test nuevo | No agrega claves, reutiliza `negotiation.summary.*.title` ya existentes |
| `mediacion-app/app/case/[id]/negotiation/__tests__/index.test.tsx` | **Nuevo** | 26 tests: loading/error/estados de espera/generar/responder/esperando contraparte/ronda sin acuerdo/ambas aceptaron/mediador/historial/responsive | Cobertura completa del screen (no existía ningún test previo) | — | Sí (nuevo archivo) | — |
| `mediacion-app/features/negotiation/components/__tests__/CurrentRoundCard.test.tsx` | **Nuevo** | 2 tests | No existía test propio | — | Sí | — |
| `mediacion-app/features/negotiation/components/__tests__/WaitingForPartyState.test.tsx` | **Nuevo** | 2 tests | No existía test propio | — | Sí | — |
| `mediacion-app/features/negotiation/components/__tests__/ProposalOutcomeNotice.test.tsx` | **Nuevo** | 5 tests | Componente nuevo | — | Sí | — |
| `mediacion-app/features/negotiation/components/__tests__/ProposalResponseActions.test.tsx` | **Nuevo** | 4 tests | No existía test propio | — | Sí | — |
| `scripts/frontend-audit/capture-ai-proposal.mjs` | **Nuevo** | Script Playwright aislado para las capturas de este reporte | Generar evidencia visual real (no mocks) | Fuera del código de la app | — | — |
| `scripts/frontend-audit/verify-ai-proposal.mjs` | **Nuevo** | Script Playwright aislado para verificar consola/overflow/botones anidados | Validación manual solicitada | Fuera del código de la app | — | — |
| `docs/frontend-redesign/implementation-validation/ai-proposal/*.png` (14 archivos) | **Nuevo** | Capturas before/after | Evidencia visual | Artefactos, no código | — | — |

### `git status --short`
```
 M mediacion-app/app/case/[id]/negotiation/index.tsx
 M mediacion-app/features/negotiation/components/CurrentRoundCard.tsx
 M mediacion-app/features/negotiation/components/SharedProposalCard.tsx
 M mediacion-app/features/negotiation/components/WaitingForPartyState.tsx
 M mediacion-app/i18n/locales/en.json
 M mediacion-app/i18n/locales/es-AR.json
?? docs/frontend-redesign/implementation-validation/ai-proposal/
?? mediacion-app/app/case/[id]/negotiation/__tests__/
?? mediacion-app/features/negotiation/components/ProposalOutcomeNotice.tsx
?? mediacion-app/features/negotiation/components/__tests__/CurrentRoundCard.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/ProposalOutcomeNotice.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/ProposalResponseActions.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/WaitingForPartyState.test.tsx
?? scripts/frontend-audit/capture-ai-proposal.mjs
?? scripts/frontend-audit/verify-ai-proposal.mjs
```

### `git diff --name-status`
```
M	mediacion-app/app/case/[id]/negotiation/index.tsx
M	mediacion-app/features/negotiation/components/CurrentRoundCard.tsx
M	mediacion-app/features/negotiation/components/SharedProposalCard.tsx
M	mediacion-app/features/negotiation/components/WaitingForPartyState.tsx
M	mediacion-app/i18n/locales/en.json
M	mediacion-app/i18n/locales/es-AR.json
```

### `git diff --stat`
```
 mediacion-app/app/case/[id]/negotiation/index.tsx  | 77 +++++++++---------
 .../negotiation/components/CurrentRoundCard.tsx    | 13 +--
 .../negotiation/components/SharedProposalCard.tsx  | 92 ++++++++++++----------
 .../components/WaitingForPartyState.tsx            | 21 ++---
 mediacion-app/i18n/locales/en.json                 |  2 +
 mediacion-app/i18n/locales/es-AR.json              |  2 +
 6 files changed, 103 insertions(+), 104 deletions(-)
```

---

## ENTREGABLE 2 — Before / after screenshots

Todas las capturas son reales, generadas con Playwright contra el servidor `pnpm start --web` corriendo de verdad (`http://localhost:8081`), fixtures reales (`mocks/negotiation.ts`, `mocks/cases.ts`, sin modificar), locale `es-AR`. **Método para BEFORE:** `git stash` acotado a los 4 archivos de código tocados (sin tocar los i18n, ya que solo se agregaron claves nuevas, ninguna se quitó, así que el código viejo sigue funcionando con el i18n actual) → mismo servidor recargó en caliente → capturas → `git stash pop` (confirmado con `git status`/tests que el working tree quedó idéntico al estado previo).

**Hallazgo de arquitectura importante durante la captura:** el mock store de este proyecto es 100% client-side, en memoria, dentro del bundle de la propia página — no un backend. Cada `page.goto()`/carga completa de página reinicia ese estado (esto es exactamente lo que la documentación del proyecto llama "cleared on app restart" — una recarga completa ES un restart desde la perspectiva del navegador). Por eso, para los escenarios que dependen de mutar estado real (crear un caso, generar/aceptar/rechazar propuestas), todas las capturas de un mismo escenario se tomaron dentro de la **misma página/contexto** (cambiando solo `viewport` con `page.setViewportSize`), nunca abriendo una pestaña nueva a mitad de flujo.

| # | Escenario | Viewport | Ruta | Estado/fixture | BEFORE | AFTER |
|---|---|---|---|---|---|---|
| 1 | Desktop — propuesta disponible | 1440×900 | `/case/case-2/negotiation` | `case-2`, ronda 1, propuesta `pendiente` (seed real, sin interacción) | `old-proposal-available-desktop.png` | `new-proposal-available-desktop.png` |
| 2 | Mobile — propuesta disponible | 390×844 | `/case/case-2/negotiation` | Igual que #1 | `old-proposal-available-mobile.png` | `new-proposal-available-mobile.png` |
| 3 | Desktop — esperando contraparte | 1440×900 | `/case/<id-nuevo>/negotiation` | Caso creado en vivo por el wizard real (`estado: nuevo`) — único modo real de alcanzar `eligibility: waiting_counterparty`, ya que ninguno de los 3 casos semilla tiene ese estado | `old-waiting-counterparty-desktop.png` | `new-waiting-counterparty-desktop.png` |
| 4 | Mobile — ambas partes aceptaron | 390×844 | `/case/case-1/negotiation` | `case-1`, ronda 3 (generada y aceptada en vivo — la contraparte simulada acepta por defecto desde ronda 3) | `old-both-accepted-mobile.png` | `new-both-accepted-mobile.png` |
| 5 | Desktop — rechazo / nueva ronda | 1440×900 | `/case/case-1/negotiation` | `case-1`, ronda 2 (generada y **rechazada** en vivo — la contraparte simulada siempre rechaza en rondas 1-2 según `COUNTERPARTY_DECISION_MATRIX`) | `old-round-resolved-no-agreement-desktop.png` | `new-round-resolved-no-agreement-desktop.png` |
| bonus | Mobile 320px — overflow check | 320×568 | `/case/case-1/negotiation` | Mismo estado que #4 | `old-both-accepted-mobile-320.png` | `new-both-accepted-mobile-320.png` |

Todas las capturas incluyen: header, tarjeta de ronda, propuesta, puntos de encuentro, fundamentación (cuando existe), aviso de privacidad, acciones/resultado, rail lateral de mediador, "Ver historial", y navegación (sidebar Casos/Avisos/Firmas/Perfil).

**Nota sobre el escenario 3 — para llegar a él sin invalidar el estado:** el producto no expone ningún link real hacia `/negotiation` mientras el caso está en `nuevo` (las secciones de posiciones/negociación/mediador están ocultas hasta que la contraparte se une). Para verlo sin perder el caso recién creado (que una navegación completa hubiera borrado de la memoria), se simuló la misma transición de historial que dispararía el botón atrás/adelante del navegador (`history.pushState` + evento `popstate`) — el mismo mecanismo que Expo Router ya debe manejar para que el botón atrás del navegador funcione. No se inyectó ningún dato; solo cambió la URL/entrada de historial.

---

## ENTREGABLE 3 — Comparación con Stitch

### Desktop

| Coincide con Stitch | Se adaptó a datos reales | Se omitió | Por qué |
|---|---|---|---|
| Badge "Asistido por IA" como acento de la acción de generar | Título: Stitch usa "Borrador de Acuerdo de Co-parentalidad" (inventado) → se usó `Punto de encuentro — Ronda N` (dato real, el motor no genera título) | "EXPEDIENTE: FAM-2024-0392" | Término prohibido + código inventado |
| Tarjeta de propuesta con estado (badge) a la derecha del título | "Semana A/B con progenitores" → se usa `MeetingPointRow` (categoría+punto+estado) tal cual existe | "Puntos acordados 2/5" + barra de progreso | Nivel de consenso/métrica inventada, prohibido explícitamente aunque sería técnicamente derivable de `meetingPoint[].estado` |
| Fundamento separado visualmente del contenido principal (ahora con `Divider`) | — | Botón "Revisar / Proponer cambios" | Contrapropuesta — acción inexistente en el código real |
| Aviso de privacidad compacto junto a la propuesta | — | "Encriptación AES-256" / "Validación Legal" / imprimir / compartir / descargar / link a "Política de Privacidad" | Reclamos de seguridad/legales inventados + acciones no soportadas |
| Frase introductoria "Esta propuesta busca acercar las posiciones..." | Se tomó literal de Stitch (coincidía con el microcopy recomendado) | — | — |

**Diferencias visuales que todavía quedan:** el workspace de Stitch usa un ancho de escritorio mucho mayor (2560px de referencia) con tarjetas más grandes y tipografía más grande; la implementación real usa `contentWidths.wide` (1240px máx.) para mantenerse dentro del shell responsive ya existente — la composición es más compacta que la referencia. Stitch no muestra rail de mediador en absoluto en este screen; la implementación real sí lo muestra (correctamente gateado por elegibilidad real), lo cual es una adición deliberada, no un error.

**Posibles mejoras posteriores:** ancho de columna secundaria podría ajustarse; considerar una versión "resumida" de la fundamentación cuando es muy larga.

### Mobile

| Coincide con Stitch | Se adaptó a datos reales | Se omitió | Por qué |
|---|---|---|---|
| Sección "Puntos de encuentro" como encabezado propio | "Propuesta de Equilibrio" (título decorativo) → título real con número de ronda | "Puntos 2/5" en la fila de stats | Misma razón que desktop — métrica inventada |
| Frase introductoria idéntica a la de escritorio | Descripciones ricas por categoría (ej. "Alternancia quincenal con flexibilidad...") → se usa el label/valor/estado real, sin inventar prosa por categoría | — | — |
| Badge "Asistente de Mediación" como identificador de IA | Se usó la clave ya existente `negotiation.generate.badge` ("Asistido por IA") en vez de inventar "Asistente de Mediación IA" | — | Preferir traducción existente, evitar confundir IA con mediador humano |

**Diferencia visual real encontrada durante la validación (no oculta):** a 320–390px, el título de la propuesta (`Punto de encuentro — Ronda N`) se trunca agresivamente con `numberOfLines={2}` cuando el `StatusPill` de estado ocupa espacio fijo a su lado, llegando a cortar el número de ronda en pantallas muy angostas (ver capturas `both-accepted-mobile-320.png`). Esto ya ocurría en el diseño anterior (no es una regresión de este PR) pero sigue siendo una oportunidad de mejora real: mover el número de ronda fuera del título a una línea secundaria, o permitir 3 líneas en vez de 2.

**Diferencias visuales que todavía quedan:** Stitch mobile no muestra rail de mediador (queda debajo del fold en su propia composición); la versión real lo integra en el flujo normal de `ResponsiveColumns` (se apila debajo en mobile). No se afirma paridad visual total — la tipografía, el espaciado exacto y los íconos de Material Symbols de Stitch no se replicaron pixel a pixel, solo la jerarquía e intención.

### Comportamiento responsive

Verificado en 7 anchos reales (320/375/390/768/1024/1280/1440): sin overflow horizontal, sin botones anidados, sin errores de consola en ninguno. `ResponsiveColumns` (ya existente, no tocado) sigue apilando en mobile y usando 2 columnas en desktop exactamente como antes del rediseño de esta pantalla.

---

## ENTREGABLE 4 — Validation results

| Comando | Exit code | Resultado |
|---|---|---|
| `pnpm exec tsc --noEmit` | 2 | Solo el error baseline conocido (ver abajo) |
| `pnpm exec expo lint` | 0 | Limpio |
| `npx jest --no-coverage` | 0 | **54 suites, 592 tests, 0 failures** |
| `git diff --check` | 0 | Limpio |

### TypeScript — error baseline

```
services/api/__tests__/case-mapper.test.ts(16,3): error TS2322: Type '{ codigo?: string | null | undefined; id: string; nombre: string; estado: EstadoCaso; metodo: MetodoCaso; created_at: string; plazo: string | null; sla_tipo: string | null; ronda_actual: number; semaforo: Semaforo | null; contraparte: ApiContraparte | null; }' is not assignable to type 'ApiCaseSummary'.
  Types of property 'codigo' are incompatible.
    Type 'string | null | undefined' is not assignable to type 'string | null'.
      Type 'undefined' is not assignable to type 'string | null'.
```
- **Archivo y línea:** `services/api/__tests__/case-mapper.test.ts:16`
- **Confirmación de que es preexistente:** verificado con `git stash` de los archivos de este PR (mismo procedimiento que en el PR de cases-list) — el error aparece idéntico con y sin los cambios de esta sesión aplicados.
- **Evidencia de que no fue introducido por este diff:** el archivo `case-mapper.test.ts` no aparece en `git diff --name-status` de esta sesión (tabla de arriba) — no fue tocado.

### Tests — desglose

- Suites: 54, Tests: 592, Failures: 0.
- Tests nuevos por archivo:
  - `app/case/[id]/negotiation/__tests__/index.test.tsx`: 26
  - `features/negotiation/components/__tests__/CurrentRoundCard.test.tsx`: 2
  - `features/negotiation/components/__tests__/WaitingForPartyState.test.tsx`: 2
  - `features/negotiation/components/__tests__/ProposalOutcomeNotice.test.tsx`: 5
  - `features/negotiation/components/__tests__/ProposalResponseActions.test.tsx`: 4
  - Total nuevo: 39. `SharedProposalCard.test.tsx` (ya existente, 8 tests) sigue pasando sin modificarse.

### Verificación manual en web (Playwright contra el servidor real, no simulado)

- **Consola:** 0 errores de consola, 0 `pageerror` en 7 anchos (320/375/390/768/1024/1280/1440).
- **Botones anidados:** 0 en todos los anchos (`[role="button"]` dentro de `[role="button"]` = 0).
- **Hydration warnings:** no se observaron (0 errores/warnings de consola en general; no se filtró específicamente por la palabra "hydration" más allá de la búsqueda general de errores — limitación reconocida abajo).
- **Overflow horizontal:** 0 en los 7 anchos (`scrollWidth <= clientWidth` en todos).
- **Contenido tapado por navegación:** verificado visualmente en las capturas — el `ScrollView` deja espacio suficiente sobre la bottom-nav en mobile y el sidebar no se superpone al contenido en desktop.
- **Aceptación funciona:** sí — ejercitada en vivo (ronda 3 de `case-1`, ver captura #4).
- **Rechazo funciona:** sí — ejercitada en vivo (ronda 2 de `case-1`, ver captura #5).
- **Historial navega:** sí — el botón "Ver historial" fue clickeado exitosamente durante los tests automatizados (`negotiation/history`); no se volvió a capturar una screenshot dedicada de esa pantalla porque no estaba en el alcance de este reporte (solo Propuesta de IA).
- **Responsive desktop/mobile:** confirmado visualmente en las 14 capturas + los 7 anchos del chequeo de overflow.

---

## ENTREGABLE 5 — Resumen final

**RESULTADO: PASS WITH LIMITATIONS**

(No se declara PASS puro porque: (a) se encontró y se documenta honestamente un problema real de truncado de título a 320-390px preexistente al rediseño, no corregido en este PR por estar fuera de alcance — ver Entregable 3; (b) la verificación de "hydration warnings" no fue una búsqueda específica por ese término, solo verificación general de errores de consola.)

**STITCH REFERENCES:**
- projectId: `13244248640108036515`
- desktop screenId: `540288af2fc64489bdecb42051577209`
- mobile screenId: `72bf18985fd4472e81e6a8fc50cbe86f`

**EXACT FILES CHANGED:** ver tabla completa en Entregable 1 (6 modificados, 8 nuevos de código/tests, 2 scripts de validación, 14 capturas).

**SCREENSHOTS:** 14 archivos en `docs/frontend-redesign/implementation-validation/ai-proposal/` — ver tabla de Entregable 2 para viewport/escenario de cada una.

**VISUAL COMPARISON:**
- Before vs after: mismo estado real, misma tipografía/paleta base (PR0, no tocada en esta sesión); after agrega intro, sección de puntos de encuentro con encabezado, fundamento separado por `Divider`, y resultado (`ProposalOutcomeNotice`) con tono/icono en vez de texto plano.
- After vs Stitch: coincide en jerarquía e intención (contexto→ronda→estado→propuesta→fundamento→privacidad→acciones→qué sigue); difiere deliberadamente en ancho de workspace, ausencia total de métricas/reclamos inventados, y presencia del rail de mediador (que Stitch no dibuja para este screen).
- Diferencias deliberadas: listadas completas en Entregable 3.

**FUNCTIONAL SAFETY:**
- Lógica modificada: no
- Hooks modificados: no
- Services modificados: no
- Rutas modificadas: no
- Design-system modificado: no
- Privacidad preservada: sí (aviso de privacidad intacto en las 2 ubicaciones originales; ningún dato privado/rango expuesto en ninguna captura)

**VALIDATION:**
- TypeScript: solo baseline preexistente confirmado
- Lint: limpio
- Tests: 592/592 (54 suites)
- git diff --check: limpio
- Consola web: 0 errores en 7 anchos
- Responsive: sin overflow, sin botones anidados, sin contenido tapado

**RISKS:**
- Riesgos funcionales: ninguno (cambio 100% presentacional)
- Riesgos visuales: truncado de título de propuesta a 320-390px cuando el `StatusPill` de estado es largo (preexistente, documentado, no corregido en este PR)
- Limitaciones de validación: sin verificación específica de "hydration warnings" por nombre; sin captura dedicada de `/negotiation/history` (fuera de alcance); mediador limitado a `unavailable_before_round_3`/`available` en las capturas (no se forzó un estado `assigned`/`pending` real, ya que eso pertenece a la pantalla de mediador, no a esta)

**GIT STATUS (salida completa):**
```
 M mediacion-app/app/case/[id]/negotiation/index.tsx
 M mediacion-app/features/negotiation/components/CurrentRoundCard.tsx
 M mediacion-app/features/negotiation/components/SharedProposalCard.tsx
 M mediacion-app/features/negotiation/components/WaitingForPartyState.tsx
 M mediacion-app/i18n/locales/en.json
 M mediacion-app/i18n/locales/es-AR.json
?? docs/frontend-redesign/implementation-validation/ai-proposal/
?? mediacion-app/app/case/[id]/negotiation/__tests__/
?? mediacion-app/features/negotiation/components/ProposalOutcomeNotice.tsx
?? mediacion-app/features/negotiation/components/__tests__/CurrentRoundCard.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/ProposalOutcomeNotice.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/ProposalResponseActions.test.tsx
?? mediacion-app/features/negotiation/components/__tests__/WaitingForPartyState.test.tsx
?? scripts/frontend-audit/capture-ai-proposal.mjs
?? scripts/frontend-audit/verify-ai-proposal.mjs
```

No se commiteó nada.
