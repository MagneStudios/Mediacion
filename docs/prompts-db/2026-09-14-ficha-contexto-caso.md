# Prompt DB — Ficha de contexto del caso

Ejecutá esta migración en `X:\proyectos-uni\Mediacion\supabase\migrations\` y actualizá
los artefactos de tipos/docs. No edites nada fuera de lo pedido.

## Convenciones del repo (respetar)
- Migración aditiva, idempotente, con rollback documentado.
- RLS por `parte_id` estilo tabla `items` (CA-02): aislamiento por parte, nunca la contraparte.
- Trigger: `CREATE TRIGGER set_updated_at BEFORE UPDATE ON <tabla> FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();` (la función ya existe).
- Grants explícitos por objeto (ver `20260906110000_negociaciones.sql:73-76`):
  `GRANT SELECT, INSERT, UPDATE, DELETE ON <tabla> TO authenticated, anon, service_role, postgres;`
- Admin = `public.is_admin()`.

## 1) Crear `supabase/migrations/20260914120000_caso_contexto.sql`

```sql
-- ============================================================
-- Ficha de contexto del caso (privacidad por parte)
-- Rollback: DROP TABLE en orden inverso; DROP TRIGGER set_updated_at.
-- ============================================================

CREATE TABLE caso_contexto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_id UUID NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (caso_id)
);

CREATE TABLE contexto_integrantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  parentesco TEXT,
  fecha_nacimiento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contexto_actividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  integrante_id UUID REFERENCES contexto_integrantes(id) ON DELETE SET NULL,
  dia TEXT,
  hora_inicio TIME,
  hora_fin TIME,
  actividad TEXT,
  lugar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contexto_colegio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  nombre TEXT,
  direccion TEXT,
  curso TEXT,
  turno TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contexto_cronograma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  dia TEXT,
  franja_horaria TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contexto_domicilios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  tipo TEXT,
  calle TEXT,
  numero TEXT,
  localidad TEXT,
  provincia TEXT,
  cp TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contexto_restricciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caso_contexto_id UUID NOT NULL REFERENCES caso_contexto(id) ON DELETE CASCADE,
  parte_id UUID NOT NULL REFERENCES usuarios(id),
  tipo TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices FK
CREATE INDEX idx_caso_contexto_caso ON caso_contexto(caso_id);
CREATE INDEX idx_integrantes_cc ON contexto_integrantes(caso_contexto_id);
CREATE INDEX idx_integrantes_parte ON contexto_integrantes(parte_id);
CREATE INDEX idx_actividades_cc ON contexto_actividades(caso_contexto_id);
CREATE INDEX idx_actividades_parte ON contexto_actividades(parte_id);
CREATE INDEX idx_colegio_cc ON contexto_colegio(caso_contexto_id);
CREATE INDEX idx_colegio_parte ON contexto_colegio(parte_id);
CREATE INDEX idx_cronograma_cc ON contexto_cronograma(caso_contexto_id);
CREATE INDEX idx_cronograma_parte ON contexto_cronograma(parte_id);
CREATE INDEX idx_domicilios_cc ON contexto_domicilios(caso_contexto_id);
CREATE INDEX idx_domicilios_parte ON contexto_domicilios(parte_id);
CREATE INDEX idx_restricciones_cc ON contexto_restricciones(caso_contexto_id);
CREATE INDEX idx_restricciones_parte ON contexto_restricciones(parte_id);

-- RLS: padre neutro (cualquier parte del caso + admin)
ALTER TABLE caso_contexto ENABLE ROW LEVEL SECURITY;
CREATE POLICY caso_contexto_select ON caso_contexto
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM caso_partes cp
      WHERE cp.caso_id = caso_contexto.caso_id AND cp.usuario_id = (SELECT auth.uid())
    ) OR public.is_admin()
  );

-- RLS: hijas — aislamiento por parte (estilo items/CA-02)
ALTER TABLE contexto_integrantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_integrantes_select ON contexto_integrantes FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_integrantes_insert ON contexto_integrantes FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_integrantes_update ON contexto_integrantes FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_integrantes_delete ON contexto_integrantes FOR DELETE USING (parte_id = (SELECT auth.uid()));

ALTER TABLE contexto_actividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_actividades_select ON contexto_actividades FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_actividades_insert ON contexto_actividades FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_actividades_update ON contexto_actividades FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_actividades_delete ON contexto_actividades FOR DELETE USING (parte_id = (SELECT auth.uid()));

ALTER TABLE contexto_colegio ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_colegio_select ON contexto_colegio FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_colegio_insert ON contexto_colegio FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_colegio_update ON contexto_colegio FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_colegio_delete ON contexto_colegio FOR DELETE USING (parte_id = (SELECT auth.uid()));

ALTER TABLE contexto_cronograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_cronograma_select ON contexto_cronograma FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_cronograma_insert ON contexto_cronograma FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_cronograma_update ON contexto_cronograma FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_cronograma_delete ON contexto_cronograma FOR DELETE USING (parte_id = (SELECT auth.uid()));

ALTER TABLE contexto_domicilios ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_domicilios_select ON contexto_domicilios FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_domicilios_insert ON contexto_domicilios FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_domicilios_update ON contexto_domicilios FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_domicilios_delete ON contexto_domicilios FOR DELETE USING (parte_id = (SELECT auth.uid()));

ALTER TABLE contexto_restricciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY contexto_restricciones_select ON contexto_restricciones FOR SELECT USING (parte_id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY contexto_restricciones_insert ON contexto_restricciones FOR INSERT WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_restricciones_update ON contexto_restricciones FOR UPDATE USING (parte_id = (SELECT auth.uid())) WITH CHECK (parte_id = (SELECT auth.uid()));
CREATE POLICY contexto_restricciones_delete ON contexto_restricciones FOR DELETE USING (parte_id = (SELECT auth.uid()));

-- Triggers updated_at (función update_updated_at_column ya existe)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON caso_contexto FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_integrantes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_actividades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_colegio FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_cronograma FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_domicilios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contexto_restricciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grants explícitos por objeto
GRANT SELECT, INSERT, UPDATE, DELETE ON caso_contexto TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_integrantes TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_actividades TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_colegio TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_cronograma TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_domicilios TO authenticated, anon, service_role, postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON contexto_restricciones TO authenticated, anon, service_role, postgres;

COMMENT ON TABLE caso_contexto IS 'Ficha de contexto por caso: ancla de las tablas contexto_* (datos privados por parte).';
COMMENT ON TABLE contexto_integrantes IS 'Integrantes del grupo familiar cargados por una parte (privado por parte).';
COMMENT ON TABLE contexto_actividades IS 'Actividades/horarios de los chicos (privado por parte).';
COMMENT ON TABLE contexto_colegio IS 'Datos de colegio (privado por parte).';
COMMENT ON TABLE contexto_cronograma IS 'Cronograma semanal (privado por parte).';
COMMENT ON TABLE contexto_domicilios IS 'Domicilios (privado por parte).';
COMMENT ON TABLE contexto_restricciones IS 'Restricciones (privado por parte).';
```

## 2) `packages/db-types/src/database.types.ts`
Agregá las 7 tablas en `public` (Row/Insert/Update/Relationships) respetando el formato
existente. UUID → `string`; `timestamptz` → `string`; `time` → `string`; `jsonb` → `unknown`;
`date` → `string`. No borres nada existente.

## 3) `docs/database.md`
Agregá una subsección "Ficha de contexto del caso" bajo el módulo de casos, listando las 7
tablas y la regla de privacidad por parte (cada hija visible solo para su `parte_id` + admin).

## 4) `docs/changelogs-db/2026-09-14.md`
Si el archivo no existe, crealo con encabezado `## 2026-09-14`. Agregá una entrada:
`- 20260914120000_caso_contexto.sql — ficha de contexto del caso (7 tablas, privacidad por parte).`

## Reportá
Lista de paths creados/modificados.
