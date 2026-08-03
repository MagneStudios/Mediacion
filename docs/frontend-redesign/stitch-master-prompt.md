# Stitch Master Prompt — Rediseño de Proyecto Mediación

> **Este documento es autocontenido.** Stitch no necesita leer el repositorio completo.
> Todos los archivos de referencia están en `docs/frontend-redesign/`.

---

## Tu misión

Proponer un rediseño profundo, moderno y visualmente superior para **Proyecto Mediación**, una aplicación de resolución de conflictos familiares mediante negociación asistida por IA.

**No repliques la estética actual.** Tenés libertad total para proponer un nuevo lenguaje visual, layout, navegación, paleta, tipografía y composición.

---

## Lo que hace el producto

Dos partes en conflicto familiar (custodia, alimentos, bienes) usan la app para:
1. Crear o unirse a un caso
2. Cargar posiciones de forma PRIVADA (cada una no ve las de la otra)
3. Recibir propuestas de acuerdo generadas por IA (sanitizadas, sin exponer datos privados)
4. Aceptar o rechazar propuestas en rondas de negociación
5. Solicitar un mediador humano desde la ronda 3
6. Firmar el acuerdo alcanzado
7. Gestionar incumplimientos y tareas post-acuerdo

---

## Audiencia y tono

- **Usuarios:** Personas en conflicto familiar. Posiblemente en situación emocional difícil.
- **Tono:** Calma, confianza, claridad, neutralidad.
- **Lo que NO debe transmitir:** Estética judicial agresiva, frialdad institucional, adversarialidad. Nada de martillos de juez, balanzas agresivas, ni rojos intensos hostiles.

---

## Principios de diseño

1. **Mobile-first.** La app funciona en Android, iOS y web. Diseñá para 375px de ancho como base.
2. **Tablet (768px) y desktop (1280px+)** con layouts responsive.
3. **Neutralidad visual entre las partes.** La interfaz no debe sugerir que una parte es "la buena" o "la mala".
4. **Calma y contención.** Transmite que el proceso es ordenado, predecible y seguro.
5. **Claridad funcional.** Cada pantalla debe comunicar inequívocamente qué puede hacer el usuario ahora.
6. **Accesibilidad.** Touch targets ≥ 44px. Sin dependencia exclusiva de color para estados. ARIA roles.
7. **Español e inglés.** La app soporta ambos idiomas. Diseñá con espacio para textos en ambos idiomas (el español argentino usa formas como "Generá", "Podés", "Elegí" con voseo).

---

## Lo que podés cambiar

- Layout completo de cada pantalla
- Sistema de navegación (tabs, sidebar, breadcrumbs, bottom nav)
- Jerarquía visual de información
- Paleta de colores completa
- Tipografía, iconografía
- Estilo de cards, formularios, botones
- Composición, densidad, espaciado
- Presentación de estados (loading, empty, error, success, transiciones)
- Animaciones, transiciones, micro-interacciones
- Agrupación y orden visual de información

---

## Lo que NO podés cambiar (reglas de negocio)

1. **Privacidad absoluta de posiciones:** Una parte NUNCA ve las posiciones de la otra. No puede existir ninguna pantalla de "comparación de posiciones".
2. **Propuestas sanitizadas:** La IA solo muestra puntos medios. No muestra "Parte A pidió X, Parte B ofreció Y".
3. **Mediador solo desde ronda 3:** El botón de solicitar mediador solo aparece cuando el proceso llegó a ronda ≥ 3.
4. **Acuerdo requiere ambas firmas:** El progreso de firmas debe mostrar claramente que ambas partes deben firmar.
5. **Estados autoritativos del backend:** No inventar estados. Usar los definidos en `state-machines.md`.
6. **Sin chat entre partes:** No existe mensajería. No diseñar chat.
7. **Sin exposición de datos personales:** Email, documento, teléfono, tokens nunca en la UI.
8. **Aviso de "entorno de prueba" en firma:** La firma es simulada. Debe quedar claro.
9. **Pertenencia al caso para toda acción:** El usuario solo ve sus propios casos.

---

## Lecturas obligatorias (en orden)

Lee estos archivos antes de empezar a diseñar:

1. **[stitch-product-context.md](./stitch-product-context.md)** — Arquitectura, stack, reglas, funcionalidades
2. **[route-map.md](./route-map.md)** — Todas las rutas con propósito, acciones y estados
3. **[user-flows.md](./user-flows.md)** — Flujos de usuario completos con diagramas Mermaid
4. **[roles-permissions.md](./roles-permissions.md)** — Quién puede hacer qué
5. **[domain-model.md](./domain-model.md)** — Entidades del producto y sus relaciones
6. **[state-machines.md](./state-machines.md)** — Estados y transiciones de cada entidad
7. **[privacy-rules.md](./privacy-rules.md)** — Reglas de privacidad NO NEGOCIABLES
8. **[screen-content-model.md](./screen-content-model.md)** — Jerarquía de contenido por pantalla
9. **[component-requirements.md](./component-requirements.md)** — Componentes funcionales necesarios

---

## Entregables esperados

1. **3 direcciones de diseño distintas** (mood boards o conceptos visuales) antes de elegir una
2. **Sistema de diseño completo:**
   - Paleta de colores (con roles semánticos: primary, neutral, success, warning, AI)
   - Tipografía (headings, body, mono para códigos)
   - Escala de espaciado
   - Radios de borde
   - Sistema de iconografía
   - Sombras y elevaciones
3. **Pantallas clave** (mobile-first, 375px):
   - Login / SignUp
   - Dashboard de casos (lista vacía, con casos)
   - Detalle de caso (pendiente de contraparte, activo, con acuerdo)
   - Carga de posición (formulario)
   - Negociación (ronda activa, propuesta pendiente, propuesta aceptada, propuesta rechazada)
   - Acuerdo (borrador, listo para firmar, firmado, con aviso de incumplimiento)
   - Firma (pendiente, firmado)
   - Mediador (no disponible, disponible, solicitado, asignado)
   - Avisos (lista, filtrado, vacío)
   - Perfil y configuración
4. **Componentes del design system** (botones, inputs, cards, badges, diálogos, empty states, loading states, error states)
5. **Navegación responsive** (mobile bottom tabs → tablet/desktop sidebar)
6. **Estados funcionales completos:** loading, empty, error, success, y TODOS los estados intermedios documentados en `state-machines.md`
7. **Layouts responsive** (mobile 375px, tablet 768px, desktop 1280px+)

---

## Capturas de contexto

Las capturas en `screenshots/` son material de REFERENCIA FUNCIONAL, no una obligación visual. Te muestran QUÉ información va en cada pantalla, no CÓMO debe verse.

No estás obligado a preservar ningún aspecto visual de las capturas.

---

## Checklist de verificación para tu entrega

Antes de entregar, confirmá que tu diseño:

- [ ] Cumple RN-01: sin exposición de posiciones de contraparte
- [ ] Muestra el mediador solo desde ronda 3
- [ ] Requiere confirmación explícita para acciones destructivas (eliminar posición, rechazar propuesta, desactivar cuenta)
- [ ] Incluye avisos de privacidad donde corresponda
- [ ] Diferencia claramente acciones propias de acciones de contraparte
- [ ] Muestra estados de espera (waiting for other party) de forma clara pero no ansiosa
- [ ] La firma tiene aviso de "entorno de prueba"
- [ ] Funciona en 375px sin scroll horizontal
- [ ] Touch targets ≥ 44px
- [ ] Sin dependencia exclusiva de color para estados
- [ ] Soporta textos en español e inglés sin desbordes
- [ ] Los códigos de caso y tokens usan tipografía monoespaciada
- [ ] No hay chat ni composición de mensajes (no existe en el producto)
- [ ] La estética transmite calma, no adversarialidad
- [ ] El diseño es neutral entre las partes

---

## Notas adicionales

- La app actual usa Expo (React Native) + Expo Router. El rediseño debe ser implementable en React Native (componentes nativos, no HTML/CSS puro), pero para esta fase de diseño conceptual podés trabajar en Figma sin preocuparte por limitaciones técnicas de RN.
- No hay modo oscuro en la versión actual. Si lo proponés, debe ser opcional y coherente con el tono de calma.
- Los datos en las capturas son ficticios. Usá los mismos datos mock para consistencia: "Custodia compartida", "Marco D.", "Lucía Fernández", "CASO-2026-0431".
