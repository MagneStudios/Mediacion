# Proyecto Mediación — App de Mediación Familiar con IA

Aplicación **móvil (Android e iOS)** de resolución de conflictos familiares mediante métodos
autocompositivos (negociación, conciliación y mediación) asistidos por **IA**. Cada parte carga
sus posiciones de forma **privada**, con un rango de acuerdo (máximo y mínimo), y la IA une esas
posiciones para proponer puntos de encuentro. Si la propuesta no prospera, la negociación **itera
por rondas** y, desde la tercera, puede sumarse un **mediador humano**. Los acuerdos se **firman
digitalmente** con validez legal (Ley 25.506).

> **Confidencial.** Documentación técnica interna de **Magne Studios** (equipo de desarrollo).
> Repositorio privado. No incluye la información comercial del cliente (cuotas, inversores).

---

## 📌 Estado

- **Documento técnico:** v1.0 (20/07/2026) — ver [`docs/Mediacion_Documentacion_Tecnica_v1.0.pdf`](docs/Mediacion_Documentacion_Tecnica_v1.0.pdf)
- **Núcleo a resolver primero:** el **aislamiento de posiciones** entre partes y el **motor de IA** que une posiciones y propone acuerdos por rondas.

## 🧩 Alcance de la v1 (módulos)

| Módulo | Contenido |
|--------|-----------|
| **1 · Identidad y onboarding** | Registro con documento (DNI), verificación biométrica, firma de identidad y consentimiento (DocuSign), T&C. |
| **2 · Casos y vinculación** | Creación de caso/sala, selección de método, invitación de la contraparte (link/código/correo). |
| **3 · Negociación e IA** | Carga privada de posiciones con rango, motor de IA, iteración por rondas, mediador humano desde ronda 3. |
| **4 · Acuerdos y post-acuerdo** | Trazabilidad, firma digital, exportación, avisos de incumplimiento, tareas y eventos de calendario. |
| **5 · Estudios jurídicos** | Panel web de gestión, organización por carpetas, marca permanente. |
| **6 · Monetización, plazos e inversores** | Planes con límites (Mercado Pago), SLA con semáforo, landing de inversores. |

## 👥 Roles

**Admin** (super-usuario, Magne Studios) · **Parte** (usuario final; solo ve sus propios casos y posiciones) ·
**Mediador** (se habilita desde la ronda 3) · **Estudio** (opera sus casos desde el panel web).

## 🏗️ Stack de referencia (a confirmar por el equipo)

- **App móvil:** React Native (Android + iOS), con i18n (es/en).
- **Panel web estudios:** SPA privada con autenticación por rol.
- **Backend / API REST** (ej. Node.js) con JWT, control de acceso por rol y **aislamiento de posiciones** — contrato único.
- **Base de datos:** relacional en la nube (ej. PostgreSQL / Supabase).
- **Integraciones:** OpenRouter (motor de IA conmutable), DocuSign (firma, Ley 25.506), Mercado Pago (cobros + webhook), SMTP + push (FCM/APNs).

## 🔐 Reglas críticas (ver documento)

- **RN-01 · Aislamiento de posiciones:** una parte **nunca** ve los ítems ni rangos de la otra; la API filtra por caso y por parte en cada consulta.
- **IA conmutable** vía OpenRouter: la lógica de unión de posiciones vive en el backend; el modelo se cambia por configuración.
- **Webhook de pago** confirma el estado real; el frontend nunca marca una suscripción como pagada.

## 📂 Estructura del repo

```
Mediacion/
├─ docs/                 # Documentación técnica (PDF del equipo)
├─ .github/              # Plantillas de PR e issues, CODEOWNERS
├─ CONTRIBUTING.md       # Flujo de trabajo, ramas y convenciones
└─ README.md
```

> Repos sugeridos por el documento: `app-movil`, `panel-estudios`, `backend` (o monorepo, a criterio del equipo).

## 🎯 Prioridad semana 1

Modelo de datos (§5), contrato de API (§6), matriz de roles (§3) y reglas de negocio (§4), con
foco en el aislamiento de posiciones (RN-01) y el motor de IA por rondas (RN-03/04).

## 🤝 Equipo

**Desarrolla:** Magne Studios. Objetivo de publicación en tiendas: septiembre 2026.
