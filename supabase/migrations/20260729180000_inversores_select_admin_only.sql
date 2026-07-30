-- ============================================================
-- Proyecto Mediación — Migration: restrict inversores reads
-- Fecha: 2026-07-29
--
-- Hallazgo: `inversores_select_all` era `FOR SELECT USING (true)`, de modo que
-- cualquier portador de la clave anon —que viaja dentro del bundle del cliente
-- por diseño— podía leer `nombre`, `email`, `capital_disponible` y
-- `experiencia` de todos los leads de inversores.
--
-- Verificado contra la instancia de producción: `GET /rest/v1/inversores`
-- respondía 200 usando solo la clave anon. La tabla estaba vacía al momento de
-- la verificación, así que no hubo exposición de datos.
--
-- El INSERT anónimo se mantiene: es el formulario público de captación, y es
-- justamente lo que `POST /inversores` expone sin autenticación.
--
-- La API no se ve afectada: no tiene endpoint de lectura de inversores, y
-- además conecta con su propio DATABASE_URL, por lo que no atraviesa RLS.
-- ============================================================

DROP POLICY IF EXISTS inversores_select_all ON inversores;

-- Solo administradores pueden leer los leads.
CREATE POLICY inversores_select_admin ON inversores
  FOR SELECT USING (is_admin());
