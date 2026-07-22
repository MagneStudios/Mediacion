# agents/

Bitácoras de trabajo con agentes de IA, por rol. Cada dev registra aquí sesiones
de terminal, decisiones y contexto de su flujo, en archivos `.md`.

## Estructura

| Directorio | Rol | Alcance |
|------------|-----|---------|
| `db/` | Dev de base de datos | Supabase, roles, seguridad, RLS, migraciones |
| `back/` | Dev backend | NestJS, Edge Functions, SP (conciliados con db) |
| `front/` | Dev frontend | Next.js, panel web |

## Convención

- Un `.md` por sesión o por tema. Nombre sugerido: `YYYY-MM-DD-tema.md`.
- Incluir: qué se hizo, decisiones tomadas, pendientes y contexto útil para
  retomar el trabajo (propio o de otro dev).
- No commitear secretos ni claves en las bitácoras (misma regla que el resto
  del repo, ver `CONTRIBUTING.md`).
- Lo que afecte a más de un rol (ej. contrato de API, SP compartidos) se
  referencia cruzado entre directorios en lugar de duplicarse.
