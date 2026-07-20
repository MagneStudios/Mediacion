# Guía de contribución

Cómo trabajamos en equipo sobre este repositorio. El objetivo es que los avances sean
ordenados, revisables y fáciles de probar por el cliente.

## 🌿 Estrategia de ramas

- **`main`** — rama estable y desplegable (producción). **Protegida**: nadie hace push directo.
- **`develop`** — integración de trabajo en curso.
- **`feature/…`**, **`fix/…`**, **`chore/…`** — una rama por tarea, corta y enfocada.

```
feature/catalogo-buscador
fix/checkout-webhook
chore/setup-eslint
```

## 🔁 Flujo de trabajo

1. Actualizá tu base: `git checkout develop && git pull`.
2. Creá tu rama: `git checkout -b feature/mi-tarea`.
3. Trabajá y commiteá con mensajes claros (ver convención abajo).
4. Subí la rama: `git push -u origin feature/mi-tarea`.
5. Abrí un **Pull Request** usando la plantilla.
6. Pedí al menos **1 revisión** antes de mergear. Resolvé los comentarios.
7. Mergeá con *squash* una vez aprobado y con los checks en verde.

## ✍️ Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(catalogo): agrega filtro por categoría
fix(pagos): maneja webhook duplicado de forma idempotente
docs: actualiza la documentación técnica
chore: configura prettier
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## ✅ Pull Requests

- Un PR = una tarea o feature acotada. PRs chicos se revisan mejor.
- Completá la plantilla (qué cambia, cómo probarlo, screenshots si es UI).
- Referenciá el requerimiento de la documentación técnica cuando aplique (ej.: `RF-…`, `RN-…`, `HU-…`) y el issue (`Closes #12`).
- No mergees con checks en rojo ni con conversaciones sin resolver.

## 🔒 Reglas del proyecto

- **Nunca** exponer al frontend datos internos ni sensibles (costos/márgenes, identidad de
  proveedores/socios, datos privados de una parte, precios internos, etc. — según el proyecto).
- Las reglas de negocio y el control de acceso viven en el **backend/API**, no en el cliente.
- El estado real de un pago lo confirma el **webhook** de la pasarela; el frontend nunca marca una orden como pagada.
- **No commitear secretos** ni claves de API. Usá variables de entorno por ambiente (`.env`, ignorado por git).
- La documentación técnica (`docs/`) es la fuente de verdad del alcance; los cambios estructurales se discuten antes de implementarlos.

## 💬 Comunicación

Según la metodología acordada: reportes de avance al cliente (típicamente lunes, miércoles y
viernes) y entregas por link accesible para que el cliente pruebe cada avance.
