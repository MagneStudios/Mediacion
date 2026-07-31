# Stitch export — Listado de casos / Detalle del caso / Propuesta de IA

## Cómo se obtuvo esto

El MCP nativo de Stitch (`stitch.googleapis.com/mcp` registrado en Claude Code) no completa `tools/list`:

```
can't resolve reference #/$defs/ScreenInstance from id #
```

Es un bug del lado del servidor en el manifest de herramientas (un `$ref` roto), no un problema de credenciales — la conexión HTTP y la API key se aceptan, pero el parser de JSON Schema del cliente MCP nativo no puede resolver esa referencia. Como alternativa se usó el **SDK oficial `@google/stitch-sdk`** (paquete real, publicado por Google Labs, incluye su propio parser interno que evita ese bug), instalado de forma aislada en `mediacion-app/scripts/frontend-audit/` — **no** es una dependencia de producción, no está en `mediacion-app/package.json` ni en el `pnpm-workspace.yaml` raíz.

## Proyecto consultado

**Sistema de Diseño Mediación Serena** (`stitchProjectId: 13244248640108036515`), 21 pantallas, actualizado por última vez 2026-07-31.

Había un segundo proyecto candidato, **Mediación Familiar Digital** (`8751375766593622714`, 18 pantallas, actualizado 2026-07-23) — un prototipo de flujo completo más antiguo, con terminología distinta ("Mis Casos" en vez de "Listado de Casos", sin pantalla llamada "Propuesta de IA", sin versiones iteradas). Se descartó tras confirmación explícita del usuario, no silenciosamente.

## Pantallas encontradas y seleccionadas

Cada una de las tres pantallas objetivo tenía múltiples versiones en Stitch. Se descargaron **todas** las candidatas relevantes (desktop + mobile, todas las versiones numeradas) a `candidates/`, se compararon contra los criterios aprobados, y solo entonces se promovió la versión ganadora a `selected/`.

| Pantalla | Candidatas descargadas | Seleccionada | Por qué |
|---|---|---|---|
| **Listado de casos** | v3-desktop, v4-desktop, v4-mobile | **v4** (desktop + mobile) | v3-desktop todavía tenía el placeholder "Buscar casos, partes o **expedientes**..." (terminología pre-corrección) y ni siquiera tenía screenshot disponible en Stitch. v4 usa "Casos" de forma consistente, tiene un bloque explícito "Próxima acción", método y estado visualmente diferenciados, y CTAs contextuales ("Responder propuesta", "Continuar caso"). |
| **Detalle del caso** | v2-desktop, v3-desktop, v2-mobile, v3-mobile | **v3** (desktop + mobile) | v2-desktop mostraba literalmente "**65% de Consenso**" (una métrica inventada, prohibida por los criterios) y un mediador asignado de forma incondicional; v2-mobile llamaba a la sugerencia de la IA "**Sugerencia del Mediador IA**", confundiendo el motor de IA con el rol de mediador humano. v3 no tiene ninguno de los dos problemas: la sección de mediador se muestra condicionalmente ("La asignación de un mediador se confirmará en la siguiente fase de negociación"), y la posición propia dice explícitamente "La contraparte no puede verla." |
| **Propuesta de IA** | v1/v2/v3 × desktop/mobile (6 candidatas) | **v3** (desktop + mobile) | v1 y v2 (ambas plataformas, salvo v2-mobile) tienen **burbujas decorativas de fondo** (`rounded-full` + `blur-[80–100px]`, una incluso con `animate-pulse`) — exactamente lo que los criterios piden evitar. v3 no tiene ninguna burbuja decorativa (solo `backdrop-blur` funcional en headers/nav fijos), no tiene "nivel de consenso" ni porcentajes inventados en ningún lado, y usa los tokens de la paleta acuática aprobada (`bg-hielo`, `mediation-aqua`). |

Detalle completo de por qué se descartó cada candidata en `manifest.json` (`screens[].candidates[].reason`).

## Artefactos entregados por Stitch

Para las 3 pantallas seleccionadas (desktop + mobile = 6 exports):
- ✅ **Preview PNG** — las 6.
- ✅ **HTML fuente** (Tailwind, generado por Stitch) — las 6.
- ✅ **Metadata** (`screenId`, `projectId`, título, ancho, alto, deviceType) — las 6.

No entregados por el SDK / no aplican en esta pantalla del producto:
- ❌ **Design tokens exportados** como archivo separado (colores/tipografía/spacing) — el SDK solo expone `Project.createDesignSystem`/`listDesignSystems`, no se invocó (fuera de alcance de esta tarea de solo-lectura; se puede agregar en una vuelta futura si hace falta el token set formal).
- ❌ **Código de componentes** (React/RN) — Stitch genera HTML+Tailwind, no componentes de ningún framework de UI nativo.
- ❌ **Assets/iconos como archivos separados** — los iconos son `material-symbols-outlined` (Google Fonts icon font, referenciado por nombre en el HTML) y las imágenes de perfil/logo son URLs de `lh3.googleusercontent.com` ya incrustadas en el HTML — no se descargaron por separado.

## Cómo volver a sincronizar

```bash
cd mediacion-app/scripts/frontend-audit
npm install                              # una sola vez
node --env-file=.env.local fetch-stitch-designs.mjs list-projects
node --env-file=.env.local fetch-stitch-designs.mjs list-screens <projectId>
node --env-file=.env.local export-candidates.mjs   # baja todas las candidatas conocidas a candidates/
```

`STITCH_API_KEY` vive únicamente en `mediacion-app/scripts/frontend-audit/.env.local` (ignorado por git vía `mediacion-app/.gitignore`, patrón `.env*.local`). Nunca se imprimió ni se copió a ningún otro archivo del repo.

## Advertencia importante

**El HTML/CSS (Tailwind) que entrega Stitch es referencia visual únicamente.** No reemplaza ni debe copiarse tal cual sobre:
- la lógica de negocio existente (servicios, hooks, stores),
- el enrutamiento real (Expo Router),
- las validaciones de privacidad (RN-01, aislamiento de posiciones),
- ni el comportamiento mockeado ya construido (rondas, propuestas, firmas, mediador).

Es HTML/CSS **web**, generado sin conocimiento del árbol de componentes React Native de este repo — ver `implementation-mapping.md` para el detalle de qué se puede reutilizar visualmente y qué debe reinterpretarse para React Native.
